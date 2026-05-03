import type {
	IdealistaSignals,
	ListingLocation,
	ResolveIdealistaLocationCandidate,
} from "@casedra/types";

import {
	corpusIncludesPhrase,
	dedupeStrings,
	formatPostalCode,
	humanizePlaceName,
	humanizeStreetName,
	LOCALIZA_BUILDING_MATCH_THRESHOLD,
	LOCALIZA_MIN_VIABLE_SCORE,
	normalizeLocalizaText,
} from "./score";
import type { LocalizaOfficialResolution } from "./types";

const CATASTRO_CALLEJERO_BASE_URL =
	"https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPLOC";
const OFFICIAL_SOURCE_LABEL = "Dirección General del Catastro";

const STREET_PREFIX_TO_SIGLA: Record<string, string> = {
	calle: "CL",
	cl: "CL",
	c: "CL",
	avenida: "AV",
	avda: "AV",
	av: "AV",
	plaza: "PZ",
	pz: "PZ",
	paseo: "PS",
	ps: "PS",
	camino: "CM",
	cm: "CM",
	carretera: "CR",
	ctra: "CR",
	cr: "CR",
	ronda: "RDA",
	rda: "RDA",
	travesia: "TR",
	tr: "TR",
	urbanizacion: "UR",
	urb: "UR",
	ur: "UR",
	poligono: "PG",
	pg: "PG",
};

interface ExtractedStreetSignal {
	sigla: string;
	streetName: string;
	number: string;
	sourceText: string;
}

interface CallejeroParcelRc {
	pc1?: string;
	pc2?: string;
	car?: string;
	cc1?: string;
	cc2?: string;
}

interface CallejeroParcelDt {
	np?: string;
	nm?: string;
	locs?: {
		lous?: {
			lourb?: {
				dir?: {
					nv?: string;
					pnp?: string | number;
				};
				loint?: {
					es?: string;
					pt?: string;
					pu?: string;
				};
				dp?: string | number;
			};
		};
	};
}

interface CallejeroParcelDebi {
	luso?: string;
	sfc?: string | number;
	ant?: string | number;
}

interface CallejeroDnploc {
	bico?: {
		bi?: {
			dt?: CallejeroParcelDt;
			idbi?: {
				rc?: CallejeroParcelRc;
			};
			debi?: CallejeroParcelDebi;
		};
	};
	lrcdnp?: {
		rcdnp?: Array<{
			rc?: CallejeroParcelRc;
			dt?: CallejeroParcelDt;
			debi?: CallejeroParcelDebi;
		}>;
	};
	lerr?:
		| Array<{ cod?: string; des?: string }>
		| {
				err?: { cod?: string; des?: string } | Array<{ cod?: string; des?: string }>;
		  };
}

interface CallejeroResponse {
	consulta_dnploc?: CallejeroDnploc;
	consulta_dnplocResult?: CallejeroDnploc;
}

const splitStreetTokens = (value: string) => {
	const cleaned = value
		.replace(/^[\s\-,]+/, "")
		.replace(/[\s\-,]+$/, "")
		.replace(/\s+/g, " ");
	return cleaned.split(" ").filter(Boolean);
};

const trimLeadingStreetArticles = (tokens: string[]) => {
	let cursor = 0;

	while (
		cursor < tokens.length &&
		["de", "del", "la", "las", "los", "el"].includes(tokens[cursor] ?? "")
	) {
		cursor += 1;
	}

	return tokens.slice(cursor);
};

const buildCallejeroStreetQuery = (streetName: string) => {
	const tokens = splitStreetTokens(normalizeLocalizaText(streetName));
	const prefix = STREET_PREFIX_TO_SIGLA[tokens[0] ?? ""];
	const streetTokens = prefix ? tokens.slice(1) : tokens;
	const normalizedStreetName = trimLeadingStreetArticles(streetTokens)
		.join(" ")
		.trim();

	return {
		sigla: prefix ?? "CL",
		streetName: normalizedStreetName,
	};
};

const buildCallejeroUrl = (input: {
	province: string;
	municipality: string;
	sigla: string;
	streetName: string;
	number?: string;
}) => {
	const params = new URLSearchParams({
		Provincia: input.province,
		Municipio: input.municipality,
		Sigla: input.sigla,
		Calle: input.streetName,
		Numero: input.number ?? "",
		Bloque: "",
		Escalera: "",
		Planta: "",
		Puerta: "",
	});
	return `${CATASTRO_CALLEJERO_BASE_URL}?${params.toString()}`;
};

interface CallejeroParcelDetails {
	parcelRef14?: string;
	streetName?: string;
	number?: string;
	postalCode?: string;
	municipality?: string;
	provinceName?: string;
}

interface CallejeroUnitDetails extends CallejeroParcelDetails {
	unitRef20?: string;
	staircase?: string;
	floor?: string;
	door?: string;
	usage?: string;
	areaM2?: number;
	yearBuilt?: number;
}

type ScoredCallejeroCandidate = {
	details: CallejeroUnitDetails;
	candidate: ResolveIdealistaLocationCandidate;
	matchedSignals: string[];
	discardedSignals: string[];
};

const streetPrefixMatcher =
	"(calle|cl|c\\/|c|avenida|avda\\.?|av|plaza|pz|paseo|ps|camino|cm|carretera|ctra|cr|ronda|rda|traves[ií]a|tr|urbanizaci[oó]n|urb|ur|pol[ií]gono|pg)";

const buildParcelRef14 = (rc?: CallejeroParcelRc) => {
	if (!rc) {
		return undefined;
	}

	const combined = [rc.pc1, rc.pc2]
		.map((token) => (typeof token === "string" ? token.trim() : ""))
		.join("");

	return combined.length === 14 ? combined : undefined;
};

const buildUnitRef20 = (rc?: CallejeroParcelRc) => {
	if (!rc) {
		return undefined;
	}

	const combined = [rc.pc1, rc.pc2, rc.car, rc.cc1, rc.cc2]
		.map((token) => (typeof token === "string" ? token.trim() : ""))
		.join("");

	return combined.length === 20 ? combined : undefined;
};

const parseCatastroNumber = (value?: string | number) => {
	const parsed = Number(String(value ?? "").replace(",", "."));
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCatastroInteger = (value?: string | number) => {
	const parsed = parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const hasCallejeroErrors = (dnploc: CallejeroDnploc) => {
	const lerr = dnploc.lerr;

	if (!lerr) {
		return false;
	}

	if (Array.isArray(lerr)) {
		return lerr.some((error) => Boolean(error.cod));
	}

	const errors = Array.isArray(lerr.err) ? lerr.err : lerr.err ? [lerr.err] : [];
	return errors.some((error) => Boolean(error.cod));
};

const parseParcelDetails = (
	dt: CallejeroParcelDt | undefined,
	rc: CallejeroParcelRc | undefined,
): CallejeroParcelDetails => {
	const dir = dt?.locs?.lous?.lourb?.dir;
	const dp = dt?.locs?.lous?.lourb?.dp;
	const number =
		typeof dir?.pnp === "number" ? String(dir.pnp) : (dir?.pnp ?? undefined);
	const postalCode = formatPostalCode(
		typeof dp === "number" ? String(dp) : dp,
	);

	return {
		parcelRef14: buildParcelRef14(rc),
		streetName: dir?.nv ?? undefined,
		number: number?.toString().replace(/^0+/, "") || number,
		postalCode,
		municipality: humanizePlaceName(dt?.nm),
		provinceName: humanizePlaceName(dt?.np),
	};
};

const parseUnitDetails = (
	dt: CallejeroParcelDt | undefined,
	rc: CallejeroParcelRc | undefined,
	debi: CallejeroParcelDebi | undefined,
): CallejeroUnitDetails => {
	const details = parseParcelDetails(dt, rc);
	const loint = dt?.locs?.lous?.lourb?.loint;

	return {
		...details,
		unitRef20: buildUnitRef20(rc),
		staircase: loint?.es,
		floor: loint?.pt,
		door: loint?.pu,
		usage: debi?.luso,
		areaM2: parseCatastroNumber(debi?.sfc),
		yearBuilt: parseCatastroInteger(debi?.ant),
	};
};

const buildPrefillLocation = (
	details: CallejeroParcelDetails,
): ListingLocation | undefined => {
	const street = [
		humanizeStreetName(details.streetName),
		details.number,
	]
		.filter(Boolean)
		.join(" ");

	if (!street || !details.municipality || !details.provinceName || !details.postalCode) {
		return undefined;
	}

	return {
		street,
		city: details.municipality,
		stateOrProvince: details.provinceName,
		postalCode: details.postalCode,
		country: "Spain",
	};
};

const buildUnitCandidateLabel = (details: CallejeroUnitDetails) =>
	[
		[humanizeStreetName(details.streetName), details.number]
			.filter(Boolean)
			.join(" "),
		[
			details.staircase ? `Escalera ${details.staircase}` : undefined,
			details.floor ? `Planta ${details.floor}` : undefined,
			details.door ? `Puerta ${details.door}` : undefined,
		]
			.filter(Boolean)
			.join(", "),
		[details.postalCode, details.municipality].filter(Boolean).join(" "),
	]
		.filter(Boolean)
		.join(", ");

const isResidentialUsage = (value?: string) =>
	normalizeLocalizaText(value).includes("residencial");

const extractUsableArea = (signals: IdealistaSignals) => {
	const match = signals.listingText?.match(
		/(\d{2,4})\s*m²\s+(?:útiles|escriturados)/i,
	);
	const area = Number(match?.[1]);
	return Number.isFinite(area) ? area : undefined;
};

const extractListingYearBuilt = (signals: IdealistaSignals) => {
	const match = signals.listingText?.match(
		/(?:construid[ao]|edificio\s+de)\s+(?:en\s+)?(18\d{2}|19\d{2}|20\d{2})/i,
	);
	const year = Number(match?.[1]);
	return Number.isInteger(year) ? year : undefined;
};

const extractListingFloorNumber = (signals: IdealistaSignals) => {
	const corpus = [signals.floorText, signals.listingText, signals.title]
		.filter(Boolean)
		.join(" ");
	const normalized = normalizeLocalizaText(corpus);
	const explicitMatch =
		normalized.match(/(?:planta|piso)\s*(\d{1,2})/) ??
		normalized.match(/(\d{1,2})\s*(?:a|o|ª|º)?\s*(?:planta|piso)/);

	if (explicitMatch?.[1]) {
		return Number(explicitMatch[1]);
	}

	if (/\bbajo\b/.test(normalized)) {
		return 0;
	}

	return undefined;
};

const hasAtticSignal = (signals: IdealistaSignals) =>
	/\b[aá]tico\b/i.test([signals.title, signals.floorText, signals.listingText].filter(Boolean).join(" "));

const parseFloorNumber = (value?: string) => {
	const parsed = parseInt(String(value ?? "").replace(/^0+/, "") || "0", 10);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const formatUnitShortLabel = (unit: CallejeroUnitDetails) =>
	[
		unit.floor ? `Pl ${unit.floor}` : undefined,
		unit.door ? `Pt ${unit.door}` : undefined,
		unit.areaM2 !== undefined ? `${unit.areaM2} m²` : undefined,
	]
		.filter(Boolean)
		.join(" ");

const formatAreaRange = (units: CallejeroUnitDetails[]) => {
	const areas = units
		.map((unit) => unit.areaM2)
		.filter((area): area is number => area !== undefined);

	if (areas.length === 0) {
		return undefined;
	}

	const min = Math.min(...areas);
	const max = Math.max(...areas);
	return min === max ? `${min} m²` : `${min}-${max} m²`;
};

const buildCatastroSourceUrl = () => "https://www.sedecatastro.gob.es/";

const evaluateFactFit = (input: {
	units: CallejeroUnitDetails[];
	signals: IdealistaSignals;
	addressLabel: string;
	sourceUrl: string;
}) => {
	const residentialUnits = input.units.filter((unit) =>
		isResidentialUsage(unit.usage),
	);
	const usableArea = extractUsableArea(input.signals);
	const listingArea = input.signals.areaM2;
	const listingFloor = extractListingFloorNumber(input.signals);
	const listingYearBuilt = extractListingYearBuilt(input.signals);
	const atticSignal = hasAtticSignal(input.signals);
	const candidateUnits =
		residentialUnits.length > 0 ? residentialUnits : input.units;
	const areaTolerance =
		listingArea !== undefined ? Math.max(6, listingArea * 0.12) : undefined;
	const areaMatches =
		listingArea !== undefined && areaTolerance !== undefined
			? candidateUnits.filter(
					(unit) =>
						unit.areaM2 !== undefined &&
						Math.abs(unit.areaM2 - listingArea) <= areaTolerance,
				)
			: [];
	const closestByArea =
		listingArea !== undefined
			? [...candidateUnits]
					.filter((unit) => unit.areaM2 !== undefined)
					.sort(
						(left, right) =>
							Math.abs((left.areaM2 ?? 0) - listingArea) -
							Math.abs((right.areaM2 ?? 0) - listingArea),
					)
			: [];
	const closestAreaDelta =
		listingArea !== undefined && closestByArea[0]?.areaM2 !== undefined
			? Math.abs(closestByArea[0].areaM2 - listingArea)
			: undefined;
	const topFloor = Math.max(
		...candidateUnits
			.map((unit) => parseFloorNumber(unit.floor))
			.filter((floor): floor is number => floor !== undefined),
	);
	const hasTopFloor = Number.isFinite(topFloor);
	const floorMatches = areaMatches.filter((unit) => {
		const unitFloor = parseFloorNumber(unit.floor);
		return (
			unitFloor !== undefined &&
			listingFloor !== undefined &&
			(unitFloor === listingFloor || unitFloor + 1 === listingFloor)
		);
	});
	const atticMatches = areaMatches.filter((unit) => {
		const unitFloor = parseFloorNumber(unit.floor);
		return unitFloor !== undefined && hasTopFloor && unitFloor === topFloor;
	});
	const yearMatches =
		listingYearBuilt !== undefined &&
		candidateUnits.some((unit) => unit.yearBuilt === listingYearBuilt);
	const noResidentialUnits = residentialUnits.length === 0 && input.signals.propertyType === "homes";
	const impossibleArea =
		listingArea !== undefined &&
		candidateUnits.length > 0 &&
		areaMatches.length === 0 &&
		closestAreaDelta !== undefined &&
		closestAreaDelta > Math.max(12, listingArea * 0.28);
	const matchedSignals = [
		residentialUnits.length > 0 ? "catastro_residential_units" : undefined,
		areaMatches.length > 0 ? "catastro_area_fit" : undefined,
		floorMatches.length > 0 ? "catastro_floor_fit" : undefined,
		atticSignal && atticMatches.length > 0 ? "catastro_top_floor_fit" : undefined,
		yearMatches ? "catastro_year_built_fit" : undefined,
	].filter((item): item is string => Boolean(item));
	const discardedSignals = [
		noResidentialUnits ? "catastro_no_residential_units" : undefined,
		impossibleArea ? "catastro_area_mismatch" : undefined,
		listingFloor !== undefined &&
		areaMatches.length > 0 &&
		floorMatches.length === 0
			? "catastro_floor_mismatch"
			: undefined,
		listingYearBuilt !== undefined && !yearMatches
			? "catastro_year_built_mismatch"
			: undefined,
	].filter((item): item is string => Boolean(item));
	const selectedUnits =
		floorMatches.length > 0
			? floorMatches
			: atticMatches.length > 0
				? atticMatches
				: areaMatches.length > 0
					? areaMatches
					: closestByArea.slice(0, 1);
	const areaRange = formatAreaRange(residentialUnits);
	const sourceLabel = "Dirección General del Catastro";
	const sourceUrl = buildCatastroSourceUrl();

	let scoreBoost = 0;
	if (residentialUnits.length > 0) {
		scoreBoost += 0.04;
	}
	if (areaMatches.length > 0) {
		scoreBoost += 0.22;
	}
	if (floorMatches.length > 0 || (atticSignal && atticMatches.length > 0)) {
		scoreBoost += 0.08;
	}
	if (yearMatches) {
		scoreBoost += 0.04;
	}

	const isRejected = noResidentialUnits || impossibleArea;
	const matchingUnitText =
		selectedUnits.length > 0
			? selectedUnits.map(formatUnitShortLabel).filter(Boolean).join("; ")
			: undefined;
	const listingFacts = [
		listingArea !== undefined ? `${listingArea} m² construidos` : undefined,
		usableArea !== undefined ? `${usableArea} m² útiles` : undefined,
		listingFloor !== undefined ? `planta anunciada ${listingFloor}` : undefined,
		atticSignal ? "señal de ático" : undefined,
		listingYearBuilt !== undefined ? `año ${listingYearBuilt}` : undefined,
	]
		.filter(Boolean)
		.join(", ");
	const buildingFacts = [
		`${input.units.length} registros catastrales`,
		residentialUnits.length > 0
			? `${residentialUnits.length} residenciales`
			: "sin residenciales",
		areaRange ? `rango residencial ${areaRange}` : undefined,
	]
		.filter(Boolean)
		.join(", ");
	const description = isRejected
		? `Catastro sí reconoce ${input.addressLabel}, pero sus hechos no encajan con el anuncio: ${buildingFacts}. El anuncio indica ${listingFacts || "una vivienda"}, y la superficie residencial más cercana queda demasiado lejos. Por eso Localiza descarta esta dirección aunque aparezca como señal pública.`
		: `Catastro reconoce ${input.addressLabel}: ${buildingFacts}. El anuncio indica ${listingFacts || "datos parciales"}.${
				matchingUnitText
					? ` Las unidades que mejor encajan son ${matchingUnitText}.`
					: ""
			} Localiza lo usa como señal oficial de edificio; la puerta exacta solo queda probada si Catastro y el anuncio convergen en una única unidad.`;

	return {
		isRejected,
		scoreBoost,
		matchedSignals,
		discardedSignals,
		selectedUnits,
		rationale: {
			title: isRejected ? "Descartado por hechos de Catastro" : "Encaje con hechos de Catastro",
			description,
			sourceLabel,
			sourceUrl,
			matchedSignals,
			discardedSignals,
		},
	};
};

export const fetchStateCallejeroFactFit = async (input: {
	province: string;
	municipality: string;
	streetName?: string;
	number?: string;
	signals: IdealistaSignals;
	signal?: AbortSignal;
}) => {
	if (!input.province || !input.municipality || !input.streetName || !input.number) {
		return null;
	}

	const streetQuery = buildCallejeroStreetQuery(input.streetName);
	if (!streetQuery.streetName) {
		return null;
	}

	const url = buildCallejeroUrl({
		province: input.province,
		municipality: input.municipality,
		sigla: streetQuery.sigla,
		streetName: streetQuery.streetName,
		number: input.number,
	});
	const units = await fetchCallejeroUnits({
		url,
		signal: input.signal,
	});
	const baseDetails = units[0];

	if (!baseDetails) {
		return null;
	}

	const addressLabel = [
		[humanizeStreetName(baseDetails.streetName), baseDetails.number]
			.filter(Boolean)
			.join(" "),
		[baseDetails.postalCode, baseDetails.municipality]
			.filter(Boolean)
			.join(" "),
	]
		.filter(Boolean)
		.join(", ");

	return evaluateFactFit({
		units,
		signals: input.signals,
		addressLabel,
		sourceUrl: url,
	});
};

const scoreCallejeroCandidate = (input: {
	details: CallejeroParcelDetails;
	signals: IdealistaSignals;
	streetSignal: ExtractedStreetSignal;
	listingCorpus: string;
}) => {
	const matchedSignals: string[] = [
		"official_callejero_candidate",
		"official_candidate",
	];
	const discardedSignals: string[] = [];

	let score = 0.55;

	if (
		input.details.streetName &&
		corpusIncludesPhrase(input.listingCorpus, input.details.streetName)
	) {
		score += 0.18;
		matchedSignals.push("street_name_match");
	}

	if (
		input.streetSignal.number &&
		input.details.number &&
		input.streetSignal.number === input.details.number
	) {
		score += 0.12;
		matchedSignals.push("designator_match");
	} else if (input.streetSignal.number) {
		discardedSignals.push("designator");
	}

	if (
		input.signals.postalCodeHint &&
		formatPostalCode(input.signals.postalCodeHint) === input.details.postalCode
	) {
		score += 0.08;
		matchedSignals.push("postal_code_match");
	} else if (input.signals.postalCodeHint) {
		discardedSignals.push("postal_code_hint");
	}

	if (
		input.signals.municipality &&
		normalizeLocalizaText(input.signals.municipality) ===
			normalizeLocalizaText(input.details.municipality)
	) {
		matchedSignals.push("municipality_match");
	}

	if (input.signals.province) {
		matchedSignals.push("province_match");
	}

	return {
		score: Math.min(Number(score.toFixed(2)), 1),
		matchedSignals: dedupeStrings(matchedSignals),
		discardedSignals: dedupeStrings(discardedSignals),
	};
};

const buildScoredCandidatesForAddress = (input: {
	units: CallejeroUnitDetails[];
	signals: IdealistaSignals;
	streetSignal: ExtractedStreetSignal;
	listingCorpus: string;
	sourceUrl: string;
}): ScoredCallejeroCandidate[] => {
	const baseDetails = input.units[0];
	if (!baseDetails) {
		return [];
	}

	const baseScored = scoreCallejeroCandidate({
		details: baseDetails,
		signals: input.signals,
		streetSignal: input.streetSignal,
		listingCorpus: input.listingCorpus,
	});
	const addressLabel = [
		[humanizeStreetName(baseDetails.streetName), baseDetails.number]
			.filter(Boolean)
			.join(" "),
		[baseDetails.postalCode, baseDetails.municipality]
			.filter(Boolean)
			.join(" "),
	]
		.filter(Boolean)
		.join(", ");
	const factFit = evaluateFactFit({
		units: input.units,
		signals: input.signals,
		addressLabel,
		sourceUrl: input.sourceUrl,
	});
	const candidateUnits =
		!factFit.isRejected && factFit.selectedUnits.length > 0
			? factFit.selectedUnits.slice(0, 4)
			: [baseDetails];

	return candidateUnits.map((details) => {
		const isUnitCandidate = Boolean(details.unitRef20 && !factFit.isRejected);
		const score = factFit.isRejected
			? Math.min(baseScored.score, 0.34)
			: Math.min(Number((baseScored.score + factFit.scoreBoost).toFixed(2)), 1);
		const label = isUnitCandidate
			? buildUnitCandidateLabel(details)
			: addressLabel;
		const prefillLocation = buildPrefillLocation(details);
		const reasonCodes = dedupeStrings([
			...baseScored.matchedSignals,
			...factFit.matchedSignals,
			...(factFit.isRejected ? ["catastro_fact_fit_rejected"] : ["catastro_fact_fit_checked"]),
			"callejero_text_match",
		]);

		return {
			details,
			candidate: {
				id:
					(isUnitCandidate ? details.unitRef20 : details.parcelRef14) ??
					`callejero-${label || input.streetSignal.sourceText}`,
				label,
				parcelRef14: details.parcelRef14,
				unitRef20: isUnitCandidate ? details.unitRef20 : undefined,
				score,
				reasonCodes,
				prefillLocation,
				selectionDisabled: factFit.isRejected || undefined,
				rationale: {
					...factFit.rationale,
					matchedSignals: dedupeStrings([
						...baseScored.matchedSignals,
						...factFit.matchedSignals,
					]),
					discardedSignals: dedupeStrings([
						...baseScored.discardedSignals,
						...factFit.discardedSignals,
					]),
				},
			},
			matchedSignals: dedupeStrings([
				...baseScored.matchedSignals,
				...factFit.matchedSignals,
			]),
			discardedSignals: dedupeStrings([
				...baseScored.discardedSignals,
				...factFit.discardedSignals,
			]),
		};
	});
};

const dedupeCallejeroCandidates = <T extends { candidate: ResolveIdealistaLocationCandidate }>(
	entries: T[],
) => {
	const byId = new Map<string, T>();

	for (const entry of entries) {
		const key =
			entry.candidate.unitRef20 ??
			entry.candidate.parcelRef14 ??
			entry.candidate.label;
		if (!byId.has(key)) {
			byId.set(key, entry);
		}
	}

	return Array.from(byId.values());
};

const extractStreetSignals = (signals: IdealistaSignals): ExtractedStreetSignal[] => {
	const corpus = [signals.addressText, signals.title, signals.listingText]
		.filter(Boolean)
		.join("\n");
	const matcher = new RegExp(
		`\\b${streetPrefixMatcher}\\s+([^\\n.;]{3,95}?)\\s*,?\\s+(\\d{1,4})(?=\\b|\\s|,|\\.)`,
		"gi",
	);
	const byKey = new Map<string, ExtractedStreetSignal>();

	for (const match of corpus.matchAll(matcher)) {
		const prefixCandidate = normalizeLocalizaText(match[1]);
		const sigla = STREET_PREFIX_TO_SIGLA[prefixCandidate];
		const streetName = trimLeadingStreetArticles(
			splitStreetTokens(normalizeLocalizaText(match[2])),
		)
			.join(" ")
			.trim();
		const number = match[3]?.replace(/^0+/, "") || match[3];

		if (!sigla || !streetName || streetName.length < 3 || !number) {
			continue;
		}

		const sourceText = match[0].replace(/\s+/g, " ").trim();
		const key = `${sigla}:${streetName}:${number}`;
		if (!byKey.has(key)) {
			byKey.set(key, {
				sigla,
				streetName,
				number,
				sourceText,
			});
		}
	}

	return Array.from(byKey.values()).slice(0, 5);
};

const fetchCallejeroUnits = async (input: {
	url: string;
	signal?: AbortSignal;
}): Promise<CallejeroUnitDetails[]> => {
	let response: Response;
	try {
		response = await fetch(input.url, {
			signal: input.signal,
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (compatible; Casedra Localiza/1.0)",
			},
			cache: "no-store",
		});
	} catch {
		return [];
	}

	if (!response.ok) {
		return [];
	}

	let payload: CallejeroResponse;
	try {
		payload = (await response.json()) as CallejeroResponse;
	} catch {
		return [];
	}

	const dnploc = payload.consulta_dnploc ?? payload.consulta_dnplocResult;
	if (!dnploc || hasCallejeroErrors(dnploc)) {
		return [];
	}

	const units: CallejeroUnitDetails[] = [];

	if (dnploc.bico?.bi?.dt) {
		units.push(
			parseUnitDetails(
				dnploc.bico.bi.dt,
				dnploc.bico.bi.idbi?.rc,
				dnploc.bico.bi.debi,
			),
		);
	}

	for (const candidate of dnploc.lrcdnp?.rcdnp ?? []) {
		if (candidate.dt) {
			units.push(parseUnitDetails(candidate.dt, candidate.rc, candidate.debi));
		}
	}

	return units;
};

export const resolveStateCatastroByCallejero = async (input: {
	signals: IdealistaSignals;
	listingCorpus: string;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<LocalizaOfficialResolution | null> => {
	if (!input.signals.municipality || !input.signals.province) {
		return null;
	}

	const streetSignals = extractStreetSignals(input.signals);
	if (streetSignals.length === 0) {
		return null;
	}

	const scoredEntries: ScoredCallejeroCandidate[] = [];

	for (const streetSignal of streetSignals) {
		const url = buildCallejeroUrl({
			province: input.signals.province,
			municipality: input.signals.municipality,
			sigla: streetSignal.sigla,
			streetName: streetSignal.streetName,
			number: streetSignal.number,
		});
		const units = await fetchCallejeroUnits({
			url,
			signal: input.signal,
		});
		scoredEntries.push(
			...buildScoredCandidatesForAddress({
				units,
				signals: input.signals,
				streetSignal,
				listingCorpus: input.listingCorpus,
				sourceUrl: url,
			}),
		);
	}

	const ranked = dedupeCallejeroCandidates(scoredEntries).sort((left, right) => {
		if (left.candidate.selectionDisabled !== right.candidate.selectionDisabled) {
			return left.candidate.selectionDisabled ? 1 : -1;
		}

		return right.candidate.score - left.candidate.score;
	});
	const selectable = ranked
		.filter(
			(entry) =>
				!entry.candidate.selectionDisabled &&
				entry.candidate.score >= LOCALIZA_MIN_VIABLE_SCORE,
		)
		.slice(0, 5);
	const rejected = ranked
		.filter((entry) => entry.candidate.selectionDisabled)
		.slice(0, 3);
	const displayCandidates = dedupeCallejeroCandidates([
		...selectable,
		...rejected,
	]).slice(0, 8);

	if (selectable.length === 0) {
		return null;
	}

	const top = selectable[0];
	const second = selectable[1];
	const status =
		second && top.candidate.score - second.candidate.score < 0.08
			? "needs_confirmation"
			: top.candidate.score >= LOCALIZA_BUILDING_MATCH_THRESHOLD
			? "building_match"
			: "needs_confirmation";

	return {
		status,
		confidenceScore: top.candidate.score,
		officialSource: OFFICIAL_SOURCE_LABEL,
		resolvedAddressLabel: top.candidate.label,
		parcelRef14: top.candidate.parcelRef14,
		unitRef20: top.candidate.unitRef20,
		prefillLocation: top.candidate.prefillLocation,
		candidates: displayCandidates.map((entry) => entry.candidate),
		reasonCodes: dedupeStrings([
			"state_catastro_callejero_fallback",
			...top.matchedSignals,
		]),
		matchedSignals: top.matchedSignals,
		discardedSignals: top.discardedSignals,
		territoryAdapter: "state_catastro",
	};
};
