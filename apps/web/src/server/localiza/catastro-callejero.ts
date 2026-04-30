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
	number?: string;
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

interface CallejeroDnploc {
	bico?: {
		bi?: {
			dt?: CallejeroParcelDt;
			idbi?: {
				rc?: CallejeroParcelRc;
			};
		};
	};
	lrcdnp?: {
		rcdnp?: Array<{
			rc?: CallejeroParcelRc;
			dt?: CallejeroParcelDt;
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

const extractStreetSignal = (
	signals: IdealistaSignals,
): ExtractedStreetSignal | null => {
	const candidates = [signals.title, signals.listingText]
		.map((value) => (value ? value.split(/[\n,]/).map((line) => line.trim()) : []))
		.flat()
		.filter(Boolean);

	for (const line of candidates) {
		const normalized = normalizeLocalizaText(line);
		const tokens = splitStreetTokens(normalized);
		if (tokens.length < 2) {
			continue;
		}

		const prefixIndex = tokens.findIndex((token) =>
			Boolean(STREET_PREFIX_TO_SIGLA[token]),
		);

		if (prefixIndex < 0) {
			continue;
		}

		const prefixCandidate = tokens[prefixIndex];
		const sigla = STREET_PREFIX_TO_SIGLA[prefixCandidate];
		if (!sigla) {
			continue;
		}

		const remainder = tokens.slice(prefixIndex + 1);
		const numberIndex = remainder.findIndex((token) => /^\d+$/.test(token));
		const streetTokens =
			numberIndex >= 0 ? remainder.slice(0, numberIndex) : remainder;
		const streetName = streetTokens.join(" ").trim();

		if (!streetName || streetName.length < 3) {
			continue;
		}

		return {
			sigla,
			streetName,
			number:
				numberIndex >= 0 && remainder[numberIndex]
					? remainder[numberIndex]
					: undefined,
		};
	}

	return null;
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

const buildParcelRef14 = (rc?: CallejeroParcelRc) => {
	if (!rc) {
		return undefined;
	}

	const combined = [rc.pc1, rc.pc2]
		.map((token) => (typeof token === "string" ? token.trim() : ""))
		.join("");

	return combined.length === 14 ? combined : undefined;
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

const dedupeCallejeroCandidates = <T extends { candidate: ResolveIdealistaLocationCandidate }>(
	entries: T[],
) => {
	const byId = new Map<string, T>();

	for (const entry of entries) {
		const key = entry.candidate.parcelRef14 ?? entry.candidate.label;
		if (!byId.has(key)) {
			byId.set(key, entry);
		}
	}

	return Array.from(byId.values());
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

	const streetSignal = extractStreetSignal(input.signals);
	if (!streetSignal) {
		return null;
	}

	if (!streetSignal.number) {
		return null;
	}

	const url = buildCallejeroUrl({
		province: input.signals.province,
		municipality: input.signals.municipality,
		sigla: streetSignal.sigla,
		streetName: streetSignal.streetName,
		number: streetSignal.number,
	});

	let response: Response;
	try {
		response = await fetch(url, {
			signal: input.signal,
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (compatible; Casedra Localiza/1.0)",
			},
			cache: "no-store",
		});
	} catch {
		return null;
	}

	if (!response.ok) {
		return null;
	}

	let payload: CallejeroResponse;
	try {
		payload = (await response.json()) as CallejeroResponse;
	} catch {
		return null;
	}

	const dnploc = payload.consulta_dnploc ?? payload.consulta_dnplocResult;
	if (!dnploc || hasCallejeroErrors(dnploc)) {
		return null;
	}

	const detailEntries: CallejeroParcelDetails[] = [];

	if (dnploc.bico?.bi?.dt) {
		detailEntries.push(parseParcelDetails(dnploc.bico.bi.dt, dnploc.bico.bi.idbi?.rc));
	}

	for (const candidate of dnploc.lrcdnp?.rcdnp ?? []) {
		if (candidate.dt) {
			detailEntries.push(parseParcelDetails(candidate.dt, candidate.rc));
		}
	}

	const ranked = dedupeCallejeroCandidates(
		detailEntries
			.map((details) => {
				const scored = scoreCallejeroCandidate({
					details,
					signals: input.signals,
					streetSignal,
					listingCorpus: input.listingCorpus,
				});
				const prefillLocation = buildPrefillLocation(details);
				const label = [
					[humanizeStreetName(details.streetName), details.number]
						.filter(Boolean)
						.join(" "),
					[details.postalCode, details.municipality]
						.filter(Boolean)
						.join(" "),
				]
					.filter(Boolean)
					.join(", ");
				const candidate: ResolveIdealistaLocationCandidate = {
					id: details.parcelRef14 ?? `callejero-${label || "unknown"}`,
					label,
					parcelRef14: details.parcelRef14,
					score: scored.score,
					reasonCodes: dedupeStrings([
						...scored.matchedSignals,
						"callejero_text_match",
					]),
					prefillLocation,
				};
				return {
					details,
					candidate,
					matchedSignals: scored.matchedSignals,
					discardedSignals: scored.discardedSignals,
				};
			})
			.filter((entry) => entry.candidate.score >= LOCALIZA_MIN_VIABLE_SCORE)
			.sort((left, right) => right.candidate.score - left.candidate.score),
	).slice(0, 5);

	if (ranked.length === 0) {
		return null;
	}

	const top = ranked[0];
	const status =
		top.candidate.score >= LOCALIZA_BUILDING_MATCH_THRESHOLD
			? "building_match"
			: "needs_confirmation";

	return {
		status,
		confidenceScore: top.candidate.score,
		officialSource: OFFICIAL_SOURCE_LABEL,
		resolvedAddressLabel: top.candidate.label,
		parcelRef14: top.candidate.parcelRef14,
		prefillLocation: top.candidate.prefillLocation,
		candidates: ranked.map((entry) => entry.candidate),
		reasonCodes: dedupeStrings([
			"state_catastro_callejero_fallback",
			...top.matchedSignals,
		]),
		matchedSignals: top.matchedSignals,
		discardedSignals: top.discardedSignals,
		territoryAdapter: "state_catastro",
	};
};
