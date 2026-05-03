import { env } from "@/env";

import { LocalizaServiceError } from "./errors";

const OPORTUNISTA_RAPIDAPI_DEFAULT_HOST = "idealista-historico.p.rapidapi.com";
const OPORTUNISTA_PRICE_HISTORY_TIMEOUT_MS = 6_000;

export const OPORTUNISTA_PRICE_HISTORY_REFRESH_MS =
	6 * 24 * 60 * 60 * 1000;
export const OPORTUNISTA_PRICE_HISTORY_PROVENANCE_URL = "https://rapidapi.com/";
export const OPORTUNISTA_PRICE_HISTORY_PROVENANCE_LABEL =
	"Oportunista / Idealista histórico";

export type OportunistaMarketObservationImport = {
	portal: "IDEALISTA";
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
	provenanceUrl: string;
	sourceRecordId: string;
};

export type OportunistaListingArchiveImport = {
	sourceLabel: string;
	sourceUrl: string;
	observedAt?: string;
	title?: string;
	thumbnailUrl?: string;
	publishedAt?: string;
	lastSeenAt?: string;
	highestPrice?: number;
	lowestPrice?: number;
	latestPrice?: number;
	priceByArea?: number;
	areaM2?: number;
	bedrooms?: number;
	bathrooms?: number;
	floorText?: string;
	isExterior?: boolean;
	hasElevator?: boolean;
	hasParkingSpace?: boolean;
	hasTerrace?: boolean;
	hasSwimmingPool?: boolean;
	hasGarden?: boolean;
	hasBoxRoom?: boolean;
	hasAirConditioning?: boolean;
	hasVideo?: boolean;
	hasPlan?: boolean;
	has3DTour?: boolean;
	numPhotos?: number;
	status?: string;
	propertyType?: string;
	externalReference?: string;
	advertiserName?: string;
	agencyName?: string;
	userType?: string;
	addressText?: string;
	neighborhood?: string;
	municipality?: string;
	province?: string;
	postalCodeHint?: string;
	approximateLat?: number;
	approximateLng?: number;
	mapPrecisionMeters?: number;
};

export type OportunistaMarketIntelImport = {
	observations: OportunistaMarketObservationImport[];
	archive?: OportunistaListingArchiveImport;
};

const getOportunistaRapidApiKey = () =>
	env.OPORTUNISTA_RAPIDAPI_KEY ?? env.IDEALISTA_HISTORICO_RAPIDAPI_KEY;

const getOportunistaRapidApiHost = () =>
	(env.OPORTUNISTA_RAPIDAPI_HOST ?? OPORTUNISTA_RAPIDAPI_DEFAULT_HOST)
		.replace(/^https?:\/\//i, "")
		.replace(/\/+$/, "");

export const isOportunistaPriceHistoryConfigured = () =>
	Boolean(getOportunistaRapidApiKey());

const safeString = (value: unknown) => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const safeNumber = (value: unknown) => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const numericText = value.replace(/[^\d.,-]/g, "");
		const normalized = numericText.includes(",")
			? numericText.replace(/\./g, "").replace(",", ".")
			: numericText.replace(/\.(?=\d{3}(?:\.|$))/g, "");
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return undefined;
};

const safeBoolean = (value: unknown) => {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return value === 1;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (["1", "true", "yes", "si", "sí"].includes(normalized)) {
			return true;
		}
		if (["0", "false", "no"].includes(normalized)) {
			return false;
		}
	}

	return undefined;
};

const pickFirstString = (
	data: Record<string, unknown>,
	keys: string[],
): string | undefined => {
	for (const key of keys) {
		const value = safeString(data[key]);
		if (value) {
			return value;
		}
	}

	return undefined;
};

const parseIsoDate = (value: unknown) => {
	const text = safeString(value);
	const timestamp = Date.parse(text ?? "");
	return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
};

const getInclusiveDays = (start?: string, end?: string) => {
	const startTimestamp = Date.parse(start ?? "");
	const endTimestamp = Date.parse(end ?? "");

	if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
		return undefined;
	}

	return Math.max(
		1,
		Math.round((endTimestamp - startTimestamp) / (24 * 60 * 60 * 1000)) + 1,
	);
};

const getRecord = (value: unknown): Record<string, unknown> | undefined =>
	value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;

const extractResponseData = (payload: unknown) => {
	const record = getRecord(payload);
	const dataRecord = getRecord(record?.data);
	return dataRecord ?? record;
};

const extractPriceRows = (data: Record<string, unknown>) => {
	const prices = Array.isArray(data.prices) ? data.prices : [];
	const rows: Array<{ observedAt: string; askingPrice?: number }> = [];

	for (const entry of prices) {
		const record = getRecord(entry);
		const observedAt = parseIsoDate(record?.fetchedAt);

		if (!observedAt) {
			continue;
		}

		rows.push({
			observedAt,
			askingPrice: safeNumber(record?.price),
		});
	}

	const fallbackObservedAt = parseIsoDate(data.fetchedAt);
	const fallbackPrice = safeNumber(data.price);

	if (rows.length === 0 && fallbackObservedAt) {
		rows.push({
			observedAt: fallbackObservedAt,
			askingPrice: fallbackPrice,
		});
	}

	return rows.sort(
		(left, right) =>
			new Date(left.observedAt).getTime() -
			new Date(right.observedAt).getTime(),
	);
};

const compressPriceRows = (
	rows: Array<{ observedAt: string; askingPrice?: number }>,
) => {
	const compressed: Array<{ observedAt: string; askingPrice?: number }> = [];

	for (const row of rows) {
		const previous = compressed.at(-1);
		if (!previous || previous.askingPrice !== row.askingPrice) {
			compressed.push(row);
		}
	}

	const latest = rows.at(-1);
	const latestCompressed = compressed.at(-1);

	if (latest && latestCompressed?.observedAt !== latest.observedAt) {
		compressed.push(latest);
	}

	return compressed.slice(-80);
};

const buildArchiveImport = (input: {
	data: Record<string, unknown>;
	priceRows: Array<{ observedAt: string; askingPrice?: number }>;
	sourceUrl: string;
	advertiserName?: string;
	agencyName?: string;
	firstSeenAt?: string;
}): OportunistaListingArchiveImport => {
	const latestRow = input.priceRows.at(-1);
	const lastSeenAt =
		parseIsoDate(input.data.fetchedAt) ??
		parseIsoDate(input.data.lastSeenAt) ??
		latestRow?.observedAt;

	return {
		sourceLabel: OPORTUNISTA_PRICE_HISTORY_PROVENANCE_LABEL,
		sourceUrl: input.sourceUrl,
		observedAt: lastSeenAt,
		title: safeString(input.data.title),
		thumbnailUrl: safeString(input.data.thumbnail),
		publishedAt: input.firstSeenAt,
		lastSeenAt,
		highestPrice: safeNumber(input.data.highestPrice),
		lowestPrice: safeNumber(input.data.lowestPrice),
		latestPrice: safeNumber(input.data.price) ?? latestRow?.askingPrice,
		priceByArea: safeNumber(input.data.priceByArea),
		areaM2: safeNumber(input.data.size),
		bedrooms: safeNumber(input.data.rooms),
		bathrooms: safeNumber(input.data.bathrooms),
		floorText: safeString(input.data.floor),
		isExterior: safeBoolean(input.data.exterior),
		hasElevator: safeBoolean(input.data.hasLift),
		hasParkingSpace: safeBoolean(input.data.hasParkingSpace),
		hasTerrace: safeBoolean(input.data.hasTerrace),
		hasSwimmingPool: safeBoolean(input.data.hasSwimmingPool),
		hasGarden: safeBoolean(input.data.hasGarden),
		hasBoxRoom: safeBoolean(input.data.hasBoxRoom),
		hasAirConditioning: safeBoolean(input.data.hasAirConditioning),
		hasVideo: safeBoolean(input.data.hasVideo),
		hasPlan: safeBoolean(input.data.hasPlan),
		has3DTour: safeBoolean(input.data.has3DTour),
		numPhotos: safeNumber(input.data.numPhotos),
		status: safeString(input.data.status),
		propertyType:
			safeString(input.data.subTypology) ??
			safeString(input.data.typology) ??
			safeString(input.data.propertyType),
		externalReference: safeString(input.data.externalReference),
		advertiserName: input.advertiserName,
		agencyName: input.agencyName,
		userType: safeString(input.data.userType),
		addressText: pickFirstString(input.data, [
			"address",
			"street",
			"streetName",
			"location",
			"fullAddress",
		]),
		neighborhood: pickFirstString(input.data, [
			"neighborhood",
			"district",
			"zone",
		]),
		municipality: pickFirstString(input.data, ["municipality", "city", "town"]),
		province: pickFirstString(input.data, ["province", "region"]),
		postalCodeHint: pickFirstString(input.data, [
			"postalCode",
			"postcode",
			"zipCode",
		]),
		approximateLat:
			safeNumber(input.data.latitude) ??
			safeNumber(input.data.lat) ??
			safeNumber(input.data.y),
		approximateLng:
			safeNumber(input.data.longitude) ??
			safeNumber(input.data.lng) ??
			safeNumber(input.data.lon) ??
			safeNumber(input.data.x),
		mapPrecisionMeters: safeNumber(input.data.mapPrecisionMeters),
	};
};

export const fetchOportunistaMarketIntel = async (input: {
	listingId: string;
	sourceUrl: string;
}): Promise<OportunistaMarketIntelImport> => {
	const apiKey = getOportunistaRapidApiKey();

	if (!apiKey) {
		throw new LocalizaServiceError(
			"upstream_unavailable",
			"Oportunista price history is not configured in this environment.",
		);
	}

	const host = getOportunistaRapidApiHost();
	const url = `https://${host}/inmueble/${encodeURIComponent(input.listingId)}`;
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, OPORTUNISTA_PRICE_HISTORY_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			method: "GET",
			signal: abortController.signal,
			headers: {
				"x-rapidapi-host": host,
				"x-rapidapi-key": apiKey,
			},
		});

		if (response.status === 404) {
			return { observations: [] };
		}

		if (!response.ok) {
			throw new LocalizaServiceError(
				"upstream_unavailable",
				`Oportunista returned ${response.status} while loading price history.`,
			);
		}

		const payload = (await response.json()) as unknown;
		const data = extractResponseData(payload);

		if (!data) {
			return { observations: [] };
		}

		const propertyCode =
			safeString(data.propertyCode) ??
			safeString(data.property_code) ??
			input.listingId;
		const sourceUrl = safeString(data.url) ?? input.sourceUrl;
		const firstSeenAt =
			parseIsoDate(data.publishedAt) ??
			parseIsoDate(data.published_at) ??
			parseIsoDate(data.firstSeenAt);
		const advertiserName =
			safeString(data.contactName) ?? safeString(data.advertiserName);
		const agencyName =
			safeString(data.commercialName) ??
			safeString(data.micrositeShortName) ??
			safeString(data.agencyName);
		const priceRows = compressPriceRows(extractPriceRows(data));

		return {
			observations: priceRows.map((row) => ({
				portal: "IDEALISTA",
				observedAt: row.observedAt,
				askingPrice: row.askingPrice,
				currencyCode: row.askingPrice !== undefined ? "EUR" : undefined,
				advertiserName,
				agencyName,
				sourceUrl,
				daysPublished: getInclusiveDays(firstSeenAt, row.observedAt),
				firstSeenAt,
				lastSeenAt: row.observedAt,
				provenanceLabel: OPORTUNISTA_PRICE_HISTORY_PROVENANCE_LABEL,
				provenanceUrl: OPORTUNISTA_PRICE_HISTORY_PROVENANCE_URL,
				sourceRecordId: `oportunista:${propertyCode}:${row.observedAt.slice(0, 10)}`,
			})),
			archive: buildArchiveImport({
				data,
				priceRows,
				sourceUrl,
				advertiserName,
				agencyName,
				firstSeenAt,
			}),
		};
	} catch (error) {
		if (abortController.signal.aborted) {
			throw new LocalizaServiceError(
				"timeout",
				"Oportunista price history timed out.",
			);
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
};

export const fetchOportunistaPriceHistory = async (input: {
	listingId: string;
	sourceUrl: string;
}): Promise<OportunistaMarketObservationImport[]> =>
	(await fetchOportunistaMarketIntel(input)).observations;
