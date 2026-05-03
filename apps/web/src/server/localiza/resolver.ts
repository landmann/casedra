import type {
	IdealistaSignals,
	LocalizaAddressEvidence,
	LocalizaPropertyDossier,
	LocalizaAcquisitionStrategy,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { LOCALIZA_BETA_AUTO_STRATEGY_ORDER } from "./acquisition-contract";
import { browserWorkerAdapter } from "./browser-worker-adapter";
import { fetchCatastroPropertyFactsEvidence } from "./catastro-property-facts";
import { resolveStateCatastro } from "./catastro-state";
import { mergeSignalsWithConfirmedAddressEvidence } from "./confirmed-address-evidence";
import { fetchEnergyCertificateEvidence } from "./energy-certificates";
import { fetchEuskoregiteBuildingConditionEvidence } from "./euskoregite-building-condition";
import { firecrawlAdapter } from "./firecrawl-adapter";
import { fetchFloodRiskEvidence } from "./flood-risk";
import { idealistaApiAdapter } from "./idealista-adapter";
import { findIndexedDuplicateAddressSignal } from "./indexed-duplicate-address";
import { fetchLocationAmenityEvidence } from "./location-amenities";
import { verifyIdealistaMaps } from "./maps-verifier";
import { fetchMadridPlanningHeritageEvidence } from "./madrid-planning-heritage";
import {
	type OportunistaListingArchiveImport,
	fetchOportunistaMarketIntel,
	isOportunistaPriceHistoryConfigured,
	OPORTUNISTA_PRICE_HISTORY_REFRESH_MS,
} from "./oportunista-price-history";
import type {
	LocalizaAdapter,
	LocalizaAdapterMethod,
	LocalizaAdapterOutput,
	LocalizaCachedResolutionRecord,
	LocalizaClaimLeaseResult,
	LocalizaOfficialResolution,
	LocalizaResolutionContext,
	LocalizaTerritoryAdapter,
} from "./types";
import {
	officialSourceLabelByTerritory,
	officialSourceUrlByTerritory,
} from "./types";
import { parseIdealistaListingUrl } from "./url";
import { LOCALIZA_RESOLVER_VERSION } from "./version";
import { fetchSolarPotentialEvidence } from "./solar-potential";

const OVERALL_DEADLINE_MS = 35_000;
const IN_FLIGHT_POLL_INTERVAL_MS = 300;
const LEASE_DURATION_MS = 35_000;
const UNRESOLVED_CACHE_TTL_MS = 10 * 1000;
const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAPS_VERIFY_TIMEOUT_MS = 2_000;
const MAPS_VERIFY_MIN_REMAINING_MS = 600;

const adapterRegistry: Record<LocalizaAdapterMethod, LocalizaAdapter> = {
	idealista_api: idealistaApiAdapter,
	firecrawl: firecrawlAdapter,
	browser_worker: browserWorkerAdapter,
};

const getLocationResolutionByLookupRef = makeFunctionReference<
	"query",
	{
		provider: "idealista";
		externalListingId: string;
		requestedStrategy: LocalizaAcquisitionStrategy;
		resolverVersion: string;
	},
	LocalizaCachedResolutionRecord | null
>("locationResolutions:getByLookup");

const getLatestSuccessfulLocationResolutionBySourceUrlRef = makeFunctionReference<
	"query",
	{
		sourceUrl: string;
	},
	LocalizaCachedResolutionRecord | null
>("locationResolutions:getLatestSuccessfulBySourceUrl");

const claimLocationResolutionLeaseRef = makeFunctionReference<
	"mutation",
	{
		provider: "idealista";
		externalListingId: string;
		sourceUrl: string;
		requestedStrategy: LocalizaAcquisitionStrategy;
		resolverVersion: string;
		leaseOwner: string;
		leaseDurationMs: number;
		defaultExpiresAt: number;
		now: number;
	},
	LocalizaClaimLeaseResult
>("locationResolutions:claimLease");

const completeLocationResolutionRef = makeFunctionReference<
	"mutation",
	{
		provider: "idealista";
		externalListingId: string;
		sourceUrl: string;
		requestedStrategy: LocalizaAcquisitionStrategy;
		resolverVersion: string;
		leaseOwner: string;
		result: ResolveIdealistaLocationResult;
		normalizedSignals?: IdealistaSignals;
		propertyHistoryKey?: string;
		expiresAt: number;
		now: number;
		errorCode?: string;
		errorMessage?: string;
	},
	{ id: string }
>("locationResolutions:complete");

const getPropertyHistoryByKeyRef = makeFunctionReference<
	"query",
	{
		propertyHistoryKey: string;
		limit?: number;
	},
	LocalizaPropertyDossier[]
>("locationResolutions:getPropertyHistoryByKey");

type LocalizaMarketObservation = {
	_id: string;
	propertyHistoryKey: string;
	portal: string;
	observedAt: string;
	askingPrice?: number;
	currencyCode?: "EUR";
	advertiserName?: string;
	agencyName?: string;
	sourceUrl?: string;
	daysPublished?: number;
	firstSeenAt?: string;
	lastSeenAt?: string;
	provenanceLabel: string;
	provenanceUrl?: string;
	sourceRecordId?: string;
	createdAt: number;
	updatedAt: number;
};

const getMarketObservationsByKeyRef = makeFunctionReference<
	"query",
	{
		propertyHistoryKey: string;
		limit?: number;
	},
	LocalizaMarketObservation[]
>("locationResolutions:getMarketObservationsByKey");

const upsertMarketObservationsRef = makeFunctionReference<
	"mutation",
	{
		observations: Array<{
			propertyHistoryKey: string;
			portal: string;
			observedAt: string;
			askingPrice?: number;
			currencyCode?: "EUR";
			advertiserName?: string;
			agencyName?: string;
			sourceUrl?: string;
			daysPublished?: number;
			firstSeenAt?: string;
			lastSeenAt?: string;
			provenanceLabel: string;
			provenanceUrl?: string;
			sourceRecordId?: string;
		}>;
		now?: number;
	},
	{ created: number; updated: number; total: number }
>("locationResolutions:upsertMarketObservations");

const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

const withTimeout = async <T>(
	operation: (signal: AbortSignal) => Promise<T>,
	timeoutMs: number,
	label: string,
) => {
	const abortController = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		timeoutId = setTimeout(() => {
			abortController.abort();
		}, timeoutMs);

		return await operation(abortController.signal);
	} catch (error) {
		if (abortController.signal.aborted) {
			throw new Error(`${label}_timeout`);
		}

		throw error;
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
};

const dedupe = (values: string[]) =>
	Array.from(new Set(values.filter(Boolean)));

const buildCacheExpiryIso = (expiresAt: number) =>
	new Date(expiresAt).toISOString();

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : "Unknown Localiza error.";

const logLocalizaEvent = (
	level: "info" | "warn" | "error",
	event: string,
	payload: Record<string, unknown>,
) => {
	const serialized = JSON.stringify({
		scope: "localiza",
		event,
		timestamp: new Date().toISOString(),
		...payload,
	});

	if (level === "error") {
		console.error(serialized);
		return;
	}

	if (level === "warn") {
		console.warn(serialized);
		return;
	}

	console.info(serialized);
};

const buildResolverLogPayload = (context: LocalizaResolutionContext) => ({
	userId: context.userId,
	sourceUrl: context.sourceMetadata.sourceUrl,
	externalListingId: context.sourceMetadata.externalListingId,
	requestedStrategy: context.requestedStrategy,
	resolverVersion: context.resolverVersion,
});

const getOfficialSourceDetails = (
	territoryAdapter?: LocalizaTerritoryAdapter,
) => ({
	officialSource: territoryAdapter
		? officialSourceLabelByTerritory[territoryAdapter]
		: "Pending official cadastral verification",
	officialSourceUrl: territoryAdapter
		? officialSourceUrlByTerritory[territoryAdapter]
		: undefined,
	territoryAdapter,
});

const getCadastreFailureDetails = (error: unknown) => {
	const message = getErrorMessage(error);
	const territoryAdapter = (
		[
			"state_catastro",
			"navarra_rtn",
			"alava_catastro",
			"bizkaia_catastro",
			"gipuzkoa_catastro",
		] as const
	).find((adapter) => message.startsWith(`${adapter}_`));

	return {
		reasonCode: territoryAdapter ? message : "state_catastro_failed",
		...getOfficialSourceDetails(territoryAdapter),
	};
};

const POSTAL_CODE_PATTERN = /\b(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})\b/;
const STREET_ADDRESS_PREFIX_PATTERN =
	"(?:calle|c\\/|avenida|avda\\.?|paseo|plaza|camino|carretera|ronda|traves[ií]a)";
const ADDRESS_EVIDENCE_PATTERN = new RegExp(
	`\\b(${STREET_ADDRESS_PREFIX_PATTERN}\\s+[^.;\\n]{3,95}?\\s*,?\\s+\\d{1,4}[A-Z]?)\\b`,
	"i",
);
const FULL_ADDRESS_EVIDENCE_PATTERN = new RegExp(
	`\\b(${STREET_ADDRESS_PREFIX_PATTERN}\\s+[^.\\n]{3,180}?${POSTAL_CODE_PATTERN.source}\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ '-]{2,60})\\b`,
	"i",
);

const cleanEvidenceAddressPart = (value?: string) => {
	const trimmed = value?.replace(/\s+/g, " ").trim();
	return trimmed ? trimmed : undefined;
};

const hasNumberedAddress = (value?: string) =>
	ADDRESS_EVIDENCE_PATTERN.test(value ?? "");

const normalizeEvidenceAddressLabel = (value?: string) =>
	cleanEvidenceAddressPart(value)
		?.replace(/\s+,/g, ",")
		.replace(/\s+\./g, ".")
		.replace(/[.;]\s*$/, "");

const extractAddressLabelFromEvidence = (value?: string) =>
	normalizeEvidenceAddressLabel(
		value?.match(FULL_ADDRESS_EVIDENCE_PATTERN)?.[1] ??
			value?.match(ADDRESS_EVIDENCE_PATTERN)?.[1],
	);

const buildEvidencePrefillLocation = (input: {
	addressLabel: string;
	signals: IdealistaSignals;
}) => {
	const addressParts = input.addressLabel
		.split(",")
		.map((part) => cleanEvidenceAddressPart(part))
		.filter((part): part is string => Boolean(part));
	const postalPart = addressParts.find((part) =>
		POSTAL_CODE_PATTERN.test(part),
	);
	const postalCode =
		input.addressLabel.match(POSTAL_CODE_PATTERN)?.[1] ??
		input.signals.postalCodeHint;
	const city =
		input.signals.municipality ??
		cleanEvidenceAddressPart(postalPart?.replace(POSTAL_CODE_PATTERN, ""));
	const province = input.signals.province ?? city;

	if (!postalCode || !city || !province) {
		return undefined;
	}

	return {
		street: addressParts[0] ?? input.addressLabel,
		city,
		stateOrProvince: province,
		postalCode,
		country: "Spain",
	};
};

const buildAddressEvidenceResolution = (input: {
	signals: IdealistaSignals;
	cadastreFailure?: ReturnType<typeof getCadastreFailureDetails>;
}): LocalizaOfficialResolution | null => {
	const candidates = (input.signals.addressEvidence ?? [])
		.flatMap((evidence, index) => {
			const addressLabel = extractAddressLabelFromEvidence(evidence.value);

			if (!addressLabel) {
				return [];
			}

			const matchedSignals = dedupe([
				"address_evidence_candidate",
				...evidence.matchedSignals,
			]);
			const isConfirmedEvidence = isConfirmedAddressEvidence(evidence);
			const score = isConfirmedEvidence
				? Math.min(
						0.9,
						Number(
							(0.7 + Math.min(matchedSignals.length, 6) * 0.03).toFixed(2),
						),
					)
				: Math.min(
						0.84,
						Number(
							(0.58 + Math.min(matchedSignals.length, 6) * 0.04).toFixed(2),
						),
					);

			const candidate: ResolveIdealistaLocationResult["candidates"][number] = {
				id: `address-evidence-${index}-${normalizeHistoryUrlKey(
					evidence.sourceUrl ?? addressLabel,
				)}`,
				label: addressLabel,
				officialUrl: evidence.sourceUrl,
				score,
				reasonCodes: [
					"address_evidence_candidate",
					"manual_confirmation_required",
					...(isConfirmedEvidence ? ["confirmed_address_evidence"] : []),
				],
				prefillLocation: buildEvidencePrefillLocation({
					addressLabel,
					signals: input.signals,
				}),
				rationale: {
					title: isConfirmedEvidence
						? "Dirección confirmada por evidencia verificada"
						: "Dirección observada en evidencia pública",
					description: isConfirmedEvidence
						? `${evidence.label}: ${evidence.value}. Localiza la muestra como candidato confirmado para revisión humana porque la llamada oficial en vivo puede fallar o dejar más de una puerta defendible.`
						: `${evidence.label}: ${evidence.value}. Catastro no pudo confirmar esta dirección en esta ejecución, así que Localiza la muestra como candidato para confirmar, no como autofill definitivo.`,
					sourceLabel: evidence.sourceLabel,
					sourceUrl: evidence.sourceUrl,
					matchedSignals,
					discardedSignals: ["official_cadastre_temporarily_unavailable"],
				},
			};

			return [candidate];
		})
		.sort((left, right) => right.score - left.score)
		.slice(0, 5);

	if (candidates.length === 0) {
		return null;
	}

	const topCandidate = candidates[0];
	const matchedSignals = dedupe(candidates.flatMap((candidate) =>
		candidate.rationale?.matchedSignals ?? [],
	));

	return {
		status: "needs_confirmation",
		confidenceScore: topCandidate.score,
		officialSource: "Evidencia pública indexada; Catastro pendiente",
		resolvedAddressLabel: topCandidate.label,
		prefillLocation: topCandidate.prefillLocation,
		candidates,
		reasonCodes: dedupe([
			"address_evidence_confirmation_candidate",
			"manual_confirmation_required",
			...(input.cadastreFailure
				? ["official_cadastre_failed", input.cadastreFailure.reasonCode]
				: []),
		]),
		matchedSignals,
		discardedSignals: ["official_cadastre_temporarily_unavailable"],
		territoryAdapter: input.cadastreFailure?.territoryAdapter ?? "state_catastro",
	};
};

const isConfirmedAddressEvidence = (evidence: LocalizaAddressEvidence) =>
	evidence.matchedSignals.some((signal) =>
		[
			"confirmed_address_evidence",
			"human_confirmed_address",
			"catastro_unit_reference_verified",
		].includes(signal),
	);

const normalizeAddressComparison = (value?: string) =>
	(value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");

const addressLabelsOverlap = (left?: string, right?: string) => {
	const normalizedLeft = normalizeAddressComparison(left);
	const normalizedRight = normalizeAddressComparison(right);

	return Boolean(
		normalizedLeft &&
			normalizedRight &&
			(normalizedLeft.includes(normalizedRight) ||
				normalizedRight.includes(normalizedLeft)),
	);
};

const officialResolutionMatchesConfirmedEvidence = (input: {
	signals: IdealistaSignals;
	officialResolution: LocalizaOfficialResolution;
}) => {
	const confirmedLabels =
		input.signals.addressEvidence
			?.filter(isConfirmedAddressEvidence)
			.map((evidence) => extractAddressLabelFromEvidence(evidence.value))
			.filter((label): label is string => Boolean(label)) ?? [];
	const officialLabels = [
		input.officialResolution.resolvedAddressLabel,
		...input.officialResolution.candidates.map((candidate) => candidate.label),
	].filter((label): label is string => Boolean(label));

	return confirmedLabels.some((confirmedLabel) =>
		officialLabels.some((officialLabel) =>
			addressLabelsOverlap(confirmedLabel, officialLabel),
		),
	);
};

const maybePreferConfirmedAddressEvidence = (input: {
	signals: IdealistaSignals;
	officialResolution: LocalizaOfficialResolution;
}) => {
	const hasConfirmedEvidence =
		input.signals.addressEvidence?.some(isConfirmedAddressEvidence) ?? false;

	if (!hasConfirmedEvidence) {
		return input.officialResolution;
	}

	const addressEvidenceResolution = buildAddressEvidenceResolution({
		signals: input.signals,
	});

	if (!addressEvidenceResolution) {
		return input.officialResolution;
	}

	if (
		officialResolutionMatchesConfirmedEvidence({
			signals: input.signals,
			officialResolution: input.officialResolution,
		})
	) {
		return input.officialResolution;
	}

	return {
		...addressEvidenceResolution,
		reasonCodes: dedupe([
			...addressEvidenceResolution.reasonCodes,
			"confirmed_address_evidence_preferred",
			...(input.officialResolution.status === "unresolved"
				? ["official_resolution_unresolved"]
				: ["official_resolution_conflicted_with_confirmed_evidence"]),
		]),
		discardedSignals: dedupe([
			...addressEvidenceResolution.discardedSignals,
			...input.officialResolution.discardedSignals,
		]),
	};
};

const maybeApplyMapsVerification = async (input: {
	context: LocalizaResolutionContext;
	signals: IdealistaSignals;
	officialResolution: LocalizaOfficialResolution;
	deadlineAt: number;
}): Promise<LocalizaOfficialResolution> => {
	if (input.officialResolution.status !== "building_match") {
		return input.officialResolution;
	}

	const topCandidate = input.officialResolution.candidates[0];

	if (!topCandidate) {
		return input.officialResolution;
	}

	const remainingMs = input.deadlineAt - Date.now();

	if (remainingMs < MAPS_VERIFY_MIN_REMAINING_MS) {
		logLocalizaEvent("info", "localiza.resolve.maps_verification_skipped", {
			...buildResolverLogPayload(input.context),
			reason: "deadline_too_close",
			remainingMs,
		});
		return input.officialResolution;
	}

	const verifyStartedAt = Date.now();
	const verification = await verifyIdealistaMaps({
		signals: input.signals,
		candidate: topCandidate,
		timeoutMs: Math.min(MAPS_VERIFY_TIMEOUT_MS, remainingMs),
	}).catch((error) => {
		logLocalizaEvent("warn", "localiza.resolve.maps_verification_errored", {
			...buildResolverLogPayload(input.context),
			errorMessage: getErrorMessage(error),
			durationMs: Date.now() - verifyStartedAt,
		});
		return null;
	});

	if (!verification) {
		return {
			...input.officialResolution,
			reasonCodes: dedupe([
				...input.officialResolution.reasonCodes,
				"idealista_maps_verification_errored",
			]),
		};
	}

	logLocalizaEvent("info", "localiza.resolve.maps_verification_completed", {
		...buildResolverLogPayload(input.context),
		status: verification.status,
		checkedUrl: verification.checkedUrl,
		durationMs: Date.now() - verifyStartedAt,
	});

	if (verification.status !== "confirmed") {
		return {
			...input.officialResolution,
			reasonCodes: dedupe([
				...input.officialResolution.reasonCodes,
				...verification.reasonCodes,
			]),
		};
	}

	const promotedConfidence = Math.min(
		1,
		Number(
			(
				input.officialResolution.confidenceScore + verification.confidenceBoost
			).toFixed(2),
		),
	);

	return {
		...input.officialResolution,
		status: "exact_match",
		confidenceScore: promotedConfidence,
		reasonCodes: dedupe([
			...input.officialResolution.reasonCodes,
			...verification.reasonCodes,
			"maps_verification_promoted_to_exact_match",
		]),
		matchedSignals: dedupe([
			...input.officialResolution.matchedSignals,
			...verification.matchedSignals,
		]),
	};
};

const isFreshCachedResult = (
	record: LocalizaCachedResolutionRecord | null,
	now: number,
): record is LocalizaCachedResolutionRecord & {
	result: ResolveIdealistaLocationResult;
} => record !== null && Boolean(record.result) && record.expiresAt > now;

const buildSourceMetadata = (input: {
	externalListingId: string;
	sourceUrl: string;
}) => ({
	provider: "idealista" as const,
	externalListingId: input.externalListingId,
	sourceUrl: input.sourceUrl,
});

const cleanDossierText = (value?: string) => {
	const trimmed = value?.replace(/\s+/g, " ").trim();
	return trimmed ? trimmed : undefined;
};

const parseOfficialAddressComponents = (
	label?: string,
	prefillLocation?: ResolveIdealistaLocationResult["prefillLocation"],
) => {
	const parts = label
		?.split(",")
		.map((part) => cleanDossierText(part))
		.filter((part): part is string => Boolean(part));
	const streetPart = parts?.[0];
	const streetMatch = streetPart?.match(/^(.+?)\s+(\d+[A-Z]?)$/i);
	const staircase = parts
		?.find((part) => /^Escalera\s+/i.test(part))
		?.replace(/^Escalera\s+/i, "");
	const floor = parts
		?.find((part) => /^(Planta|Piso)\s+/i.test(part))
		?.replace(/^(Planta|Piso)\s+/i, "");
	const door = parts
		?.find((part) => /^Puerta\s+/i.test(part))
		?.replace(/^Puerta\s+/i, "");
	const postalCode =
		prefillLocation?.postalCode ?? parts?.find((part) => /^\d{5}$/.test(part));
	const municipality =
		prefillLocation?.city ??
		[...(parts ?? [])]
			.reverse()
			.find((part) => !/^\d{5}$/.test(part) && part !== streetPart);

	return {
		street: cleanDossierText(streetMatch?.[1] ?? prefillLocation?.street),
		number: cleanDossierText(streetMatch?.[2]),
		staircase: cleanDossierText(staircase),
		floor: cleanDossierText(floor),
		door: cleanDossierText(door),
		postalCode: cleanDossierText(postalCode),
		municipality: cleanDossierText(municipality),
		province: cleanDossierText(prefillLocation?.stateOrProvince),
	};
};

const buildRecentImageGallery = (signals: IdealistaSignals) => {
	const fallbackObservations: LocalizaPropertyDossier["imageGallery"] =
		signals.imageUrls?.map((imageUrl, index) => ({
			imageUrl,
			sourcePortal: "idealista",
			sourceUrl: signals.sourceUrl,
			observedAt: signals.acquiredAt,
			lastVerifiedAt: signals.acquiredAt,
			caption: index === 0 ? "Imagen principal del anuncio" : undefined,
		})) ?? [];
	const observations: LocalizaPropertyDossier["imageGallery"] =
		signals.imageObservations ?? fallbackObservations;

	const seen = new Set<string>();

	return observations
		.filter((image) => {
			if (seen.has(image.imageUrl)) {
				return false;
			}
			seen.add(image.imageUrl);
			return Boolean(image.observedAt && image.sourceUrl);
		})
		.slice(0, 12);
};

const buildAddressOnlineEvidence = (
	signals: IdealistaSignals,
): LocalizaOnlineEvidenceItem[] =>
	(signals.addressEvidence ?? []).map((item) => ({
		label: item.label,
		value: item.value,
		sourceLabel: item.sourceLabel,
		sourceUrl: item.sourceUrl,
		observedAt: item.observedAt,
		kind: "listing_archive",
	}));

const buildPropertyDossier = (input: {
	context: LocalizaResolutionContext;
	signals: IdealistaSignals;
	resolvedAt: string;
	officialSource: string;
	officialSourceUrl?: string;
	resolvedAddressLabel?: string;
	parcelRef14?: string;
	unitRef20?: string;
	prefillLocation?: ResolveIdealistaLocationResult["prefillLocation"];
	candidates?: ResolveIdealistaLocationResult["candidates"];
}): LocalizaPropertyDossier => {
	const imageGallery = buildRecentImageGallery(input.signals);
	const addressOnlineEvidence = buildAddressOnlineEvidence(input.signals);
	const leadImageUrl =
		input.signals.primaryImageUrl ??
		imageGallery[0]?.imageUrl ??
		input.signals.imageUrls?.[0];
	const proposedAddressLabel =
		input.resolvedAddressLabel ??
		input.candidates?.find((candidate) => !candidate.selectionDisabled)?.label;
	const officialComponents = parseOfficialAddressComponents(
		proposedAddressLabel,
		input.prefillLocation,
	);
	const observedAt = input.signals.acquiredAt || input.resolvedAt;
	const daysPublished =
		input.signals.daysPublished !== undefined
			? Math.max(1, Math.round(input.signals.daysPublished))
			: undefined;
	const publicHistory = [
		{
			observedAt,
			askingPrice: input.signals.price,
			currencyCode: "EUR" as const,
			portal: "IDEALISTA",
			advertiserName: input.signals.advertiserName,
			agencyName: input.signals.agencyName,
			sourceUrl: input.context.sourceMetadata.sourceUrl,
			daysPublished,
		},
	];
	const publicationDurations: LocalizaPropertyDossier["publicationDurations"] =
		[];
	const durationLabels = new Set<string>();
	const addDuration = (
		label: string | undefined,
		kind: LocalizaPropertyDossier["publicationDurations"][number]["kind"],
	) => {
		const normalizedLabel = cleanDossierText(label);
		if (!normalizedLabel || durationLabels.has(`${kind}:${normalizedLabel}`)) {
			return;
		}
		durationLabels.add(`${kind}:${normalizedLabel}`);
		if (daysPublished !== undefined && daysPublished > 1) {
			publicationDurations.push({
				label: normalizedLabel,
				kind,
				daysPublished,
			});
		}
	};

	addDuration(input.signals.advertiserName, "advertiser");
	addDuration(input.signals.agencyName, "agency");
	addDuration("IDEALISTA", "portal");

	return {
		listingSnapshot: {
			title: input.signals.title,
			leadImageUrl,
			askingPrice: input.signals.price,
			currencyCode: input.signals.price !== undefined ? "EUR" : undefined,
			priceIncludesParking: input.signals.priceIncludesParking,
			areaM2: input.signals.areaM2,
			bedrooms: input.signals.bedrooms,
			bathrooms: input.signals.bathrooms,
			floorText: input.signals.floorText,
			isExterior: input.signals.isExterior,
			hasElevator: input.signals.hasElevator,
			sourcePortal: "idealista",
			sourceUrl: input.context.sourceMetadata.sourceUrl,
		},
		imageGallery,
		onlineEvidence:
			addressOnlineEvidence.length > 0 ? addressOnlineEvidence : undefined,
		officialIdentity: {
			proposedAddressLabel,
			...officialComponents,
			municipality:
				officialComponents.municipality ??
				cleanDossierText(input.signals.municipality),
			province:
				officialComponents.province ?? cleanDossierText(input.signals.province),
			parcelRef14: input.parcelRef14,
			unitRef20: input.unitRef20,
			officialSource: input.officialSource,
			officialSourceUrl: input.officialSourceUrl,
		},
		publicHistory,
		duplicateGroup: {
			count: publicHistory.length,
			records: publicHistory.map((entry) => ({
				portal: entry.portal,
				sourceUrl: entry.sourceUrl,
				advertiserName: entry.advertiserName,
				agencyName: entry.agencyName,
				firstSeenAt: entry.observedAt,
				lastSeenAt: entry.observedAt,
				askingPrice: entry.askingPrice,
			})),
		},
		publicationDurations,
		actions: {
			valuationUrl: `/app/studio?source=localiza&sourceUrl=${encodeURIComponent(
				input.context.sourceMetadata.sourceUrl,
			)}`,
		},
	};
};

type LocalizaPublicHistoryRow =
	LocalizaPropertyDossier["publicHistory"][number];
type LocalizaDuplicateRecord =
	LocalizaPropertyDossier["duplicateGroup"]["records"][number];
type LocalizaPublicationDuration =
	LocalizaPropertyDossier["publicationDurations"][number];
type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

const normalizePropertyHistoryKeyPart = (value?: string) =>
	cleanDossierText(value)
		?.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

const normalizeHistoryUrlKey = (sourceUrl?: string) => {
	if (!sourceUrl) {
		return undefined;
	}

	try {
		const parsedUrl = new URL(sourceUrl);
		parsedUrl.hash = "";
		parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
		parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

		return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
	} catch {
		return sourceUrl.trim().replace(/\/+$/, "").toLowerCase();
	}
};

const getPropertyHistoryKey = (result: ResolveIdealistaLocationResult) => {
	const identity = result.propertyDossier?.officialIdentity;

	if (!identity) {
		return undefined;
	}

	if (identity.unitRef20) {
		return `unit:${identity.unitRef20.toUpperCase()}`;
	}

	if (identity.parcelRef14) {
		return `parcel:${identity.parcelRef14.toUpperCase()}`;
	}

	if (result.status === "needs_confirmation") {
		return undefined;
	}

	const addressKey = [
		identity.street,
		identity.number,
		identity.postalCode,
		identity.municipality,
		identity.province,
	]
		.map(normalizePropertyHistoryKeyPart)
		.filter(Boolean)
		.join("|");

	return addressKey ? `address:${addressKey}` : undefined;
};

const getListingMarketHistoryKey = (context: LocalizaResolutionContext) =>
	`listing:idealista:${context.sourceMetadata.externalListingId}`;

const parseHistoryDate = (value?: string) => {
	const timestamp = Date.parse(value ?? "");
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const getInclusiveDays = (start?: string, end?: string) => {
	const startTimestamp = parseHistoryDate(start);
	const endTimestamp = parseHistoryDate(end);

	if (startTimestamp === undefined || endTimestamp === undefined) {
		return undefined;
	}

	return Math.max(
		1,
		Math.round((endTimestamp - startTimestamp) / (24 * 60 * 60 * 1000)) + 1,
	);
};

const formatEvidenceDate = (value?: string) => {
	const timestamp = parseHistoryDate(value);
	return timestamp === undefined
		? undefined
		: new Intl.DateTimeFormat("es-ES", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			}).format(new Date(timestamp));
};

const formatEvidenceInteger = (value?: number) =>
	value === undefined
		? undefined
		: new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(
				value,
			);

const formatEvidenceEuro = (value?: number) => {
	const formatted = formatEvidenceInteger(value);
	return formatted ? `${formatted} €` : undefined;
};

const formatEvidenceEuroPerM2 = (value?: number) => {
	const formatted = formatEvidenceInteger(value);
	return formatted ? `${formatted} €/m²` : undefined;
};

const formatBooleanFeature = (value: boolean | undefined, label: string) =>
	value ? label : undefined;

const getHistoryRowKey = (row: LocalizaPublicHistoryRow) =>
	[
		row.portal.toUpperCase(),
		normalizeHistoryUrlKey(row.sourceUrl) ?? "no-url",
		row.observedAt,
		row.askingPrice ?? "no-price",
		cleanDossierText(row.agencyName ?? row.advertiserName) ?? "no-party",
	].join("|");

const mergeSignalsWithOportunistaArchive = (
	signals: IdealistaSignals,
	archive?: OportunistaListingArchiveImport,
): IdealistaSignals => {
	if (!archive) {
		return signals;
	}

	const listingText = cleanDossierText(
		[signals.listingText, archive.addressText].filter(Boolean).join("\n"),
	);

	return {
		...signals,
		title: signals.title ?? archive.title,
		price: archive.latestPrice ?? signals.price,
		areaM2: signals.areaM2 ?? archive.areaM2,
		bedrooms: signals.bedrooms ?? archive.bedrooms,
		bathrooms: signals.bathrooms ?? archive.bathrooms,
		floorText: signals.floorText ?? archive.floorText,
		primaryImageUrl: signals.primaryImageUrl ?? archive.thumbnailUrl,
		priceIncludesParking:
			signals.priceIncludesParking ?? archive.hasParkingSpace,
		isExterior: signals.isExterior ?? archive.isExterior,
		hasElevator: signals.hasElevator ?? archive.hasElevator,
		advertiserName: signals.advertiserName ?? archive.advertiserName,
		agencyName: signals.agencyName ?? archive.agencyName,
		addressText: signals.addressText ?? archive.addressText,
		neighborhood: signals.neighborhood ?? archive.neighborhood,
		municipality: signals.municipality ?? archive.municipality,
		province: signals.province ?? archive.province,
		postalCodeHint: signals.postalCodeHint ?? archive.postalCodeHint,
		approximateLat: archive.approximateLat ?? signals.approximateLat,
		approximateLng: archive.approximateLng ?? signals.approximateLng,
		mapPrecisionMeters:
			archive.mapPrecisionMeters ?? signals.mapPrecisionMeters,
		listingText,
	};
};

const mergeSignalsWithIndexedDuplicateAddress = (
	signals: IdealistaSignals,
	duplicate: Awaited<ReturnType<typeof findIndexedDuplicateAddressSignal>>,
): IdealistaSignals => {
	if (!duplicate) {
		return signals;
	}

	const listingText = cleanDossierText(
		[
			signals.listingText,
			`Dirección exacta observada en duplicado público: ${duplicate.evidence.value}`,
		]
			.filter(Boolean)
			.join("\n"),
	);
	const evidenceKey = `${duplicate.evidence.sourceUrl ?? "indexed"}:${duplicate.evidence.value}`;
	const existingEvidence = signals.addressEvidence ?? [];
	const hasExistingEvidence = existingEvidence.some(
		(item) => `${item.sourceUrl ?? "indexed"}:${item.value}` === evidenceKey,
	);
	const shouldPromoteDuplicateAddress =
		hasNumberedAddress(duplicate.addressText) &&
		!hasNumberedAddress(signals.addressText);

	return {
		...signals,
		addressText: shouldPromoteDuplicateAddress
			? duplicate.addressText
			: (signals.addressText ?? duplicate.addressText),
		listingText,
		addressEvidence: hasExistingEvidence
			? existingEvidence
			: [...existingEvidence, duplicate.evidence],
	};
};

const enrichAdapterOutputWithOportunistaSignals = async (input: {
	context: LocalizaResolutionContext;
	adapterOutput: LocalizaAdapterOutput;
}): Promise<LocalizaAdapterOutput> => {
	if (!isOportunistaPriceHistoryConfigured()) {
		return input.adapterOutput;
	}

	try {
		const importedIntel = await fetchOportunistaMarketIntel({
			listingId: input.context.sourceMetadata.externalListingId,
			sourceUrl: input.context.sourceMetadata.sourceUrl,
		});
		const enrichedSignals = mergeSignalsWithOportunistaArchive(
			input.adapterOutput.signals,
			importedIntel.archive,
		);

		return {
			signals: enrichedSignals,
			matchedSignals: dedupe([
				...input.adapterOutput.matchedSignals,
				...(importedIntel.archive?.addressText
					? ["oportunista_address_text"]
					: []),
				...(importedIntel.archive?.latestPrice !== undefined
					? ["oportunista_price_history"]
					: []),
			]),
			discardedSignals: input.adapterOutput.discardedSignals,
			reasonCodes: dedupe([
				...input.adapterOutput.reasonCodes,
				"oportunista_archive_signals_checked",
				...(importedIntel.archive?.addressText
					? ["oportunista_address_signal_applied"]
					: []),
			]),
		};
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.oportunista_signals_failed", {
			...buildResolverLogPayload(input.context),
			errorMessage: getErrorMessage(error),
		});

		return input.adapterOutput;
	}
};

const enrichAdapterOutputWithIndexedDuplicateAddress = async (input: {
	context: LocalizaResolutionContext;
	adapterOutput: LocalizaAdapterOutput;
}): Promise<LocalizaAdapterOutput> => {
	try {
		const duplicate = await findIndexedDuplicateAddressSignal({
			signals: input.adapterOutput.signals,
		});

		if (!duplicate) {
			return input.adapterOutput;
		}

		return {
			signals: mergeSignalsWithIndexedDuplicateAddress(
				input.adapterOutput.signals,
				duplicate,
			),
			matchedSignals: dedupe([
				...input.adapterOutput.matchedSignals,
				...duplicate.matchedSignals,
			]),
			discardedSignals: input.adapterOutput.discardedSignals,
			reasonCodes: dedupe([
				...input.adapterOutput.reasonCodes,
				...duplicate.reasonCodes,
			]),
		};
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.indexed_duplicate_failed", {
			...buildResolverLogPayload(input.context),
			errorMessage: getErrorMessage(error),
		});

		return input.adapterOutput;
	}
};

const enrichAdapterOutputWithConfirmedAddressEvidence = (input: {
	adapterOutput: LocalizaAdapterOutput;
}): LocalizaAdapterOutput => {
	const confirmedEvidence = mergeSignalsWithConfirmedAddressEvidence(
		input.adapterOutput.signals,
	);

	if (confirmedEvidence.reasonCodes.length === 0) {
		return input.adapterOutput;
	}

	return {
		signals: confirmedEvidence.signals,
		matchedSignals: dedupe([
			...input.adapterOutput.matchedSignals,
			...confirmedEvidence.matchedSignals,
		]),
		discardedSignals: input.adapterOutput.discardedSignals,
		reasonCodes: dedupe([
			...input.adapterOutput.reasonCodes,
			...confirmedEvidence.reasonCodes,
		]),
	};
};

const buildConfirmedAddressFallbackAdapterOutput = (input: {
	sourceUrl: string;
	externalListingId: string;
	adapterFailureCodes: string[];
}): LocalizaAdapterOutput | null => {
	const confirmedEvidence = mergeSignalsWithConfirmedAddressEvidence({
		provider: "idealista",
		listingId: input.externalListingId,
		sourceUrl: input.sourceUrl,
		acquisitionMethod: "url_parse",
		acquiredAt: new Date().toISOString(),
	});

	if (confirmedEvidence.reasonCodes.length === 0) {
		return null;
	}

	return {
		signals: confirmedEvidence.signals,
		matchedSignals: dedupe([
			"idealista_listing_id",
			...confirmedEvidence.matchedSignals,
		]),
		discardedSignals: input.adapterFailureCodes,
		reasonCodes: dedupe([
			"listing_id_parsed",
			"confirmed_address_evidence_fallback",
			...confirmedEvidence.reasonCodes,
			...input.adapterFailureCodes,
		]),
	};
};

const buildHistoryRowsFromMarketObservations = (
	observations: LocalizaMarketObservation[],
): LocalizaPublicHistoryRow[] =>
	observations.map((observation) => ({
		observedAt: observation.observedAt,
		askingPrice: observation.askingPrice,
		currencyCode: observation.currencyCode,
		portal: observation.portal.toUpperCase(),
		advertiserName: observation.advertiserName,
		agencyName: observation.agencyName,
		sourceUrl: observation.sourceUrl ?? observation.provenanceUrl,
		daysPublished: observation.daysPublished,
	}));

const buildDuplicateRecordsFromMarketObservations = (
	observations: LocalizaMarketObservation[],
): LocalizaDuplicateRecord[] =>
	observations.map((observation) => ({
		portal: observation.portal.toUpperCase(),
		sourceUrl: observation.sourceUrl ?? observation.provenanceUrl,
		advertiserName: observation.advertiserName,
		agencyName: observation.agencyName,
		firstSeenAt: observation.firstSeenAt ?? observation.observedAt,
		lastSeenAt:
			observation.lastSeenAt ??
			observation.firstSeenAt ??
			observation.observedAt,
		askingPrice: observation.askingPrice,
	}));

const mergePublicHistoryRows = (
	dossiers: LocalizaPropertyDossier[],
	extraRows: LocalizaPublicHistoryRow[] = [],
): LocalizaPublicHistoryRow[] => {
	const rowsByKey = new Map<string, LocalizaPublicHistoryRow>();

	for (const row of [
		...dossiers.flatMap((dossier) => dossier.publicHistory),
		...extraRows,
	]) {
		if (!row.observedAt || !Number.isFinite(Date.parse(row.observedAt))) {
			continue;
		}

		rowsByKey.set(getHistoryRowKey(row), row);
	}

	return Array.from(rowsByKey.values())
		.sort(
			(left, right) =>
				new Date(right.observedAt).getTime() -
				new Date(left.observedAt).getTime(),
		)
		.slice(0, 40);
};

const getDuplicateRecordKey = (record: LocalizaDuplicateRecord) =>
	[
		record.portal.toUpperCase(),
		normalizeHistoryUrlKey(record.sourceUrl) ??
			cleanDossierText(record.agencyName ?? record.advertiserName) ??
			"no-source",
	].join("|");

const mergeDuplicateRecords = (
	history: LocalizaPublicHistoryRow[],
	dossiers: LocalizaPropertyDossier[],
	extraRecords: LocalizaDuplicateRecord[] = [],
): LocalizaDuplicateRecord[] => {
	const recordsByKey = new Map<string, LocalizaDuplicateRecord>();
	const addRecord = (record: LocalizaDuplicateRecord) => {
		const key = getDuplicateRecordKey(record);
		const existing = recordsByKey.get(key);

		if (!existing) {
			recordsByKey.set(key, record);
			return;
		}

		const firstSeenAt =
			(parseHistoryDate(record.firstSeenAt) ?? Number.POSITIVE_INFINITY) <
			(parseHistoryDate(existing.firstSeenAt) ?? Number.POSITIVE_INFINITY)
				? record.firstSeenAt
				: existing.firstSeenAt;
		const lastSeenAt =
			(parseHistoryDate(record.lastSeenAt) ?? 0) >
			(parseHistoryDate(existing.lastSeenAt) ?? 0)
				? record.lastSeenAt
				: existing.lastSeenAt;
		const askingPrice =
			lastSeenAt === record.lastSeenAt
				? (record.askingPrice ?? existing.askingPrice)
				: existing.askingPrice;

		recordsByKey.set(key, {
			...existing,
			...record,
			firstSeenAt,
			lastSeenAt,
			askingPrice,
		});
	};

	for (const record of dossiers.flatMap(
		(dossier) => dossier.duplicateGroup.records,
	)) {
		addRecord(record);
	}

	for (const record of extraRecords) {
		addRecord(record);
	}

	for (const row of history) {
		addRecord({
			portal: row.portal,
			sourceUrl: row.sourceUrl,
			advertiserName: row.advertiserName,
			agencyName: row.agencyName,
			firstSeenAt: row.observedAt,
			lastSeenAt: row.observedAt,
			askingPrice: row.askingPrice,
		});
	}

	return Array.from(recordsByKey.values())
		.sort(
			(left, right) =>
				(parseHistoryDate(right.lastSeenAt) ?? 0) -
				(parseHistoryDate(left.lastSeenAt) ?? 0),
		)
		.slice(0, 25);
};

const buildOportunistaOnlineEvidence = (
	archive?: OportunistaListingArchiveImport,
): LocalizaOnlineEvidenceItem[] => {
	if (!archive) {
		return [];
	}

	const features = [
		formatBooleanFeature(archive.isExterior, "Exterior"),
		formatBooleanFeature(archive.hasElevator, "Ascensor"),
		formatBooleanFeature(archive.hasParkingSpace, "Garaje"),
		formatBooleanFeature(archive.hasTerrace, "Terraza"),
		formatBooleanFeature(archive.hasSwimmingPool, "Piscina"),
		formatBooleanFeature(archive.hasGarden, "Jardín"),
		formatBooleanFeature(archive.hasBoxRoom, "Trastero"),
		formatBooleanFeature(archive.hasAirConditioning, "Aire acondicionado"),
		formatBooleanFeature(archive.hasPlan, "Plano"),
		formatBooleanFeature(archive.hasVideo, "Vídeo"),
		formatBooleanFeature(archive.has3DTour, "Tour 3D"),
	].filter(Boolean);
	const priceRange =
		archive.lowestPrice !== undefined && archive.highestPrice !== undefined
			? `${formatEvidenceEuro(archive.lowestPrice)} - ${formatEvidenceEuro(
					archive.highestPrice,
				)}`
			: undefined;
	const roomsSummary = [
		archive.areaM2 ? `${formatEvidenceInteger(archive.areaM2)} m²` : undefined,
		archive.bedrooms !== undefined ? `${archive.bedrooms} hab.` : undefined,
		archive.bathrooms !== undefined ? `${archive.bathrooms} baños` : undefined,
		archive.floorText ? `Planta ${archive.floorText}` : undefined,
	].filter(Boolean);
	const evidence = [
		{
			label: "Publicado desde",
			value: formatEvidenceDate(archive.publishedAt),
		},
		{
			label: "Última captura",
			value: formatEvidenceDate(archive.lastSeenAt),
		},
		{
			label: "Rango histórico",
			value: priceRange,
		},
		{
			label: "Precio archivado",
			value: formatEvidenceEuro(archive.latestPrice),
		},
		{
			label: "Precio por m²",
			value: formatEvidenceEuroPerM2(archive.priceByArea),
		},
		{
			label: "Estado del anuncio",
			value: archive.status,
		},
		{
			label: "Tipología archivada",
			value: archive.propertyType,
		},
		{
			label: "Características archivadas",
			value: roomsSummary.join(" · ") || undefined,
		},
		{
			label: "Extras publicados",
			value: features.join(" · ") || undefined,
		},
		{
			label: "Fotos publicadas",
			value: formatEvidenceInteger(archive.numPhotos),
		},
		{
			label: "Referencia del anunciante",
			value: archive.externalReference,
		},
		{
			label: "Comercializador",
			value: archive.agencyName ?? archive.advertiserName,
		},
		{
			label: "Tipo de anunciante",
			value: archive.userType,
		},
	];

	return evidence
		.filter((item): item is { label: string; value: string } =>
			Boolean(item.value),
		)
		.map((item) => ({
			...item,
			sourceLabel: archive.sourceLabel,
			sourceUrl: archive.sourceUrl,
			observedAt: archive.observedAt,
			kind: "listing_archive",
		}));
};

const getOnlineEvidenceKey = (item: LocalizaOnlineEvidenceItem) =>
	[
		item.kind,
		item.sourceLabel,
		item.label,
		item.value,
		normalizeHistoryUrlKey(item.sourceUrl) ?? "no-source",
	].join("|");

const mergeOnlineEvidence = (
	dossiers: LocalizaPropertyDossier[],
	extraEvidence: LocalizaOnlineEvidenceItem[] = [],
) => {
	const evidenceByKey = new Map<string, LocalizaOnlineEvidenceItem>();

	for (const item of [
		...dossiers.flatMap((dossier) => dossier.onlineEvidence ?? []),
		...extraEvidence,
	]) {
		if (!item.label || !item.value || !item.sourceLabel) {
			continue;
		}

		evidenceByKey.set(getOnlineEvidenceKey(item), item);
	}

	return Array.from(evidenceByKey.values()).slice(0, 80);
};

const mergeDossierWithOportunistaArchive = (
	dossier: LocalizaPropertyDossier,
	archive?: OportunistaListingArchiveImport,
) => {
	if (!archive) {
		return dossier;
	}

	return {
		...dossier,
		listingSnapshot: {
			...dossier.listingSnapshot,
			title: dossier.listingSnapshot.title ?? archive.title,
			leadImageUrl:
				dossier.listingSnapshot.leadImageUrl ?? archive.thumbnailUrl,
			askingPrice: archive.latestPrice ?? dossier.listingSnapshot.askingPrice,
			areaM2: dossier.listingSnapshot.areaM2 ?? archive.areaM2,
			bedrooms: dossier.listingSnapshot.bedrooms ?? archive.bedrooms,
			bathrooms: dossier.listingSnapshot.bathrooms ?? archive.bathrooms,
			floorText: dossier.listingSnapshot.floorText ?? archive.floorText,
			isExterior: dossier.listingSnapshot.isExterior ?? archive.isExterior,
			hasElevator: dossier.listingSnapshot.hasElevator ?? archive.hasElevator,
			priceIncludesParking:
				dossier.listingSnapshot.priceIncludesParking ?? archive.hasParkingSpace,
		},
		onlineEvidence: mergeOnlineEvidence(
			[dossier],
			[...buildOportunistaOnlineEvidence(archive)],
		),
	};
};

const buildPublicationDurationsFromHistory = (
	history: LocalizaPublicHistoryRow[],
	duplicates: LocalizaDuplicateRecord[],
	dossiers: LocalizaPropertyDossier[],
): LocalizaPublicationDuration[] => {
	const durationsByKey = new Map<string, LocalizaPublicationDuration>();
	const addDuration = (
		label: string | undefined,
		kind: LocalizaPublicationDuration["kind"],
		daysPublished: number | undefined,
	) => {
		const normalizedLabel = cleanDossierText(label);

		if (!normalizedLabel || daysPublished === undefined || daysPublished <= 1) {
			return;
		}

		const key = `${kind}:${normalizedLabel.toUpperCase()}`;
		const existing = durationsByKey.get(key);

		if (!existing || daysPublished > existing.daysPublished) {
			durationsByKey.set(key, {
				label: normalizedLabel,
				kind,
				daysPublished,
			});
		}
	};

	for (const dossier of dossiers) {
		for (const duration of dossier.publicationDurations) {
			addDuration(duration.label, duration.kind, duration.daysPublished);
		}
	}

	for (const row of history) {
		addDuration(row.portal, "portal", row.daysPublished);
		addDuration(row.agencyName, "agency", row.daysPublished);
		addDuration(row.advertiserName, "advertiser", row.daysPublished);
	}

	for (const duplicate of duplicates) {
		const daysPublished = getInclusiveDays(
			duplicate.firstSeenAt,
			duplicate.lastSeenAt,
		);
		addDuration(duplicate.portal, "portal", daysPublished);
		addDuration(duplicate.agencyName, "agency", daysPublished);
		addDuration(duplicate.advertiserName, "advertiser", daysPublished);
	}

	return Array.from(durationsByKey.values())
		.sort((left, right) => right.daysPublished - left.daysPublished)
		.slice(0, 12);
};

const mergeDossierWithPropertyHistory = (
	dossier: LocalizaPropertyDossier,
	historyDossiers: LocalizaPropertyDossier[],
	marketObservations: LocalizaMarketObservation[] = [],
	extraEvidence: LocalizaOnlineEvidenceItem[] = [],
): LocalizaPropertyDossier => {
	const allDossiers = [dossier, ...historyDossiers];
	const marketHistoryRows =
		buildHistoryRowsFromMarketObservations(marketObservations);
	const marketDuplicateRecords =
		buildDuplicateRecordsFromMarketObservations(marketObservations);
	const publicHistory = mergePublicHistoryRows(allDossiers, marketHistoryRows);
	const duplicateRecords = mergeDuplicateRecords(
		publicHistory,
		allDossiers,
		marketDuplicateRecords,
	);
	const publicationDurations = buildPublicationDurationsFromHistory(
		publicHistory,
		duplicateRecords,
		allDossiers,
	);

	return {
		...dossier,
		onlineEvidence: mergeOnlineEvidence(allDossiers, extraEvidence),
		publicHistory,
		duplicateGroup: {
			count: duplicateRecords.length,
			records: duplicateRecords,
		},
		publicationDurations,
	};
};

const hasFreshOportunistaHistory = (input: {
	observations: LocalizaMarketObservation[];
	listingId: string;
	now: number;
}) => {
	const sourceRecordPrefix = `oportunista:${input.listingId}:`;
	const latestUpdateAt = input.observations
		.filter((observation) =>
			observation.sourceRecordId?.startsWith(sourceRecordPrefix),
		)
		.reduce(
			(latest, observation) => Math.max(latest, observation.updatedAt),
			0,
		);

	return (
		latestUpdateAt > 0 &&
		input.now - latestUpdateAt < OPORTUNISTA_PRICE_HISTORY_REFRESH_MS
	);
};

const refreshOportunistaMarketHistory = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	marketHistoryKey: string;
	observations: LocalizaMarketObservation[];
}) => {
	if (!isOportunistaPriceHistoryConfigured()) {
		return {
			observations: input.observations,
			archive: undefined,
		};
	}

	const now = Date.now();

	try {
		const importedIntel = await fetchOportunistaMarketIntel({
			listingId: input.context.sourceMetadata.externalListingId,
			sourceUrl: input.context.sourceMetadata.sourceUrl,
		});
		const shouldImportObservations =
			importedIntel.observations.length > 0 &&
			!hasFreshOportunistaHistory({
				observations: input.observations,
				listingId: input.context.sourceMetadata.externalListingId,
				now,
			});

		if (!shouldImportObservations) {
			return {
				observations: input.observations,
				archive: importedIntel.archive,
			};
		}

		const importResult = await input.convex.mutation(
			upsertMarketObservationsRef,
			{
				observations: importedIntel.observations.map((observation) => ({
					...observation,
					propertyHistoryKey: input.marketHistoryKey,
				})),
				now,
			},
		);

		logLocalizaEvent("info", "localiza.resolve.oportunista_history_imported", {
			...buildResolverLogPayload(input.context),
			marketHistoryKey: input.marketHistoryKey,
			created: importResult.created,
			updated: importResult.updated,
			total: importResult.total,
		});

		return {
			observations: await input.convex.query(getMarketObservationsByKeyRef, {
				propertyHistoryKey: input.marketHistoryKey,
				limit: 160,
			}),
			archive: importedIntel.archive,
		};
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.oportunista_history_failed", {
			...buildResolverLogPayload(input.context),
			marketHistoryKey: input.marketHistoryKey,
			errorMessage: getErrorMessage(error),
		});

		return {
			observations: input.observations,
			archive: undefined,
		};
	}
};

const attachPropertyHistoryToResult = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	result: ResolveIdealistaLocationResult;
	normalizedSignals?: IdealistaSignals;
}) => {
	const propertyHistoryKey = getPropertyHistoryKey(input.result);
	const marketHistoryKey =
		propertyHistoryKey ?? getListingMarketHistoryKey(input.context);

	if (!input.result.propertyDossier) {
		return {
			result: input.result,
			propertyHistoryKey,
		};
	}

	try {
		const [historyDossiers, existingMarketObservations] = await Promise.all([
			propertyHistoryKey
				? input.convex.query(getPropertyHistoryByKeyRef, {
						propertyHistoryKey,
						limit: 50,
					})
				: Promise.resolve([]),
			input.convex.query(getMarketObservationsByKeyRef, {
				propertyHistoryKey: marketHistoryKey,
				limit: 100,
			}),
		]);
		const oportunistaIntel = await refreshOportunistaMarketHistory({
			convex: input.convex,
			context: input.context,
			marketHistoryKey,
			observations: existingMarketObservations,
		});
		const enrichedDossier = mergeDossierWithOportunistaArchive(
			input.result.propertyDossier,
			oportunistaIntel.archive,
		);
		const [
			energyCertificateEvidence,
			buildingConditionEvidence,
			floodRiskEvidence,
			catastroFactsEvidence,
			solarPotentialEvidence,
			locationAmenityEvidence,
			planningHeritageEvidence,
		] = await Promise.all([
			fetchEnergyCertificateEvidence(enrichedDossier),
			fetchEuskoregiteBuildingConditionEvidence(enrichedDossier),
			fetchFloodRiskEvidence({
				result: input.result,
				signals: input.normalizedSignals,
			}),
			fetchCatastroPropertyFactsEvidence(enrichedDossier),
			fetchSolarPotentialEvidence(enrichedDossier),
			fetchLocationAmenityEvidence({
				result: input.result,
				signals: input.normalizedSignals,
			}),
			fetchMadridPlanningHeritageEvidence({
				result: input.result,
				signals: input.normalizedSignals,
			}),
		]);

		return {
			result: {
				...input.result,
				propertyDossier: mergeDossierWithPropertyHistory(
					enrichedDossier,
					historyDossiers,
					oportunistaIntel.observations,
					[
						...buildOportunistaOnlineEvidence(oportunistaIntel.archive),
						...energyCertificateEvidence,
						...buildingConditionEvidence,
						...floodRiskEvidence,
						...catastroFactsEvidence,
						...solarPotentialEvidence,
						...locationAmenityEvidence,
						...planningHeritageEvidence,
					],
				),
			},
			propertyHistoryKey,
		};
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.property_history_failed", {
			...buildResolverLogPayload(input.context),
			propertyHistoryKey,
			marketHistoryKey,
			errorMessage: getErrorMessage(error),
		});

		return {
			result: input.result,
			propertyHistoryKey,
		};
	}
};

const buildUnresolvedResult = (input: {
	context: LocalizaResolutionContext;
	reasonCodes: string[];
	matchedSignals: string[];
	discardedSignals?: string[];
	actualAcquisitionMethod?: ResolveIdealistaLocationResult["evidence"]["actualAcquisitionMethod"];
	resolvedAt: string;
	officialSource?: string;
	officialSourceUrl?: string;
	territoryAdapter?: LocalizaTerritoryAdapter;
	confidenceScore?: number;
	candidates?: ResolveIdealistaLocationResult["candidates"];
	resolvedAddressLabel?: string;
	parcelRef14?: string;
	unitRef20?: string;
	prefillLocation?: ResolveIdealistaLocationResult["prefillLocation"];
	propertyDossier?: LocalizaPropertyDossier;
}): ResolveIdealistaLocationResult => ({
	status: "unresolved",
	requestedStrategy: input.context.requestedStrategy,
	confidenceScore: input.confidenceScore ?? 0,
	officialSource:
		input.officialSource ?? "Pending official cadastral verification",
	officialSourceUrl: input.officialSourceUrl,
	territoryAdapter: input.territoryAdapter,
	resolverVersion: input.context.resolverVersion,
	resolvedAt: input.resolvedAt,
	resolvedAddressLabel: input.resolvedAddressLabel,
	parcelRef14: input.parcelRef14,
	unitRef20: input.unitRef20,
	prefillLocation: input.prefillLocation,
	candidates: input.candidates ?? [],
	evidence: {
		reasonCodes: dedupe(input.reasonCodes),
		matchedSignals: dedupe(input.matchedSignals),
		discardedSignals: dedupe(input.discardedSignals ?? []),
		candidateCount: input.candidates?.length ?? 0,
		requestedStrategy: input.context.requestedStrategy,
		actualAcquisitionMethod: input.actualAcquisitionMethod,
		officialSource:
			input.officialSource ?? "Pending official cadastral verification",
		officialSourceUrl: input.officialSourceUrl,
		territoryAdapter: input.territoryAdapter,
	},
	sourceMetadata: input.context.sourceMetadata,
	propertyDossier: input.propertyDossier,
});

const buildResultFromOfficialResolution = (input: {
	context: LocalizaResolutionContext;
	signals: IdealistaSignals;
	officialResolution: LocalizaOfficialResolution;
	actualAcquisitionMethod: ResolveIdealistaLocationResult["evidence"]["actualAcquisitionMethod"];
	adapterReasonCodes: string[];
	adapterMatchedSignals: string[];
	adapterDiscardedSignals: string[];
	resolvedAt: string;
}): ResolveIdealistaLocationResult => {
	const officialSourceDetails = getOfficialSourceDetails(
		input.officialResolution.territoryAdapter,
	);
	const mergedReasonCodes = dedupe([
		"listing_id_parsed",
		...input.adapterReasonCodes,
		...input.officialResolution.reasonCodes,
	]);
	const mergedMatchedSignals = dedupe([
		"idealista_listing_id",
		...input.adapterMatchedSignals,
		...input.officialResolution.matchedSignals,
	]);
	const mergedDiscardedSignals = dedupe([
		...input.adapterDiscardedSignals,
		...input.officialResolution.discardedSignals,
	]);
	const propertyDossier = buildPropertyDossier({
		context: input.context,
		signals: input.signals,
		resolvedAt: input.resolvedAt,
		officialSource: input.officialResolution.officialSource,
		officialSourceUrl: officialSourceDetails.officialSourceUrl,
		resolvedAddressLabel: input.officialResolution.resolvedAddressLabel,
		parcelRef14: input.officialResolution.parcelRef14,
		unitRef20: input.officialResolution.unitRef20,
		prefillLocation: input.officialResolution.prefillLocation,
		candidates: input.officialResolution.candidates,
	});

	if (input.officialResolution.status === "unresolved") {
		return buildUnresolvedResult({
			context: input.context,
			reasonCodes: mergedReasonCodes,
			matchedSignals: mergedMatchedSignals,
			discardedSignals: mergedDiscardedSignals,
			actualAcquisitionMethod: input.actualAcquisitionMethod,
			resolvedAt: input.resolvedAt,
			officialSource: input.officialResolution.officialSource,
			officialSourceUrl: officialSourceDetails.officialSourceUrl,
			territoryAdapter: input.officialResolution.territoryAdapter,
			confidenceScore: input.officialResolution.confidenceScore,
			candidates: input.officialResolution.candidates,
			resolvedAddressLabel: input.officialResolution.resolvedAddressLabel,
			parcelRef14: input.officialResolution.parcelRef14,
			unitRef20: input.officialResolution.unitRef20,
			prefillLocation: input.officialResolution.prefillLocation,
			propertyDossier,
		});
	}

	return {
		status: input.officialResolution.status,
		requestedStrategy: input.context.requestedStrategy,
		confidenceScore: input.officialResolution.confidenceScore,
		officialSource: input.officialResolution.officialSource,
		officialSourceUrl: officialSourceDetails.officialSourceUrl,
		territoryAdapter: input.officialResolution.territoryAdapter,
		resolverVersion: input.context.resolverVersion,
		resolvedAt: input.resolvedAt,
		resolvedAddressLabel: input.officialResolution.resolvedAddressLabel,
		parcelRef14: input.officialResolution.parcelRef14,
		unitRef20: input.officialResolution.unitRef20,
		prefillLocation: input.officialResolution.prefillLocation,
		candidates: input.officialResolution.candidates,
		evidence: {
			reasonCodes: mergedReasonCodes,
			matchedSignals: mergedMatchedSignals,
			discardedSignals: mergedDiscardedSignals,
			candidateCount: input.officialResolution.candidates.length,
			requestedStrategy: input.context.requestedStrategy,
			actualAcquisitionMethod: input.actualAcquisitionMethod,
			officialSource: input.officialResolution.officialSource,
			officialSourceUrl: officialSourceDetails.officialSourceUrl,
			territoryAdapter: input.officialResolution.territoryAdapter,
		},
		sourceMetadata: input.context.sourceMetadata,
		propertyDossier,
	};
};

const attachCacheExpiry = (
	result: ResolveIdealistaLocationResult,
	expiresAt: number,
): ResolveIdealistaLocationResult => ({
	...result,
	cacheExpiresAt: buildCacheExpiryIso(expiresAt),
});

const buildCadastreFailureResult = (input: {
	context: LocalizaResolutionContext;
	adapterOutput: {
		signals: IdealistaSignals;
		matchedSignals: string[];
		discardedSignals: string[];
		reasonCodes: string[];
	};
	error: unknown;
	resolvedAt: string;
}) => {
	const cadastreFailure = getCadastreFailureDetails(input.error);
	const propertyDossier = buildPropertyDossier({
		context: input.context,
		signals: input.adapterOutput.signals,
		resolvedAt: input.resolvedAt,
		officialSource: cadastreFailure.officialSource,
		officialSourceUrl: cadastreFailure.officialSourceUrl,
	});

	return {
		result: buildUnresolvedResult({
			context: input.context,
			reasonCodes: [
				"listing_id_parsed",
				...input.adapterOutput.reasonCodes,
				"official_cadastre_failed",
				cadastreFailure.reasonCode,
			],
			matchedSignals: [
				...input.adapterOutput.matchedSignals,
				"official_source_attempted",
			],
			discardedSignals: [
				...input.adapterOutput.discardedSignals,
				...(cadastreFailure.territoryAdapter
					? [cadastreFailure.territoryAdapter]
					: []),
			],
			actualAcquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
			resolvedAt: input.resolvedAt,
			officialSource: cadastreFailure.officialSource,
			officialSourceUrl: cadastreFailure.officialSourceUrl,
			territoryAdapter: cadastreFailure.territoryAdapter,
			propertyDossier,
		}),
		normalizedSignals: input.adapterOutput.signals,
		errorCode: "official_cadastre_failed",
		errorMessage: getErrorMessage(input.error),
	};
};

const resolveAdapterOutputAgainstCatastro = async (input: {
	context: LocalizaResolutionContext;
	adapterOutput: LocalizaAdapterOutput;
	deadlineAt: number;
}) => {
	const remainingDeadlineMs = input.deadlineAt - Date.now();

	if (remainingDeadlineMs <= 0) {
		const resolvedAt = new Date().toISOString();
		const pendingSourceDetails = getOfficialSourceDetails();
		return {
			result: buildUnresolvedResult({
				context: input.context,
				reasonCodes: [
					"listing_id_parsed",
					...input.adapterOutput.reasonCodes,
					"resolver_deadline_exceeded",
				],
				matchedSignals: input.adapterOutput.matchedSignals,
				discardedSignals: input.adapterOutput.discardedSignals,
				actualAcquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
				resolvedAt,
				propertyDossier: buildPropertyDossier({
					context: input.context,
					signals: input.adapterOutput.signals,
					resolvedAt,
					officialSource: pendingSourceDetails.officialSource,
					officialSourceUrl: pendingSourceDetails.officialSourceUrl,
				}),
			}),
			normalizedSignals: input.adapterOutput.signals,
			errorCode: "resolver_deadline_exceeded",
			errorMessage:
				"The resolver deadline was exceeded before official matching.",
		};
	}

	let officialResolution: LocalizaOfficialResolution;
	const cadastreStartedAt = Date.now();

	try {
		logLocalizaEvent("info", "localiza.resolve.catastro_started", {
			...buildResolverLogPayload(input.context),
			acquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
		});
		officialResolution = await withTimeout(
			(signal) =>
				resolveStateCatastro({
					signals: input.adapterOutput.signals,
					signal,
				}),
			remainingDeadlineMs,
			"state_catastro",
		);
	} catch (error) {
		const cadastreFailure = getCadastreFailureDetails(error);
		logLocalizaEvent("error", "localiza.resolve.catastro_failed", {
			...buildResolverLogPayload(input.context),
			acquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
			territoryAdapter: cadastreFailure.territoryAdapter,
			officialSource: cadastreFailure.officialSource,
			officialSourceUrl: cadastreFailure.officialSourceUrl,
			durationMs: Date.now() - cadastreStartedAt,
			errorMessage: getErrorMessage(error),
		});
		const addressEvidenceResolution = buildAddressEvidenceResolution({
			signals: input.adapterOutput.signals,
			cadastreFailure,
		});

		if (addressEvidenceResolution) {
			const resolvedAt = new Date().toISOString();
			return {
				result: buildResultFromOfficialResolution({
					context: input.context,
					signals: input.adapterOutput.signals,
					officialResolution: addressEvidenceResolution,
					actualAcquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
					adapterReasonCodes: input.adapterOutput.reasonCodes,
					adapterMatchedSignals: input.adapterOutput.matchedSignals,
					adapterDiscardedSignals: input.adapterOutput.discardedSignals,
					resolvedAt,
				}),
				normalizedSignals: input.adapterOutput.signals,
				errorCode: cadastreFailure.reasonCode,
				errorMessage: getErrorMessage(error),
			};
		}

		return buildCadastreFailureResult({
			context: input.context,
			adapterOutput: input.adapterOutput,
			error,
			resolvedAt: new Date().toISOString(),
		});
	}

	officialResolution = maybePreferConfirmedAddressEvidence({
		signals: input.adapterOutput.signals,
		officialResolution,
	});

	officialResolution = await maybeApplyMapsVerification({
		context: input.context,
		signals: input.adapterOutput.signals,
		officialResolution,
		deadlineAt: input.deadlineAt,
	});

	const resolvedAt = new Date().toISOString();
	const result = buildResultFromOfficialResolution({
		context: input.context,
		signals: input.adapterOutput.signals,
		officialResolution,
		actualAcquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
		adapterReasonCodes: input.adapterOutput.reasonCodes,
		adapterMatchedSignals: input.adapterOutput.matchedSignals,
		adapterDiscardedSignals: input.adapterOutput.discardedSignals,
		resolvedAt,
	});

	logLocalizaEvent("info", "localiza.resolve.catastro_completed", {
		...buildResolverLogPayload(input.context),
		acquisitionMethod: input.adapterOutput.signals.acquisitionMethod,
		territoryAdapter: officialResolution.territoryAdapter,
		officialSource: result.officialSource,
		officialSourceUrl: result.officialSourceUrl,
		status: result.status,
		candidateCount: result.candidates.length,
		confidenceScore: result.confidenceScore,
		durationMs: Date.now() - cadastreStartedAt,
	});

	return {
		result,
		normalizedSignals: input.adapterOutput.signals,
		errorCode:
			officialResolution.status === "unresolved"
				? "official_resolution_unresolved"
				: undefined,
		errorMessage:
			officialResolution.status === "unresolved"
				? "Official cadastral matching did not produce a verified result."
				: undefined,
	};
};

const resolveStrategySequence = (
	requestedStrategy: LocalizaAcquisitionStrategy,
): LocalizaAdapterMethod[] =>
	requestedStrategy === "auto"
		? LOCALIZA_BETA_AUTO_STRATEGY_ORDER
		: [requestedStrategy];

const getResultCacheTtlMs = (
	status: ResolveIdealistaLocationResult["status"],
) => (status === "unresolved" ? UNRESOLVED_CACHE_TTL_MS : SUCCESS_CACHE_TTL_MS);

const loadCachedRecord = async (
	convex: ConvexHttpClient,
	context: LocalizaResolutionContext,
) =>
	await convex.query(getLocationResolutionByLookupRef, {
		provider: context.sourceMetadata.provider,
		externalListingId: context.sourceMetadata.externalListingId,
		requestedStrategy: context.requestedStrategy,
		resolverVersion: context.resolverVersion,
	});

const loadCachedRecordSafely = async (
	convex: ConvexHttpClient,
	context: LocalizaResolutionContext,
) => {
	try {
		return {
			cacheAvailable: true,
			record: await loadCachedRecord(convex, context),
		};
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.cache_read_failed", {
			...buildResolverLogPayload(context),
			errorMessage: getErrorMessage(error),
		});

		return {
			cacheAvailable: false,
			record: null,
		};
	}
};

const loadLatestSuccessfulRecordBySourceUrlSafely = async (
	convex: ConvexHttpClient,
	sourceUrl: string,
	context: LocalizaResolutionContext,
) => {
	try {
		return await convex.query(
			getLatestSuccessfulLocationResolutionBySourceUrlRef,
			{ sourceUrl },
		);
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.stale_lookup_failed", {
			...buildResolverLogPayload(context),
			errorMessage: getErrorMessage(error),
		});
		return null;
	}
};

const claimLeaseSafely = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	leaseOwner: string;
	now: number;
}) => {
	try {
		return await input.convex.mutation(claimLocationResolutionLeaseRef, {
			provider: input.context.sourceMetadata.provider,
			externalListingId: input.context.sourceMetadata.externalListingId,
			sourceUrl: input.context.sourceMetadata.sourceUrl,
			requestedStrategy: input.context.requestedStrategy,
			resolverVersion: input.context.resolverVersion,
			leaseOwner: input.leaseOwner,
			leaseDurationMs: LEASE_DURATION_MS,
			defaultExpiresAt: input.now + UNRESOLVED_CACHE_TTL_MS,
			now: input.now,
		});
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.cache_lease_failed", {
			...buildResolverLogPayload(input.context),
			errorMessage: getErrorMessage(error),
		});

		return null;
	}
};

const persistResult = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	leaseOwner: string;
	result: ResolveIdealistaLocationResult;
	normalizedSignals?: IdealistaSignals;
	propertyHistoryKey?: string;
	now: number;
	expiresAt: number;
	errorCode?: string;
	errorMessage?: string;
}) => {
	const resultWithCache = attachCacheExpiry(input.result, input.expiresAt);

	await input.convex.mutation(completeLocationResolutionRef, {
		provider: input.context.sourceMetadata.provider,
		externalListingId: input.context.sourceMetadata.externalListingId,
		sourceUrl: input.context.sourceMetadata.sourceUrl,
		requestedStrategy: input.context.requestedStrategy,
		resolverVersion: input.context.resolverVersion,
		leaseOwner: input.leaseOwner,
		result: resultWithCache,
		normalizedSignals: input.normalizedSignals,
		propertyHistoryKey:
			input.propertyHistoryKey ?? getPropertyHistoryKey(resultWithCache),
		expiresAt: input.expiresAt,
		now: input.now,
		errorCode: input.errorCode,
		errorMessage: input.errorMessage,
	});

	return resultWithCache;
};

const persistResultSafely = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	leaseOwner: string | null;
	result: ResolveIdealistaLocationResult;
	normalizedSignals?: IdealistaSignals;
	propertyHistoryKey?: string;
	now: number;
	expiresAt: number;
	errorCode?: string;
	errorMessage?: string;
}) => {
	if (!input.leaseOwner) {
		return input.result;
	}

	try {
		return await persistResult({
			...input,
			leaseOwner: input.leaseOwner,
		});
	} catch (error) {
		logLocalizaEvent("warn", "localiza.resolve.cache_write_failed", {
			...buildResolverLogPayload(input.context),
			errorMessage: getErrorMessage(error),
		});

		return input.result;
	}
};

const waitForInFlightResolution = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	deadlineAt: number;
}) => {
	while (Date.now() < input.deadlineAt) {
		const cachedRecordResult = await loadCachedRecordSafely(
			input.convex,
			input.context,
		);

		if (!cachedRecordResult.cacheAvailable) {
			return null;
		}

		const cachedRecord = cachedRecordResult.record;

		if (isFreshCachedResult(cachedRecord, Date.now())) {
			const cachedResult = attachCacheExpiry(
				cachedRecord.result,
				cachedRecord.expiresAt,
			);
			const historyResult = await attachPropertyHistoryToResult({
				convex: input.convex,
				context: input.context,
				result: cachedResult,
				normalizedSignals: cachedRecord.normalizedSignals,
			});

			return historyResult.result;
		}

		await sleep(IN_FLIGHT_POLL_INTERVAL_MS);
	}

	return null;
};

const buildStaleSuccessfulAdapterOutput = (
	record: LocalizaCachedResolutionRecord,
	context: LocalizaResolutionContext,
): LocalizaAdapterOutput | null => {
	const signals = record.normalizedSignals;

	if (!signals || signals.provider !== "idealista") {
		return null;
	}

	return {
		signals: {
			...signals,
			sourceUrl: context.sourceMetadata.sourceUrl,
			listingId: context.sourceMetadata.externalListingId,
		},
		matchedSignals: dedupe([
			"idealista_listing_id",
			"stale_successful_acquisition_signals",
			...(record.result?.evidence.matchedSignals ?? []),
		]),
		discardedSignals: record.result?.evidence.discardedSignals ?? [],
		reasonCodes: dedupe([
			"stale_successful_acquisition_reused",
			`stale_resolver_version_${record.resolverVersion}`,
			...(record.result?.evidence.reasonCodes ?? []),
		]),
	};
};

const resolveSignalsViaAdapters = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	sourceUrl: string;
	externalListingId: string;
	deadlineAt: number;
}) => {
	const strategySequence = resolveStrategySequence(
		input.context.requestedStrategy,
	);
	const adapterFailureCodes: string[] = [];

	for (const strategy of strategySequence) {
		const adapter = adapterRegistry[strategy];

		if (!adapter.isConfigured()) {
			adapterFailureCodes.push(`${strategy}_not_configured`);
			logLocalizaEvent("warn", "localiza.resolve.adapter_not_configured", {
				...buildResolverLogPayload(input.context),
				attemptedAdapter: strategy,
			});

			if (input.context.requestedStrategy !== "auto") {
				return {
					result: buildUnresolvedResult({
						context: input.context,
						reasonCodes: [
							"listing_id_parsed",
							"selected_strategy_not_configured",
							`${strategy}_not_configured`,
						],
						matchedSignals: ["idealista_listing_id"],
						discardedSignals: [strategy],
						resolvedAt: new Date().toISOString(),
					}),
					normalizedSignals: undefined,
					errorCode: "adapter_not_configured",
					errorMessage: `${strategy} is not configured in this environment.`,
				};
			}

			continue;
		}

		let adapterOutput: LocalizaAdapterOutput;
		const adapterStartedAt = Date.now();

		try {
			logLocalizaEvent("info", "localiza.resolve.adapter_started", {
				...buildResolverLogPayload(input.context),
				attemptedAdapter: strategy,
			});
			adapterOutput = await withTimeout(
				(signal) =>
					adapter.acquireSignals({
						listingId: input.externalListingId,
						sourceUrl: input.sourceUrl,
						signal,
					}),
				adapter.timeoutMs,
				adapter.method,
			);
			logLocalizaEvent("info", "localiza.resolve.adapter_completed", {
				...buildResolverLogPayload(input.context),
				attemptedAdapter: strategy,
				acquisitionMethod: adapterOutput.signals.acquisitionMethod,
				durationMs: Date.now() - adapterStartedAt,
				hasCoordinates:
					adapterOutput.signals.approximateLat !== undefined &&
					adapterOutput.signals.approximateLng !== undefined,
				hasMunicipality: Boolean(adapterOutput.signals.municipality),
				hasProvince: Boolean(adapterOutput.signals.province),
				hasPostalCode: Boolean(adapterOutput.signals.postalCodeHint),
			});
			adapterOutput = await enrichAdapterOutputWithOportunistaSignals({
				context: input.context,
				adapterOutput,
			});
			adapterOutput = await enrichAdapterOutputWithIndexedDuplicateAddress({
				context: input.context,
				adapterOutput,
			});
			adapterOutput = enrichAdapterOutputWithConfirmedAddressEvidence({
				adapterOutput,
			});
		} catch (error) {
			adapterFailureCodes.push(`${strategy}_failed`);
			logLocalizaEvent("warn", "localiza.resolve.adapter_failed", {
				...buildResolverLogPayload(input.context),
				attemptedAdapter: strategy,
				durationMs: Date.now() - adapterStartedAt,
				errorMessage: getErrorMessage(error),
			});

			if (input.context.requestedStrategy !== "auto") {
				return {
					result: buildUnresolvedResult({
						context: input.context,
						reasonCodes: [
							"listing_id_parsed",
							"selected_strategy_failed",
							`${strategy}_failed`,
						],
						matchedSignals: ["idealista_listing_id"],
						discardedSignals: [strategy],
						resolvedAt: new Date().toISOString(),
					}),
					normalizedSignals: undefined,
					errorCode: "adapter_failed",
					errorMessage: getErrorMessage(error),
				};
			}

			continue;
		}

		return await resolveAdapterOutputAgainstCatastro({
			context: input.context,
			adapterOutput,
			deadlineAt: input.deadlineAt,
		});
	}

	if (input.context.requestedStrategy === "auto") {
		const staleRecord = await loadLatestSuccessfulRecordBySourceUrlSafely(
			input.convex,
			input.sourceUrl,
			input.context,
		);
		const staleAdapterOutput = staleRecord
			? buildStaleSuccessfulAdapterOutput(staleRecord, input.context)
			: null;

		if (staleAdapterOutput) {
			logLocalizaEvent("info", "localiza.resolve.stale_acquisition_reused", {
				...buildResolverLogPayload(input.context),
				staleResolverVersion: staleRecord?.resolverVersion,
				staleUpdatedAt: staleRecord?.updatedAt,
				adapterFailureCodes,
			});

			return await resolveAdapterOutputAgainstCatastro({
				context: input.context,
				adapterOutput: staleAdapterOutput,
				deadlineAt: input.deadlineAt,
			});
		}
	}

	const confirmedFallback = buildConfirmedAddressFallbackAdapterOutput({
		sourceUrl: input.sourceUrl,
		externalListingId: input.externalListingId,
		adapterFailureCodes,
	});

	if (confirmedFallback) {
		logLocalizaEvent("info", "localiza.resolve.confirmed_evidence_fallback", {
			...buildResolverLogPayload(input.context),
			adapterFailureCodes,
		});

		return await resolveAdapterOutputAgainstCatastro({
			context: input.context,
			adapterOutput: confirmedFallback,
			deadlineAt: input.deadlineAt,
		});
	}

	logLocalizaEvent("warn", "localiza.resolve.no_adapter_available", {
		...buildResolverLogPayload(input.context),
		adapterFailureCodes,
	});

	return {
		result: buildUnresolvedResult({
			context: input.context,
			reasonCodes:
				input.context.requestedStrategy === "auto"
					? [
							"listing_id_parsed",
							"auto_no_configured_or_successful_adapter",
							...adapterFailureCodes,
						]
					: ["listing_id_parsed", "selected_strategy_not_configured"],
			matchedSignals: ["idealista_listing_id"],
			resolvedAt: new Date().toISOString(),
		}),
		normalizedSignals: undefined,
		errorCode:
			input.context.requestedStrategy === "auto"
				? "no_adapter_available"
				: "adapter_not_configured",
		errorMessage:
			input.context.requestedStrategy === "auto"
				? "No Localiza acquisition adapter could complete this request."
				: "The selected Localiza acquisition adapter is not configured.",
	};
};

export const resolveIdealistaLocation = async (input: {
	convex: ConvexHttpClient;
	url: string;
	strategy: LocalizaAcquisitionStrategy;
	userId?: string;
}) => {
	const normalized = parseIdealistaListingUrl(input.url);
	const now = Date.now();
	const startedAt = now;
	const deadlineAt = now + OVERALL_DEADLINE_MS;
	const context: LocalizaResolutionContext = {
		sourceMetadata: buildSourceMetadata(normalized),
		requestedStrategy: input.strategy ?? "auto",
		resolverVersion: LOCALIZA_RESOLVER_VERSION,
		userId: input.userId,
	};

	logLocalizaEvent("info", "localiza.resolve.started", {
		...buildResolverLogPayload(context),
	});

	const cachedRecordResult = await loadCachedRecordSafely(
		input.convex,
		context,
	);
	const cachedRecord = cachedRecordResult.record;

	if (isFreshCachedResult(cachedRecord, now)) {
		logLocalizaEvent("info", "localiza.resolve.cache_hit", {
			...buildResolverLogPayload(context),
			status: cachedRecord.result.status,
			officialSource: cachedRecord.result.officialSource,
			officialSourceUrl: cachedRecord.result.officialSourceUrl,
			territoryAdapter: cachedRecord.result.territoryAdapter,
			durationMs: Date.now() - startedAt,
		});
		const cachedResult = attachCacheExpiry(
			cachedRecord.result,
			cachedRecord.expiresAt,
		);
		const historyResult = await attachPropertyHistoryToResult({
			convex: input.convex,
			context,
			result: cachedResult,
			normalizedSignals: cachedRecord.normalizedSignals,
		});

		return historyResult.result;
	}

	const leaseOwner = cachedRecordResult.cacheAvailable
		? crypto.randomUUID()
		: null;
	const leaseResult = leaseOwner
		? await claimLeaseSafely({
				convex: input.convex,
				context,
				leaseOwner,
				now,
			})
		: null;

	if (leaseResult?.kind === "cached") {
		const cachedAfterLeaseResult = await loadCachedRecordSafely(
			input.convex,
			context,
		);
		const cachedAfterLease = cachedAfterLeaseResult.record;

		if (isFreshCachedResult(cachedAfterLease, Date.now())) {
			logLocalizaEvent("info", "localiza.resolve.cache_hit_after_lease", {
				...buildResolverLogPayload(context),
				status: cachedAfterLease.result.status,
				officialSource: cachedAfterLease.result.officialSource,
				officialSourceUrl: cachedAfterLease.result.officialSourceUrl,
				territoryAdapter: cachedAfterLease.result.territoryAdapter,
				durationMs: Date.now() - startedAt,
			});
			const cachedResult = attachCacheExpiry(
				cachedAfterLease.result,
				cachedAfterLease.expiresAt,
			);
			const historyResult = await attachPropertyHistoryToResult({
				convex: input.convex,
				context,
				result: cachedResult,
				normalizedSignals: cachedAfterLease.normalizedSignals,
			});

			return historyResult.result;
		}
	}

	if (leaseResult?.kind === "in_flight") {
		logLocalizaEvent("info", "localiza.resolve.waiting_for_in_flight_result", {
			...buildResolverLogPayload(context),
		});
		const inFlightResult = await waitForInFlightResolution({
			convex: input.convex,
			context,
			deadlineAt,
		});

		if (inFlightResult) {
			logLocalizaEvent("info", "localiza.resolve.reused_in_flight_result", {
				...buildResolverLogPayload(context),
				status: inFlightResult.status,
				officialSource: inFlightResult.officialSource,
				officialSourceUrl: inFlightResult.officialSourceUrl,
				territoryAdapter: inFlightResult.territoryAdapter,
				durationMs: Date.now() - startedAt,
			});
			return inFlightResult;
		}

		logLocalizaEvent("warn", "localiza.resolve.in_flight_wait_timed_out", {
			...buildResolverLogPayload(context),
			durationMs: Date.now() - startedAt,
		});
		return buildUnresolvedResult({
			context,
			reasonCodes: [
				"listing_id_parsed",
				"in_flight_lease_wait_timeout",
				"resolver_deadline_exceeded",
			],
			matchedSignals: ["idealista_listing_id"],
			resolvedAt: new Date().toISOString(),
		});
	}

	const adapterResolution = await resolveSignalsViaAdapters({
		convex: input.convex,
		context,
		sourceUrl: context.sourceMetadata.sourceUrl,
		externalListingId: context.sourceMetadata.externalListingId,
		deadlineAt,
	});

	const expiresAt =
		Date.now() + getResultCacheTtlMs(adapterResolution.result.status);
	const historyResult = await attachPropertyHistoryToResult({
		convex: input.convex,
		context,
		result: adapterResolution.result,
		normalizedSignals: adapterResolution.normalizedSignals,
	});

	const persistedResult = await persistResultSafely({
		convex: input.convex,
		context,
		leaseOwner,
		result: historyResult.result,
		normalizedSignals: adapterResolution.normalizedSignals,
		propertyHistoryKey: historyResult.propertyHistoryKey,
		now: Date.now(),
		expiresAt,
		errorCode: adapterResolution.errorCode,
		errorMessage: adapterResolution.errorMessage,
	});

	logLocalizaEvent("info", "localiza.resolve.completed", {
		...buildResolverLogPayload(context),
		status: persistedResult.status,
		officialSource: persistedResult.officialSource,
		officialSourceUrl: persistedResult.officialSourceUrl,
		territoryAdapter: persistedResult.territoryAdapter,
		actualAcquisitionMethod: persistedResult.evidence.actualAcquisitionMethod,
		candidateCount: persistedResult.candidates.length,
		confidenceScore: persistedResult.confidenceScore,
		cacheExpiresAt: persistedResult.cacheExpiresAt,
		durationMs: Date.now() - startedAt,
	});

	return persistedResult;
};
