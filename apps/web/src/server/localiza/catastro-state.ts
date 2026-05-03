import type {
	IdealistaSignals,
	ListingLocation,
	ResolveIdealistaLocationCandidate,
} from "@casedra/types";

import {
	buildListingSignalCorpus,
	buildSearchRadii,
	classifyLocalizaCandidateOutcome,
	convertWgs84ToWebMercator,
	corpusIncludesDesignator,
	corpusIncludesPhrase,
	dedupeStrings,
	detectRegionalTerritory,
	distanceBetweenPoints,
	formatPostalCode,
	getProvinceNameFromCode,
	hasStreetNameHint,
	humanizePlaceName,
	humanizeStreetName,
	LOCALIZA_MIN_VIABLE_SCORE,
	normalizeLocalizaText,
	provinceMatchesHint,
} from "./score";
import { resolveAlavaCatastro } from "./catastro-alava";
import { resolveBizkaiaCatastro } from "./catastro-bizkaia";
import {
	fetchStateCallejeroFactFit,
	resolveStateCatastroByCallejero,
} from "./catastro-callejero";
import { resolveGipuzkoaCatastro } from "./catastro-gipuzkoa";
import { resolveNavarraCatastro } from "./catastro-navarra";
import type { LocalizaOfficialResolution, LocalizaTerritoryAdapter } from "./types";
import { officialSourceLabelByTerritory } from "./types";

const CATASTRO_WFS_URL = "https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx";
const MAX_RESULTS_PER_REQUEST = 120;
const MIN_VIABLE_SCORE = LOCALIZA_MIN_VIABLE_SCORE;
const BASE_FACT_FIT_CANDIDATE_LIMIT = 10;
const BROAD_FACT_FIT_CANDIDATE_LIMIT = 40;
const FACT_FIT_BATCH_SIZE = 8;
const NUMBERED_STREET_SIGNAL_PATTERN =
	/\b(calle|cl|c\/|c|avenida|avda\.?|av|plaza|pz|paseo|ps|camino|cm|carretera|ctra|cr|ronda|rda|traves[ií]a|tr)\s+[^\n.;]{3,95}?\s*,?\s+\d{1,4}\b/i;
const VIRTUAL_TOUR_STREET_HINT_PATTERN =
	/\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ .'´-]{2,64}?)\s+-\s+(?:Matterport\s+)?3D\s+Showcase\b/g;
const STREET_PREFIX_PATTERN =
	/^(calle|cl|c|avenida|avda|av|plaza|pz|paseo|ps|camino|cm|carretera|ctra|cr|ronda|rda|travesia|tr|urbanizacion|urb|ur|poligono|pg)\s+/;
const STREET_ARTICLE_PATTERN = /^(de|del|la|las|los|el)\s+/;

interface CatastroComponentMaps {
	thoroughfares: Map<string, string>;
	postalCodes: Map<string, string>;
	adminUnits: Map<
		string,
		{
			municipality?: string;
			provinceCode?: string;
			provinceName?: string;
		}
	>;
}

interface ParsedCatastroAddress {
	id: string;
	localId: string;
	parcelRef14?: string;
	specification?: string;
	designator?: string;
	streetName?: string;
	municipality?: string;
	provinceCode?: string;
	provinceName?: string;
	postalCode?: string;
	point: {
		x: number;
		y: number;
	};
}

interface ScoredCatastroCandidate {
	candidate: ResolveIdealistaLocationCandidate;
	matchedSignals: string[];
	discardedSignals: string[];
	specification?: string;
	streetName?: string;
	designator?: string;
	municipality?: string;
	provinceName?: string;
	postalCode?: string;
	distanceMeters?: number;
}

const decodeXmlEntities = (value?: string) => {
	if (!value) {
		return undefined;
	}

	return value
		.replace(/&amp;/g, "&")
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#(\d+);/g, (_, code: string) =>
			String.fromCharCode(Number(code)),
		)
		.replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
			String.fromCharCode(parseInt(code, 16)),
		);
};

const collectFeatureBlocks = (xml: string, tagName: string) => {
	const matcher = new RegExp(
		`<${tagName}[^>]*gml:id="([^"]+)"[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
		"g",
	);

	const matches: Array<{ id: string; body: string }> = [];

	for (const match of xml.matchAll(matcher)) {
		matches.push({
			id: match[1],
			body: match[2],
		});
	}

	return matches;
};

const readSingleTag = (body: string, tagName: string) => {
	const match = body.match(
		new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`),
	);
	return decodeXmlEntities(match?.[1]?.trim());
};

const readLocatorDesignator = (body: string) => {
	const match = body.match(
		/<ad:LocatorDesignator>[\s\S]*?<ad:designator>([\s\S]*?)<\/ad:designator>[\s\S]*?<\/ad:LocatorDesignator>/,
	);
	return decodeXmlEntities(match?.[1]?.trim());
};

const readComponentRefs = (body: string) => {
	const componentMatcher = /<ad:component xlink:href="#([^"]+)"\s*\/>/g;
	const refs: string[] = [];

	for (const match of body.matchAll(componentMatcher)) {
		refs.push(match[1]);
	}

	return refs;
};

const parseComponentMaps = (xml: string): CatastroComponentMaps => {
	const thoroughfares = new Map<string, string>();
	const postalCodes = new Map<string, string>();
	const adminUnits = new Map<
		string,
		{
			municipality?: string;
			provinceCode?: string;
			provinceName?: string;
		}
	>();

	for (const feature of collectFeatureBlocks(xml, "ad:ThoroughfareName")) {
		const streetName = readSingleTag(feature.body, "gn:text");

		if (streetName) {
			thoroughfares.set(feature.id, streetName);
		}
	}

	for (const feature of collectFeatureBlocks(xml, "ad:PostalDescriptor")) {
		const postalCode = formatPostalCode(
			readSingleTag(feature.body, "ad:postCode"),
		);

		if (postalCode) {
			postalCodes.set(feature.id, postalCode);
		}
	}

	for (const feature of collectFeatureBlocks(xml, "ad:AdminUnitName")) {
		const localId = readSingleTag(feature.body, "base:localId");
		const municipality = humanizePlaceName(
			readSingleTag(feature.body, "gn:text"),
		);
		const provinceCode = localId?.split(".")[0];

		adminUnits.set(feature.id, {
			municipality,
			provinceCode,
			provinceName: getProvinceNameFromCode(provinceCode),
		});
	}

	return {
		thoroughfares,
		postalCodes,
		adminUnits,
	};
};

const parseAddressFeatures = (xml: string): ParsedCatastroAddress[] => {
	const components = parseComponentMaps(xml);
	const features = collectFeatureBlocks(xml, "ad:Address");
	const parsedAddresses: Array<ParsedCatastroAddress | null> = features.map(
		(feature): ParsedCatastroAddress | null => {
			const localId = readSingleTag(feature.body, "base:localId") ?? feature.id;
			const designator = readLocatorDesignator(feature.body);
			const specification = readSingleTag(feature.body, "ad:specification");
			const position = readSingleTag(feature.body, "gml:pos");
			const [xValue, yValue] = (position ?? "").split(/\s+/);
			const x = Number(xValue);
			const y = Number(yValue);

			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				return null;
			}

			const componentRefs = readComponentRefs(feature.body);
			const streetName = componentRefs
				.map((ref) => components.thoroughfares.get(ref))
				.find(Boolean);
			const postalCode = componentRefs
				.map((ref) => components.postalCodes.get(ref))
				.find(Boolean);
			const adminUnit = componentRefs
				.map((ref) => components.adminUnits.get(ref))
				.find(Boolean);

			return {
				id: feature.id,
				localId,
				parcelRef14: localId.split(".").at(-1),
				specification,
				designator,
				streetName,
				municipality: adminUnit?.municipality,
				provinceCode: adminUnit?.provinceCode,
				provinceName: adminUnit?.provinceName,
				postalCode,
				point: { x, y },
			};
		},
	);

	return parsedAddresses.filter(
		(entry): entry is ParsedCatastroAddress => entry !== null,
	);
};

const buildCandidateLabel = (candidate: {
	streetName?: string;
	designator?: string;
	postalCode?: string;
	municipality?: string;
}) => {
	const street = [
		humanizeStreetName(candidate.streetName),
		candidate.designator,
	]
		.filter(Boolean)
		.join(" ");
	const locality = [
		formatPostalCode(candidate.postalCode),
		candidate.municipality,
	]
		.filter(Boolean)
		.join(" ");

	return [street, locality].filter(Boolean).join(", ");
};

const buildPrefillLocation = (candidate: {
	streetName?: string;
	designator?: string;
	municipality?: string;
	provinceName?: string;
	postalCode?: string;
}): ListingLocation | undefined => {
	const street = [
		humanizeStreetName(candidate.streetName),
		candidate.designator,
	]
		.filter(Boolean)
		.join(" ");
	const city = candidate.municipality;
	const stateOrProvince = candidate.provinceName;
	const postalCode = formatPostalCode(candidate.postalCode);

	if (!street || !city || !stateOrProvince || !postalCode) {
		return undefined;
	}

	return {
		street,
		city,
		stateOrProvince,
		postalCode,
		country: "Spain",
	};
};

const fetchCandidatesForRadius = async (input: {
	centerX: number;
	centerY: number;
	radiusMeters: number;
	signal?: AbortSignal;
}) => {
	const params = new URLSearchParams({
		service: "WFS",
		version: "2.0.0",
		request: "GetFeature",
		typeNames: "ad:Address",
		count: String(MAX_RESULTS_PER_REQUEST),
		bbox: [
			input.centerX - input.radiusMeters,
			input.centerY - input.radiusMeters,
			input.centerX + input.radiusMeters,
			input.centerY + input.radiusMeters,
			"urn:ogc:def:crs:EPSG::3857",
		].join(","),
		srsname: "urn:ogc:def:crs:EPSG::3857",
	});

	const response = await fetch(`${CATASTRO_WFS_URL}?${params.toString()}`, {
		signal: input.signal,
		headers: {
			Accept: "application/xml, text/xml;q=0.9, */*;q=0.8",
			"User-Agent": "Mozilla/5.0 (compatible; Casedra Localiza/1.0)",
		},
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`state_catastro_http_${response.status}`);
	}

	const xml = await response.text();

	if (xml.includes("No se han encontrado inmuebles en la caja especificada")) {
		return [];
	}

	if (xml.includes("<Exception")) {
		throw new Error("state_catastro_exception");
	}

	return parseAddressFeatures(xml);
};

const scoreDistance = (distanceMeters: number, expectedPrecision: number) => {
	if (distanceMeters <= expectedPrecision * 0.75) {
		return 0.25;
	}

	if (distanceMeters <= expectedPrecision * 1.5) {
		return 0.18;
	}

	if (distanceMeters <= expectedPrecision * 3) {
		return 0.1;
	}

	return 0.03;
};

const scoreCandidate = (input: {
	candidate: ParsedCatastroAddress;
	signals: IdealistaSignals;
	centerPoint: { x: number; y: number };
	listingSignalCorpus: string;
	streetNameHints: string[];
}): ScoredCatastroCandidate | null => {
	const {
		candidate,
		signals,
		centerPoint,
		listingSignalCorpus,
		streetNameHints,
	} = input;
	const matchedSignals: string[] = [];
	const discardedSignals: string[] = [];
	const normalizedMunicipalityHint = normalizeLocalizaText(
		signals.municipality,
	);
	const normalizedCandidateMunicipality = normalizeLocalizaText(
		candidate.municipality,
	);

	if (
		normalizedMunicipalityHint &&
		normalizedCandidateMunicipality &&
		normalizedMunicipalityHint !== normalizedCandidateMunicipality
	) {
		return null;
	}

	if (!provinceMatchesHint(candidate.provinceCode, signals.province)) {
		return null;
	}

	const distanceMeters = distanceBetweenPoints(centerPoint, candidate.point);
	const expectedPrecision = Math.min(
		Math.max(signals.mapPrecisionMeters ?? 35, 20),
		120,
	);
	const streetLabel = humanizeStreetName(candidate.streetName);
	const candidateStreetCore = normalizeStreetCore(candidate.streetName);
	const listingHasStreetNameHint =
		streetNameHints.length > 0 ||
		hasStreetNameHint(signals.title) ||
		hasStreetNameHint(listingSignalCorpus);
	const candidateMatchesParsedStreetHint =
		candidateStreetCore.length > 0 &&
		streetNameHints.some((hint) => hint === candidateStreetCore);
	const candidateMatchesStreetHint =
		streetLabel &&
		(corpusIncludesPhrase(listingSignalCorpus, streetLabel) ||
			corpusIncludesPhrase(listingSignalCorpus, candidate.streetName) ||
			candidateMatchesParsedStreetHint);

	const prefillLocation = buildPrefillLocation(candidate);
	const label = buildCandidateLabel(candidate);

	let score = 0.35;
	matchedSignals.push("official_candidate");

	if (candidate.municipality && normalizedMunicipalityHint) {
		matchedSignals.push("municipality_match");
	} else if (signals.municipality) {
		discardedSignals.push("municipality");
	}

	if (signals.province) {
		matchedSignals.push("province_match");
	}

	score += scoreDistance(distanceMeters, expectedPrecision);
	matchedSignals.push("coordinate_proximity");

	if (
		signals.postalCodeHint &&
		formatPostalCode(signals.postalCodeHint) ===
			formatPostalCode(candidate.postalCode)
	) {
		score += 0.1;
		matchedSignals.push("postal_code_match");
	} else if (signals.postalCodeHint) {
		discardedSignals.push("postal_code_hint");
	}

	if (candidateMatchesStreetHint) {
		score += 0.15;
		matchedSignals.push("street_name_match");
		if (candidateMatchesParsedStreetHint) {
			matchedSignals.push("virtual_tour_street_hint_match");
		}
	} else if (candidate.streetName) {
		discardedSignals.push("street_name");
	}

	if (
		signals.portalHint &&
		normalizeLocalizaText(signals.portalHint) ===
			normalizeLocalizaText(candidate.designator)
	) {
		score += 0.1;
		matchedSignals.push("portal_hint_match");
	} else if (
		corpusIncludesDesignator(
			listingSignalCorpus,
			candidate.designator,
			candidate.streetName,
		)
	) {
		score += 0.1;
		matchedSignals.push("designator_match");
	} else if (candidate.designator) {
		discardedSignals.push("designator");
	}

	if (candidate.specification?.toLowerCase() === "entrance") {
		score += 0.05;
		matchedSignals.push("entrance_level_candidate");
	}

	const reasonCodes = dedupeStrings([
		...matchedSignals,
		candidate.specification?.toLowerCase() === "entrance"
			? "official_entrance_candidate"
			: "official_parcel_candidate",
		`distance_${Math.round(distanceMeters)}m`,
	]);

	return {
		candidate: {
			id: candidate.id,
			label,
			parcelRef14: candidate.parcelRef14,
			score: Math.min(Number(score.toFixed(2)), 1),
			reasonCodes,
			distanceMeters: Number(distanceMeters.toFixed(1)),
			prefillLocation,
			rationale: {
				title: "Candidato oficial por proximidad",
				description: `Catastro ubica ${label} a ${Math.round(distanceMeters)} m del centro aproximado del anuncio.${
					candidateMatchesStreetHint
						? " La calle también aparece entre las señales públicas del anuncio."
						: listingHasStreetNameHint
							? " La calle no coincide con la señal textual más fuerte, así que Localiza lo trata como candidato competidor y no como prueba definitiva."
							: " No hay calle exacta publicada, así que la distancia y el resto de señales deciden si merece revisión."
				}`,
				sourceLabel: "Dirección General del Catastro",
				sourceUrl: "https://www.sedecatastro.gob.es/",
				matchedSignals: dedupeStrings(matchedSignals),
				discardedSignals: dedupeStrings(discardedSignals),
			},
		},
		matchedSignals: dedupeStrings(matchedSignals),
		discardedSignals: dedupeStrings(discardedSignals),
		specification: candidate.specification,
		streetName: candidate.streetName,
		designator: candidate.designator,
		municipality: candidate.municipality,
		provinceName: candidate.provinceName,
		postalCode: candidate.postalCode,
		distanceMeters: Number(distanceMeters.toFixed(1)),
	};
};

const dedupeByCandidateId = (candidates: ParsedCatastroAddress[]) => {
	const byId = new Map<string, ParsedCatastroAddress>();

	for (const candidate of candidates) {
		if (!byId.has(candidate.id)) {
			byId.set(candidate.id, candidate);
		}
	}

	return Array.from(byId.values());
};

const hasStrongOfficialFactSignals = (signals: IdealistaSignals) =>
	signals.areaM2 !== undefined ||
	Boolean(signals.floorText) ||
	/\b[aá]tico\b/i.test(
		[signals.title, signals.listingText].filter(Boolean).join(" "),
	);

const hasNumberedStreetSignal = (signals: IdealistaSignals) =>
	NUMBERED_STREET_SIGNAL_PATTERN.test(
		[signals.addressText, signals.listingText, signals.title]
			.filter(Boolean)
			.join("\n"),
	);

const normalizeStreetCore = (value?: string) =>
	normalizeLocalizaText(value)
		.replace(STREET_PREFIX_PATTERN, "")
		.replace(STREET_ARTICLE_PATTERN, "")
		.trim();

const extractVirtualTourStreetNameHints = (signals: IdealistaSignals) => {
	const corpus = [signals.addressText, signals.listingText, signals.title]
		.filter(Boolean)
		.join("\n");
	const hints: string[] = [];

	for (const match of corpus.matchAll(VIRTUAL_TOUR_STREET_HINT_PATTERN)) {
		const hint = normalizeStreetCore(match[1]);

		if (hint.length >= 4 && !/\d/.test(hint)) {
			hints.push(hint);
		}
	}

	return dedupeStrings(hints);
};

const hasPreciseAddressProof = (matchedSignals: string[]) =>
	matchedSignals.includes("portal_hint_match") ||
	matchedSignals.includes("designator_match");

const capCandidateWithoutNumberedProof = (
	entry: ScoredCatastroCandidate,
	hasNumberedAddressSignal: boolean,
): ScoredCatastroCandidate => {
	if (
		!hasNumberedAddressSignal ||
		hasPreciseAddressProof(entry.matchedSignals) ||
		entry.candidate.selectionDisabled
	) {
		return entry;
	}

	return {
		...entry,
		candidate: {
			...entry.candidate,
			score: Math.min(entry.candidate.score, 0.44),
			reasonCodes: dedupeStrings([
				...entry.candidate.reasonCodes,
				"numbered_address_signal_required",
			]),
		},
		discardedSignals: dedupeStrings([
			...entry.discardedSignals,
			"numbered_address_signal_mismatch",
		]),
	};
};

const enrichScoredCandidatesWithFactFit = async (input: {
	candidates: ScoredCatastroCandidate[];
	signals: IdealistaSignals;
	signal?: AbortSignal;
	hasNumberedAddressSignal: boolean;
}) => {
	const factFitByAddress = new Map<
		string,
		ReturnType<typeof fetchStateCallejeroFactFit>
	>();

	const enrichOne = async (entry: ScoredCatastroCandidate) => {
		const addressKey = [
			entry.provinceName ?? input.signals.province ?? "",
			entry.municipality ?? input.signals.municipality ?? "",
			entry.streetName ?? "",
			entry.designator ?? "",
		]
			.map(normalizeLocalizaText)
			.join("|");
		let factFitPromise = factFitByAddress.get(addressKey);

		if (!factFitPromise) {
			factFitPromise = fetchStateCallejeroFactFit({
				province: entry.provinceName ?? input.signals.province ?? "",
				municipality: entry.municipality ?? input.signals.municipality ?? "",
				streetName: entry.streetName,
				number: entry.designator,
				signals: input.signals,
				signal: input.signal,
			});
			factFitByAddress.set(addressKey, factFitPromise);
		}

		const factFit = await factFitPromise;

		if (!factFit) {
			return entry;
		}

		const hasPreciseTextProof = hasPreciseAddressProof(entry.matchedSignals);
		const hasAddressProof =
			hasPreciseTextProof ||
			(!input.hasNumberedAddressSignal &&
				entry.matchedSignals.includes("street_name_match"));
		const scoreBoost = hasAddressProof ? factFit.scoreBoost : 0;
		const nextScore = factFit.isRejected
			? Math.min(entry.candidate.score, 0.34)
			: Math.min(
					Number((entry.candidate.score + scoreBoost).toFixed(2)),
					1,
				);
		const matchedSignals = dedupeStrings([
			...entry.matchedSignals,
			...factFit.matchedSignals,
		]);
		const discardedSignals = dedupeStrings([
			...entry.discardedSignals,
			...factFit.discardedSignals,
			!factFit.isRejected && !hasAddressProof
				? "catastro_fact_fit_not_promoted_without_address_proof"
				: "",
		]);

		return {
			...entry,
			candidate: {
				...entry.candidate,
				score: nextScore,
				selectionDisabled: factFit.isRejected || undefined,
				reasonCodes: dedupeStrings([
					...entry.candidate.reasonCodes,
					...factFit.matchedSignals,
					factFit.isRejected
						? "catastro_fact_fit_rejected"
						: "catastro_fact_fit_checked",
				]),
				rationale: {
					...factFit.rationale,
					description:
						!factFit.isRejected && !hasAddressProof
							? `${factFit.rationale.description} Localiza no lo sube por superficie o planta solamente porque esos encajes son comunes en la zona y no hay una calle y número publicados que aten el anuncio a este portal.`
							: factFit.rationale.description,
					matchedSignals,
					discardedSignals,
				},
			},
			matchedSignals,
			discardedSignals,
		} satisfies ScoredCatastroCandidate;
	};

	const enriched: ScoredCatastroCandidate[] = [];
	for (
		let index = 0;
		index < input.candidates.length;
		index += FACT_FIT_BATCH_SIZE
	) {
		enriched.push(
			...(await Promise.all(
				input.candidates
					.slice(index, index + FACT_FIT_BATCH_SIZE)
					.map(enrichOne),
			)),
		);
	}

	return enriched;
};

const buildUnresolvedOfficialResolution = (input: {
	territoryAdapter: LocalizaTerritoryAdapter;
	reasonCodes: string[];
	matchedSignals?: string[];
	discardedSignals?: string[];
	officialSource?: string;
}): LocalizaOfficialResolution => ({
	status: "unresolved",
	confidenceScore: 0,
	officialSource:
		input.officialSource ?? officialSourceLabelByTerritory[input.territoryAdapter],
	candidates: [],
	reasonCodes: dedupeStrings(input.reasonCodes),
	matchedSignals: dedupeStrings(input.matchedSignals ?? []),
	discardedSignals: dedupeStrings(input.discardedSignals ?? []),
	territoryAdapter: input.territoryAdapter,
});

const buildResolvedOfficialResolution = (input: {
	status: LocalizaOfficialResolution["status"];
	selected: ScoredCatastroCandidate;
	candidates: ScoredCatastroCandidate[];
	territoryAdapter: LocalizaTerritoryAdapter;
	extraReasonCodes: string[];
}) =>
	({
		status: input.status,
		confidenceScore: input.selected.candidate.score,
		officialSource: officialSourceLabelByTerritory[input.territoryAdapter],
		resolvedAddressLabel: input.selected.candidate.label,
		parcelRef14: input.selected.candidate.parcelRef14,
		prefillLocation: input.selected.candidate.prefillLocation,
		candidates: input.candidates.map((entry) => entry.candidate),
		reasonCodes: dedupeStrings([
			...input.selected.candidate.reasonCodes,
			...input.selected.matchedSignals,
			...input.extraReasonCodes,
		]),
		matchedSignals: dedupeStrings(input.selected.matchedSignals),
		discardedSignals: dedupeStrings(input.selected.discardedSignals),
		territoryAdapter: input.territoryAdapter,
	}) satisfies LocalizaOfficialResolution;

export const resolveStateCatastro = async (input: {
	signals: IdealistaSignals;
	signal?: AbortSignal;
}): Promise<LocalizaOfficialResolution> => {
	const regionalTerritory = await detectRegionalTerritory({
		provinceHint: input.signals.province,
		approximateLat: input.signals.approximateLat,
		approximateLng: input.signals.approximateLng,
		signal: input.signal,
	});

	if (regionalTerritory) {
		const regionalResolution = await (() => {
			switch (regionalTerritory.adapter) {
				case "navarra_rtn":
					return resolveNavarraCatastro(input);
				case "alava_catastro":
					return resolveAlavaCatastro(input);
				case "bizkaia_catastro":
					return resolveBizkaiaCatastro(input);
				case "gipuzkoa_catastro":
					return resolveGipuzkoaCatastro(input);
				default:
					return Promise.resolve(
						buildUnresolvedOfficialResolution({
							territoryAdapter: regionalTerritory.adapter,
							reasonCodes: [
								"regional_cadastre_required",
								`${regionalTerritory.adapter}_unsupported`,
							],
							matchedSignals: ["territory_routed"],
							discardedSignals: ["state_catastro"],
							officialSource:
								officialSourceLabelByTerritory[regionalTerritory.adapter],
						}),
					);
			}
		})();

		return {
			...regionalResolution,
			reasonCodes: dedupeStrings([
				"regional_cadastre_required",
				...regionalResolution.reasonCodes,
			]),
			matchedSignals: dedupeStrings([
				"territory_routed",
				regionalTerritory.source === "coordinates"
					? "territory_routed_by_coordinates"
					: "territory_routed_by_province_hint",
				...regionalResolution.matchedSignals,
			]),
			discardedSignals: dedupeStrings([
				"state_catastro",
				...regionalResolution.discardedSignals,
			]),
		};
	}

	if (
		input.signals.approximateLat === undefined ||
		input.signals.approximateLng === undefined
	) {
		const callejeroFallback = await resolveStateCatastroByCallejero({
			signals: input.signals,
			listingCorpus: buildListingSignalCorpus(input.signals),
			signal: input.signal,
		});

		if (callejeroFallback) {
			return callejeroFallback;
		}

		return buildUnresolvedOfficialResolution({
			territoryAdapter: "state_catastro",
			reasonCodes: ["state_catastro_missing_coordinates"],
			discardedSignals: ["approximate_coordinates"],
		});
	}

	const centerPoint = convertWgs84ToWebMercator(
		input.signals.approximateLat,
		input.signals.approximateLng,
	);
	const listingSignalCorpus = buildListingSignalCorpus(input.signals);
	const radii = buildSearchRadii(input.signals.mapPrecisionMeters);
	const allCandidates: ParsedCatastroAddress[] = [];
	const hasNumberedAddressSignal = hasNumberedStreetSignal(input.signals);
	const streetNameHints = extractVirtualTourStreetNameHints(input.signals);
	const hasStreetNameSignal =
		streetNameHints.length > 0 ||
		hasStreetNameHint(input.signals.title) ||
		hasStreetNameHint(listingSignalCorpus);
	const shouldScanBroadlyForFactFit =
		hasStreetNameSignal && hasStrongOfficialFactSignals(input.signals);

	for (const radius of radii) {
		const nextCandidates = await fetchCandidatesForRadius({
			centerX: centerPoint.x,
			centerY: centerPoint.y,
			radiusMeters: radius,
			signal: input.signal,
		});

		allCandidates.push(...nextCandidates);

		if (
			!shouldScanBroadlyForFactFit &&
			dedupeByCandidateId(allCandidates).length >= 6
		) {
			break;
		}
	}

	const dedupedCandidates = dedupeByCandidateId(allCandidates);

	if (dedupedCandidates.length === 0) {
		const callejeroFallback = await resolveStateCatastroByCallejero({
			signals: input.signals,
			listingCorpus: listingSignalCorpus,
			signal: input.signal,
		});

		if (callejeroFallback) {
			return callejeroFallback;
		}

		return buildUnresolvedOfficialResolution({
			territoryAdapter: "state_catastro",
			reasonCodes: ["state_catastro_no_candidates_found"],
			matchedSignals: ["official_source_reached"],
			discardedSignals: ["official_candidates"],
		});
	}

	const baseScoredCandidates = dedupedCandidates
		.map((candidate) =>
			scoreCandidate({
				candidate,
				signals: input.signals,
				centerPoint,
				listingSignalCorpus,
				streetNameHints,
			}),
		)
		.filter((entry): entry is ScoredCatastroCandidate => Boolean(entry))
		.sort((left, right) => {
			if (right.candidate.score !== left.candidate.score) {
				return right.candidate.score - left.candidate.score;
			}

			return (
				(left.distanceMeters ?? Number.POSITIVE_INFINITY) -
				(right.distanceMeters ?? Number.POSITIVE_INFINITY)
			);
		});

	if (baseScoredCandidates.length === 0) {
		const callejeroFallback = await resolveStateCatastroByCallejero({
			signals: input.signals,
			listingCorpus: listingSignalCorpus,
			signal: input.signal,
		});

		if (callejeroFallback) {
			return callejeroFallback;
		}

		return buildUnresolvedOfficialResolution({
			territoryAdapter: "state_catastro",
			reasonCodes: [
				"state_catastro_candidates_discarded",
				"municipality_or_province_mismatch",
			],
			matchedSignals: ["official_candidates_found"],
			discardedSignals: ["official_candidates"],
		});
	}

	const factFitCandidateLimit = shouldScanBroadlyForFactFit
		? BROAD_FACT_FIT_CANDIDATE_LIMIT
		: BASE_FACT_FIT_CANDIDATE_LIMIT;
	const candidatesForFactFit = baseScoredCandidates.slice(
		0,
		factFitCandidateLimit,
	);
	const candidatesWithoutFactFit =
		baseScoredCandidates.slice(factFitCandidateLimit);
	const scoredCandidates = [
		...(await enrichScoredCandidatesWithFactFit({
			candidates: candidatesForFactFit,
			signals: input.signals,
			signal: input.signal,
			hasNumberedAddressSignal,
		})),
		...candidatesWithoutFactFit,
	]
		.map((entry) =>
			capCandidateWithoutNumberedProof(entry, hasNumberedAddressSignal),
		)
		.sort((left, right) => {
			if (
				left.candidate.selectionDisabled !== right.candidate.selectionDisabled
			) {
				return left.candidate.selectionDisabled ? 1 : -1;
			}

			if (right.candidate.score !== left.candidate.score) {
				return right.candidate.score - left.candidate.score;
			}

			return (
				(left.distanceMeters ?? Number.POSITIVE_INFINITY) -
				(right.distanceMeters ?? Number.POSITIVE_INFINITY)
			);
		});

	const viableCandidates = scoredCandidates
		.filter((candidate) => candidate.candidate.score >= MIN_VIABLE_SCORE)
		.filter((candidate) => !candidate.candidate.selectionDisabled)
		.slice(0, 5);
	const rejectedCandidates = scoredCandidates
		.filter((candidate) => candidate.candidate.selectionDisabled)
		.slice(0, 3);
	const displayedCandidates = [...viableCandidates, ...rejectedCandidates].slice(
		0,
		8,
	);

	if (viableCandidates.length === 0) {
		if (rejectedCandidates.length > 0) {
			return {
				status: "needs_confirmation",
				confidenceScore: 0,
				officialSource: officialSourceLabelByTerritory.state_catastro,
				candidates: displayedCandidates.map((entry) => entry.candidate),
				reasonCodes: dedupeStrings([
					"state_catastro_numbered_address_rejected",
					"state_catastro_confirmation_required",
				]),
				matchedSignals: dedupeStrings(
					rejectedCandidates.flatMap((entry) => entry.matchedSignals),
				),
				discardedSignals: dedupeStrings(
					rejectedCandidates.flatMap((entry) => entry.discardedSignals),
				),
				territoryAdapter: "state_catastro",
			};
		}

		const callejeroFallback = await resolveStateCatastroByCallejero({
			signals: input.signals,
			listingCorpus: listingSignalCorpus,
			signal: input.signal,
		});

		if (callejeroFallback) {
			return callejeroFallback;
		}

		return buildUnresolvedOfficialResolution({
			territoryAdapter: "state_catastro",
			reasonCodes: ["state_catastro_scores_below_threshold"],
			matchedSignals: ["official_candidates_found"],
			discardedSignals: ["top_candidate_below_threshold"],
		});
	}

	const [topCandidate, secondCandidate] = viableCandidates;
	const hasStreetLevelProof =
		topCandidate.matchedSignals.includes("street_name_match");
	const hasDesignatorProof =
		topCandidate.matchedSignals.includes("portal_hint_match") ||
		topCandidate.matchedSignals.includes("designator_match");
	const outcome = classifyLocalizaCandidateOutcome({
		topScore: topCandidate.candidate.score,
		secondScore: secondCandidate?.candidate.score,
		hasStreetLevelProof,
		hasDesignatorProof,
	});

	if (outcome.status === "exact_match") {
		return buildResolvedOfficialResolution({
			status: "exact_match",
			selected: topCandidate,
			candidates: displayedCandidates,
			territoryAdapter: "state_catastro",
			extraReasonCodes: [
				"state_catastro_exact_match",
				`score_gap_${outcome.scoreGap}`,
			],
		});
	}

	if (outcome.status === "building_match") {
		return buildResolvedOfficialResolution({
			status: "building_match",
			selected: topCandidate,
			candidates: displayedCandidates,
			territoryAdapter: "state_catastro",
			extraReasonCodes: [
				"state_catastro_building_match",
				`score_gap_${outcome.scoreGap}`,
			],
		});
	}

	return buildResolvedOfficialResolution({
		status: "needs_confirmation",
		selected: topCandidate,
		candidates: displayedCandidates,
		territoryAdapter: "state_catastro",
		extraReasonCodes: [
			"state_catastro_confirmation_required",
			`score_gap_${outcome.scoreGap}`,
		],
	});
};
