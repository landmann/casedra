import type {
	IdealistaSignals,
	LocalizaPropertyDossier,
	LocalizaAcquisitionStrategy,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { LOCALIZA_BETA_AUTO_STRATEGY_ORDER } from "./acquisition-contract";
import { browserWorkerAdapter } from "./browser-worker-adapter";
import { resolveStateCatastro } from "./catastro-state";
import { firecrawlAdapter } from "./firecrawl-adapter";
import { idealistaApiAdapter } from "./idealista-adapter";
import { verifyIdealistaMaps } from "./maps-verifier";
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
		expiresAt: number;
		now: number;
		errorCode?: string;
		errorMessage?: string;
	},
	{ id: string }
>("locationResolutions:complete");

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
			(input.officialResolution.confidenceScore + verification.confidenceBoost).toFixed(
				2,
			),
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
		prefillLocation?.postalCode ??
		parts?.find((part) => /^\d{5}$/.test(part));
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
		signals.imageObservations ??
		fallbackObservations;

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
	const leadImageUrl =
		input.signals.primaryImageUrl ??
		imageGallery[0]?.imageUrl ??
		input.signals.imageUrls?.[0];
	const proposedAddressLabel =
		input.resolvedAddressLabel ?? input.candidates?.[0]?.label;
	const officialComponents = parseOfficialAddressComponents(
		proposedAddressLabel,
		input.prefillLocation,
	);
	const observedAt = input.signals.acquiredAt || input.resolvedAt;
	const daysPublished = Math.max(
		1,
		Math.round(input.signals.daysPublished ?? 1),
	);
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
		publicationDurations.push({
			label: normalizedLabel,
			kind,
			daysPublished,
		});
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
		officialIdentity: {
			proposedAddressLabel,
			...officialComponents,
			municipality:
				officialComponents.municipality ?? cleanDossierText(input.signals.municipality),
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

const persistResult = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	leaseOwner: string;
	result: ResolveIdealistaLocationResult;
	normalizedSignals?: IdealistaSignals;
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
		expiresAt: input.expiresAt,
		now: input.now,
		errorCode: input.errorCode,
		errorMessage: input.errorMessage,
	});

	return resultWithCache;
};

const waitForInFlightResolution = async (input: {
	convex: ConvexHttpClient;
	context: LocalizaResolutionContext;
	deadlineAt: number;
}) => {
	while (Date.now() < input.deadlineAt) {
		const cachedRecord = await loadCachedRecord(input.convex, input.context);

		if (isFreshCachedResult(cachedRecord, Date.now())) {
			return attachCacheExpiry(cachedRecord.result, cachedRecord.expiresAt);
		}

		await sleep(IN_FLIGHT_POLL_INTERVAL_MS);
	}

	return null;
};

const resolveSignalsViaAdapters = async (input: {
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

		const remainingDeadlineMs = input.deadlineAt - Date.now();

		if (remainingDeadlineMs <= 0) {
			const resolvedAt = new Date().toISOString();
			const pendingSourceDetails = getOfficialSourceDetails();
			return {
				result: buildUnresolvedResult({
					context: input.context,
					reasonCodes: [
						"listing_id_parsed",
						...adapterOutput.reasonCodes,
						"resolver_deadline_exceeded",
					],
					matchedSignals: adapterOutput.matchedSignals,
					discardedSignals: adapterOutput.discardedSignals,
					actualAcquisitionMethod: adapterOutput.signals.acquisitionMethod,
					resolvedAt,
					propertyDossier: buildPropertyDossier({
						context: input.context,
						signals: adapterOutput.signals,
						resolvedAt,
						officialSource: pendingSourceDetails.officialSource,
						officialSourceUrl: pendingSourceDetails.officialSourceUrl,
					}),
				}),
				normalizedSignals: adapterOutput.signals,
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
				acquisitionMethod: adapterOutput.signals.acquisitionMethod,
			});
			officialResolution = await withTimeout(
				(signal) =>
					resolveStateCatastro({
						signals: adapterOutput.signals,
						signal,
					}),
				remainingDeadlineMs,
				"state_catastro",
			);
		} catch (error) {
			const cadastreFailure = getCadastreFailureDetails(error);
			logLocalizaEvent("error", "localiza.resolve.catastro_failed", {
				...buildResolverLogPayload(input.context),
				acquisitionMethod: adapterOutput.signals.acquisitionMethod,
				territoryAdapter: cadastreFailure.territoryAdapter,
				officialSource: cadastreFailure.officialSource,
				officialSourceUrl: cadastreFailure.officialSourceUrl,
				durationMs: Date.now() - cadastreStartedAt,
				errorMessage: getErrorMessage(error),
			});
			return buildCadastreFailureResult({
				context: input.context,
				adapterOutput,
				error,
				resolvedAt: new Date().toISOString(),
			});
		}

		officialResolution = await maybeApplyMapsVerification({
			context: input.context,
			signals: adapterOutput.signals,
			officialResolution,
			deadlineAt: input.deadlineAt,
		});

		const resolvedAt = new Date().toISOString();
		const result = buildResultFromOfficialResolution({
			context: input.context,
			signals: adapterOutput.signals,
			officialResolution,
			actualAcquisitionMethod: adapterOutput.signals.acquisitionMethod,
			adapterReasonCodes: adapterOutput.reasonCodes,
			adapterMatchedSignals: adapterOutput.matchedSignals,
			adapterDiscardedSignals: adapterOutput.discardedSignals,
			resolvedAt,
		});

		logLocalizaEvent("info", "localiza.resolve.catastro_completed", {
			...buildResolverLogPayload(input.context),
			acquisitionMethod: adapterOutput.signals.acquisitionMethod,
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
			normalizedSignals: adapterOutput.signals,
			errorCode:
				officialResolution.status === "unresolved"
					? "official_resolution_unresolved"
					: undefined,
			errorMessage:
				officialResolution.status === "unresolved"
					? "Official cadastral matching did not produce a verified result."
					: undefined,
		};
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

	const cachedRecord = await loadCachedRecord(input.convex, context);

	if (isFreshCachedResult(cachedRecord, now)) {
		logLocalizaEvent("info", "localiza.resolve.cache_hit", {
			...buildResolverLogPayload(context),
			status: cachedRecord.result.status,
			officialSource: cachedRecord.result.officialSource,
			officialSourceUrl: cachedRecord.result.officialSourceUrl,
			territoryAdapter: cachedRecord.result.territoryAdapter,
			durationMs: Date.now() - startedAt,
		});
		return attachCacheExpiry(cachedRecord.result, cachedRecord.expiresAt);
	}

	const leaseOwner = crypto.randomUUID();
	const leaseResult = await input.convex.mutation(
		claimLocationResolutionLeaseRef,
		{
			provider: context.sourceMetadata.provider,
			externalListingId: context.sourceMetadata.externalListingId,
			sourceUrl: context.sourceMetadata.sourceUrl,
			requestedStrategy: context.requestedStrategy,
			resolverVersion: context.resolverVersion,
			leaseOwner,
			leaseDurationMs: LEASE_DURATION_MS,
			defaultExpiresAt: now + UNRESOLVED_CACHE_TTL_MS,
			now,
		},
	);

	if (leaseResult.kind === "cached") {
		const cachedAfterLease = await loadCachedRecord(input.convex, context);

		if (isFreshCachedResult(cachedAfterLease, Date.now())) {
			logLocalizaEvent("info", "localiza.resolve.cache_hit_after_lease", {
				...buildResolverLogPayload(context),
				status: cachedAfterLease.result.status,
				officialSource: cachedAfterLease.result.officialSource,
				officialSourceUrl: cachedAfterLease.result.officialSourceUrl,
				territoryAdapter: cachedAfterLease.result.territoryAdapter,
				durationMs: Date.now() - startedAt,
			});
			return attachCacheExpiry(
				cachedAfterLease.result,
				cachedAfterLease.expiresAt,
			);
		}
	}

	if (leaseResult.kind === "in_flight") {
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
		context,
		sourceUrl: context.sourceMetadata.sourceUrl,
		externalListingId: context.sourceMetadata.externalListingId,
		deadlineAt,
	});

	const expiresAt =
		Date.now() + getResultCacheTtlMs(adapterResolution.result.status);

	const persistedResult = await persistResult({
		convex: input.convex,
		context,
		leaseOwner,
		result: adapterResolution.result,
		normalizedSignals: adapterResolution.normalizedSignals,
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
