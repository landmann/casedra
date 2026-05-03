import type { IdealistaSignals, LocalizaAddressEvidence } from "@casedra/types";

import { env } from "@/env";

import {
	dedupeStrings,
	normalizeLocalizaText,
} from "./score";

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
const INDEXED_DUPLICATE_SEARCH_TIMEOUT_MS = 7_000;
const INDEXED_DUPLICATE_MIN_SCORE = 0.72;
const MAX_SEARCH_RESULTS = 5;
const MAX_QUERIES = 4;
const MAX_RESULT_TEXT_LENGTH = 3_000;

type IndexedDuplicateAddressSignal = {
	addressText: string;
	evidence: LocalizaAddressEvidence;
	score: number;
	reasonCodes: string[];
	matchedSignals: string[];
};

type FirecrawlSearchResult = {
	url?: string;
	title?: string;
	description?: string;
	markdown?: string;
	content?: string;
};

type FirecrawlSearchPayload = {
	success?: boolean;
	data?: {
		web?: FirecrawlSearchResult[];
	};
};

const streetPrefixPattern =
	"(?:calle|c\\/|avenida|avda\\.?|paseo|plaza|camino|carretera|ronda|traves[ií]a)";

const getFirecrawlApiKey = () =>
	env.FIRECRAWL_API_KEY ??
	env.FIRECRAWL_API_API_KEY ??
	env.FIRECRAWL_PLAN_API_KEY;

const safeString = (value: unknown) => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.replace(/\s+/g, " ").trim();
	return trimmed || undefined;
};

const normalizeUrlKey = (value?: string) => {
	if (!value) {
		return undefined;
	}

	try {
		const url = new URL(value);
		url.hash = "";
		url.hostname = url.hostname.toLowerCase();
		url.pathname = url.pathname.replace(/\/+$/, "") || "/";
		return url.toString().replace(/\/$/, "").toLowerCase();
	} catch {
		return value.trim().replace(/\/+$/, "").toLowerCase();
	}
};

const getBrowserUrl = (value?: string) => {
	if (!value) {
		return undefined;
	}

	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: undefined;
	} catch {
		return undefined;
	}
};

const stripStreetPrefix = (value?: string) =>
	normalizeLocalizaText(value)
		.replace(
			/^(calle|c|avenida|avda|paseo|plaza|camino|carretera|ronda|travesia)\s+/,
			"",
		)
		.replace(/^(de|del|la|las|los|el)\s+/, "")
		.trim();

const extractStreetHint = (signals: IdealistaSignals) => {
	const corpus = [
		signals.addressText,
		signals.title,
		signals.listingText,
	].filter(Boolean).join("\n");
	const match = corpus.match(
		new RegExp(`\\b(${streetPrefixPattern}\\s+[^\\n,.;]{3,90})`, "i"),
	);
	const candidate = safeString(match?.[1]);

	if (!candidate || /^plaza\s+de\s+garaje\b/i.test(candidate)) {
		return undefined;
	}

	return candidate.replace(/\s+\d+[A-Z]?$/i, "").trim();
};

const extractYearBuilt = (signals: IdealistaSignals) => {
	const match = signals.listingText?.match(
		/(?:construid[ao]|edificio\s+de)\s+(?:en\s+)?(19\d{2}|20\d{2})/i,
	);
	const year = Number(match?.[1]);
	return Number.isInteger(year) ? year : undefined;
};

const extractUsableArea = (signals: IdealistaSignals) => {
	const match = signals.listingText?.match(
		/(\d{2,4})\s*m²\s+(?:útiles|escriturados)/i,
	);
	const area = Number(match?.[1]);
	return Number.isFinite(area) ? area : undefined;
};

const extractBuiltAreaCandidates = (signals: IdealistaSignals) => {
	const areas = Array.from(
		(signals.listingText ?? "").matchAll(
			/[•*-]?\s*(\d{2,4})\s*m²\s+construidos\b/gi,
		),
	)
		.map((match) => Number(match[1]))
		.filter((area) => Number.isFinite(area));

	return Array.from(new Set(areas)).slice(0, 3);
};

const getFeatureTerms = (signals: IdealistaSignals) => {
	const yearBuilt = extractYearBuilt(signals);
	const usableArea = extractUsableArea(signals);
	const builtAreaCandidates = extractBuiltAreaCandidates(signals);

	return [
		signals.areaM2 ? `"${Math.round(signals.areaM2)} m²"` : undefined,
		...builtAreaCandidates
			.filter((area) => area !== signals.areaM2)
			.map((area) => `"${Math.round(area)} m²"`),
		usableArea ? `"${Math.round(usableArea)} m²"` : undefined,
		signals.bedrooms !== undefined ? `"${signals.bedrooms} hab"` : undefined,
		signals.floorText ? `"${signals.floorText}"` : undefined,
		yearBuilt ? `"${yearBuilt}"` : undefined,
		signals.priceIncludesParking ? "garaje" : undefined,
	].filter((term): term is string => Boolean(term));
};

const formatSearchPrice = (value?: number) => {
	if (value === undefined) {
		return undefined;
	}

	return new Intl.NumberFormat("es-ES", {
		maximumFractionDigits: 0,
		useGrouping: true,
	}).format(value);
};

const buildDuplicateSearchQueries = (signals: IdealistaSignals) => {
	const streetHint = extractStreetHint(signals);

	if (!streetHint) {
		return [];
	}

	const featureTerms = getFeatureTerms(signals);
	const builtAreaCandidates = extractBuiltAreaCandidates(signals);
	const primaryArea =
		builtAreaCandidates[0] ??
		(signals.areaM2 !== undefined ? Math.round(signals.areaM2) : undefined);
	const bedroomTerm =
		signals.bedrooms !== undefined ? `"${signals.bedrooms} hab"` : undefined;
	const floorTerm = signals.floorText ? `"${signals.floorText}"` : undefined;
	const priceTerm = formatSearchPrice(signals.price);
	const core = [`"${streetHint}"`, ...featureTerms].join(" ");
	const compactCore = [
		`"${streetHint}"`,
		bedroomTerm,
		floorTerm,
		priceTerm ? `"${priceTerm}"` : undefined,
	]
		.filter(Boolean)
		.join(" ");
	const balancedCore = [
		`"${streetHint}"`,
		primaryArea !== undefined ? `"${primaryArea} m²"` : undefined,
		bedroomTerm,
		floorTerm,
	]
		.filter(Boolean)
		.join(" ");

	return dedupeStrings([
		`${balancedCore} idealista`,
		`site:idealista.com/inmueble ${balancedCore}`,
		`${compactCore} idealista`,
		`site:idealista.com/inmueble ${core}`,
		`${core} idealista`,
	]).slice(0, MAX_QUERIES);
};

const extractAddressCandidates = (text: string, streetHint: string) => {
	const normalizedStreetCore = stripStreetPrefix(streetHint);
	const candidates: string[] = [];
	const matcher = new RegExp(
		`\\b(${streetPrefixPattern}\\s+[^\\n.;]{3,95}?\\s*,?\\s+\\d{1,4}[A-Z]?)\\b`,
		"gi",
	);

	for (const match of text.matchAll(matcher)) {
		const candidate = safeString(match[1]);
		const candidateCore = stripStreetPrefix(candidate?.replace(/,?\s+\d+[A-Z]?$/i, ""));

		if (
			candidate &&
			normalizedStreetCore &&
			candidateCore.includes(normalizedStreetCore)
		) {
			candidates.push(candidate.replace(/\s+,/g, ","));
		}
	}

	return dedupeStrings(candidates).slice(0, 4);
};

const includesNormalized = (text: string, value?: string | number) => {
	if (value === undefined || value === null) {
		return false;
	}

	return normalizeLocalizaText(text).includes(normalizeLocalizaText(String(value)));
};

const textHasAny = (text: string, values: string[]) => {
	const normalized = normalizeLocalizaText(text);
	return values.some((value) => normalized.includes(normalizeLocalizaText(value)));
};

const scoreDuplicateResult = (input: {
	resultText: string;
	resultUrl?: string;
	signals: IdealistaSignals;
}) => {
	const matchedSignals: string[] = ["indexed_duplicate_street_address"];
	let score = 0.34;
	const yearBuilt = extractYearBuilt(input.signals);
	const usableArea = extractUsableArea(input.signals);
	const builtAreaCandidates = extractBuiltAreaCandidates(input.signals);

	if (input.signals.areaM2 && includesNormalized(input.resultText, input.signals.areaM2)) {
		score += 0.16;
		matchedSignals.push("duplicate_area_match");
	}

	if (
		builtAreaCandidates.some(
			(area) =>
				area !== input.signals.areaM2 && includesNormalized(input.resultText, area),
		)
	) {
		score += 0.16;
		matchedSignals.push("duplicate_body_area_match");
	}

	if (usableArea && includesNormalized(input.resultText, usableArea)) {
		score += 0.1;
		matchedSignals.push("duplicate_usable_area_match");
	}

	if (input.signals.bedrooms !== undefined) {
		const bedroomsText = `${input.signals.bedrooms} hab`;
		if (
			textHasAny(input.resultText, [
				bedroomsText,
				`${input.signals.bedrooms} habitaciones`,
				`${input.signals.bedrooms} dormitorios`,
			])
		) {
			score += 0.12;
			matchedSignals.push("duplicate_bedrooms_match");
		}
	}

	if (input.signals.bathrooms !== undefined) {
		const bathroomsText = `${input.signals.bathrooms} baño`;
		if (textHasAny(input.resultText, [bathroomsText, `${input.signals.bathrooms} cuartos de baño`])) {
			score += 0.08;
			matchedSignals.push("duplicate_bathrooms_match");
		}
	}

	if (input.signals.floorText && textHasAny(input.resultText, [input.signals.floorText])) {
		score += 0.1;
		matchedSignals.push("duplicate_floor_match");
	}

	if (yearBuilt && includesNormalized(input.resultText, yearBuilt)) {
		score += 0.08;
		matchedSignals.push("duplicate_year_built_match");
	}

	if (input.signals.priceIncludesParking && /\bgaraje\b/i.test(input.resultText)) {
		score += 0.04;
		matchedSignals.push("duplicate_parking_match");
	}

	if (/\bterraza\b/i.test(input.signals.listingText ?? "") && /\bterraza\b/i.test(input.resultText)) {
		score += 0.04;
		matchedSignals.push("duplicate_terrace_match");
	}

	if (input.resultUrl?.includes("idealista.com/inmueble/")) {
		score += 0.04;
		matchedSignals.push("duplicate_idealista_listing");
	}

	return {
		score: Math.min(Number(score.toFixed(2)), 1),
		matchedSignals: dedupeStrings(matchedSignals),
	};
};

const formatMatchedSignals = (matchedSignals: string[]) => {
	const labels = [
		matchedSignals.includes("duplicate_area_match") ? "superficie" : undefined,
		matchedSignals.includes("duplicate_body_area_match")
			? "superficie del texto"
			: undefined,
		matchedSignals.includes("duplicate_usable_area_match")
			? "superficie útil"
			: undefined,
		matchedSignals.includes("duplicate_bedrooms_match")
			? "dormitorios"
			: undefined,
		matchedSignals.includes("duplicate_bathrooms_match")
			? "baños"
			: undefined,
		matchedSignals.includes("duplicate_floor_match") ? "planta" : undefined,
		matchedSignals.includes("duplicate_year_built_match")
			? "año de construcción"
			: undefined,
		matchedSignals.includes("duplicate_parking_match") ? "garaje" : undefined,
		matchedSignals.includes("duplicate_terrace_match") ? "terraza" : undefined,
	].filter(Boolean);

	return labels.length > 0
		? `Misma calle y ${labels.join(", ")}.`
		: "Misma calle y señales públicas coincidentes.";
};

const fetchSearchResults = async (input: {
	query: string;
	apiKey: string;
	signal?: AbortSignal;
}) => {
	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		INDEXED_DUPLICATE_SEARCH_TIMEOUT_MS,
	);
	const abortFromInput = () => abortController.abort();

	if (input.signal) {
		if (input.signal.aborted) {
			abortController.abort();
		} else {
			input.signal.addEventListener("abort", abortFromInput, { once: true });
		}
	}

	try {
		const response = await fetch(FIRECRAWL_SEARCH_URL, {
			method: "POST",
			signal: abortController.signal,
			headers: {
				Authorization: `Bearer ${input.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: input.query,
				limit: MAX_SEARCH_RESULTS,
				sources: ["web"],
				country: "ES",
				location: "Spain",
				timeout: INDEXED_DUPLICATE_SEARCH_TIMEOUT_MS,
			}),
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as FirecrawlSearchPayload;
		return payload.success === false ? [] : (payload.data?.web ?? []);
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
		input.signal?.removeEventListener("abort", abortFromInput);
	}
};

export const findIndexedDuplicateAddressSignal = async (input: {
	signals: IdealistaSignals;
	signal?: AbortSignal;
}): Promise<IndexedDuplicateAddressSignal | null> => {
	const apiKey = getFirecrawlApiKey();
	const streetHint = extractStreetHint(input.signals);
	const queries = buildDuplicateSearchQueries(input.signals);

	if (!apiKey || !streetHint || queries.length === 0) {
		return null;
	}

	const sourceUrlKey = normalizeUrlKey(input.signals.sourceUrl);
	const found: IndexedDuplicateAddressSignal[] = [];

	for (const query of queries) {
		const results = await fetchSearchResults({
			query,
			apiKey,
			signal: input.signal,
		});

		for (const result of results) {
			const resultUrlKey = normalizeUrlKey(result.url);

			if (resultUrlKey && sourceUrlKey && resultUrlKey === sourceUrlKey) {
				continue;
			}

			const resultText = [
				result.title,
				result.description,
				result.markdown,
				result.content,
			]
				.filter(Boolean)
				.join("\n")
				.slice(0, MAX_RESULT_TEXT_LENGTH);
			const addressCandidates = extractAddressCandidates(resultText, streetHint);

			for (const addressText of addressCandidates) {
				const scored = scoreDuplicateResult({
					resultText,
					resultUrl: result.url,
					signals: input.signals,
				});

				if (scored.score < INDEXED_DUPLICATE_MIN_SCORE) {
					continue;
				}

				found.push({
					addressText,
					score: scored.score,
					matchedSignals: scored.matchedSignals,
					reasonCodes: [
						"indexed_duplicate_address_search",
						"indexed_duplicate_address_signal_applied",
					],
					evidence: {
						label: "Dirección exacta en duplicado público",
						value: `${addressText}. ${formatMatchedSignals(scored.matchedSignals)}`,
						sourceLabel: result.title ?? "Resultado público indexado",
						sourceUrl: getBrowserUrl(result.url),
						observedAt: input.signals.acquiredAt,
						matchedSignals: scored.matchedSignals,
					},
				});
			}
		}
	}

	return (
		found.sort((left, right) => right.score - left.score)[0] ?? null
	);
};
