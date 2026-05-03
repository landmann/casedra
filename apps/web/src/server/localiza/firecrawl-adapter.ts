import type { IdealistaSignals } from "@casedra/types";

import { env } from "@/env";

import { LocalizaServiceError } from "./errors";
import type {
	LocalizaAdapter,
	LocalizaAdapterInput,
	LocalizaAdapterOutput,
} from "./types";
import { buildAdapterSignals } from "./types";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const MAX_LISTING_TEXT_LENGTH = 12_000;
const DEFAULT_APPROXIMATE_MAP_PRECISION_METERS = 300;

const getFirecrawlApiKey = () =>
	env.FIRECRAWL_API_KEY ??
	env.FIRECRAWL_API_API_KEY ??
	env.FIRECRAWL_PLAN_API_KEY;

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

const decodeHtmlEntities = (value: string) =>
	value
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");

const stripTags = (value: string) =>
	decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim();

const extractHtml = (payload: unknown) => {
	if (!payload || typeof payload !== "object") {
		return undefined;
	}

	const maybeData =
		"data" in payload && payload.data && typeof payload.data === "object"
			? payload.data
			: undefined;

	const html = maybeData && "html" in maybeData ? maybeData.html : undefined;

	const value = safeString(html);
	return value ? value.slice(0, MAX_LISTING_TEXT_LENGTH * 18) : undefined;
};

const extractMarkdown = (payload: unknown) => {
	if (!payload || typeof payload !== "object") {
		return undefined;
	}

	const maybeData =
		"data" in payload && payload.data && typeof payload.data === "object"
			? payload.data
			: undefined;

	const markdown =
		maybeData && "markdown" in maybeData ? maybeData.markdown : undefined;

	const value = safeString(markdown);
	return value ? value.slice(0, MAX_LISTING_TEXT_LENGTH) : undefined;
};

const extractFirstMatch = (value: string | undefined, pattern: RegExp) => {
	if (!value) {
		return undefined;
	}

	return value.match(pattern)?.[1]?.trim();
};

const extractNumberFromMatch = (value: string | undefined, pattern: RegExp) =>
	safeNumber(extractFirstMatch(value, pattern));

const extractTitle = (markdown?: string, html?: string) =>
	extractFirstMatch(markdown, /^#\s+(.+)$/m) ??
	safeString(
		stripTags(
			extractFirstMatch(
				html,
				/<span[^>]*class="[^"]*main-info__title-main[^"]*"[^>]*>(.*?)<\/span>/i,
			) ?? "",
		),
	) ??
	undefined;

const extractPrice = (markdown?: string, html?: string) =>
	extractNumberFromMatch(markdown, /^([\d.]+)\s*€$/m) ??
	extractNumberFromMatch(
		html,
		/<span[^>]*class="[^"]*info-data-price[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*txt-bold[^"]*"[^>]*>([\d.]+)<\/span>/i,
	);

const extractAreaM2 = (markdown?: string) =>
	extractNumberFromMatch(
		markdown,
		/^[•*-]?\s*([\d.,]+)\s*m²\s+construidos\b/m,
	) ??
	extractNumberFromMatch(markdown, /^([\d.,]+)\s*m²$/m);

const extractBedrooms = (markdown?: string) =>
	extractNumberFromMatch(markdown, /^(\d+)\s*hab\.$/m) ??
	extractNumberFromMatch(markdown, /^-\s*(\d+)\s*habitaciones$/m);

const extractBathrooms = (markdown?: string) =>
	extractNumberFromMatch(markdown, /^-\s*(\d+)\s*baños$/m);

const extractFloorText = (markdown?: string) =>
	extractFirstMatch(markdown, /^(Planta [^\n]+)$/m) ??
	extractFirstMatch(markdown, /^-\s*(Planta [^\n]+)$/m);

const extractListingText = (markdown?: string, html?: string) =>
	[markdown, html ? stripTags(html) : undefined].filter(Boolean).join("\n");

const extractPriceIncludesParking = (markdown?: string, html?: string) =>
	/garaje incluido/i.test(extractListingText(markdown, html));

const extractIsExterior = (markdown?: string, html?: string) =>
	/\bexterior\b/i.test(extractListingText(markdown, html));

const extractHasElevator = (markdown?: string, html?: string) => {
	const text = extractListingText(markdown, html);
	return /\bascensor\b/i.test(text) && !/\bsin\s+ascensor\b/i.test(text);
};

const sanitizePartyName = (value?: string) => {
	const trimmed = safeString(value?.replace(/\s+/g, " "));

	if (!trimmed) {
		return undefined;
	}

	const normalized = trimmed
		.replace(/^(agencia|anunciante|profesional|inmobiliaria)\s*:?\s*/i, "")
		.trim();
	const lowerNormalized = normalized.toLowerCase();

	if (
		!normalized ||
		normalized.length > 96 ||
		normalized.endsWith(":") ||
		lowerNormalized === "disponible en" ||
		lowerNormalized === "contactar" ||
		lowerNormalized === "ver telefono" ||
		lowerNormalized === "ver teléfono"
	) {
		return undefined;
	}

	return normalized;
};

const extractAdvertiserName = (markdown?: string, html?: string) => {
	const text = extractListingText(markdown, html);
	const explicitMatch =
		text.match(/(?:anunciante|publicado por|profesional)\s*:?\s*([^\n]+)/i)?.[1] ??
		text.match(/^\s*(Particular)\s*$/im)?.[1];

	return sanitizePartyName(explicitMatch);
};

const extractAgencyName = (markdown?: string, html?: string) => {
	const text = extractListingText(markdown, html);
	const explicitMatch =
		text.match(/(?:agencia inmobiliaria|inmobiliaria|agencia)\s*:?\s*([^\n]+)/i)
			?.[1] ??
		text.match(/(?:FOTOCASA|HABITACLIA|IDEALISTA):\s*([^\n]+)/i)?.[1];

	return sanitizePartyName(explicitMatch);
};

const extractAddressText = (markdown?: string, html?: string) => {
	const text = extractListingText(markdown, html);
	const explicitAddress = text.match(
		/\b((?:calle|c\/|avenida|avda\.?|paseo|plaza)\s+[^\n,.;]{3,120})/i,
	)?.[1];
	const normalizedAddress = explicitAddress?.replace(/\s+/g, " ");

	if (/^plaza\s+de\s+garaje\b/i.test(normalizedAddress ?? "")) {
		return undefined;
	}

	return safeString(normalizedAddress);
};

const extractDaysPublished = (markdown?: string, html?: string) =>
	extractNumberFromMatch(
		extractListingText(markdown, html),
		/(\d+)\s+d[ií]as?\s+publicad/i,
	);

const extractLocationBullets = (markdown?: string) => {
	if (!markdown) {
		return [];
	}

	const locationSection = markdown
		.match(/## Ubicación\s+([\s\S]*?)(?:\n## |$)/)?.[1]
		?.trim();

	if (!locationSection) {
		return [];
	}

	return locationSection
		.split(/\n+/)
		.map((line) => line.match(/^-\s*(.+)$/)?.[1]?.trim())
		.filter((line): line is string => Boolean(line));
};

const extractNeighborhoodAndMunicipality = (markdown?: string) => {
	const locationLineMatch = markdown?.match(/^([^\n,]+),\s*([^\n]+?)Ver mapa$/m);
	const bullets = extractLocationBullets(markdown);
	const neighborhood =
		bullets
			.find((entry) => /^Barrio\s+/i.test(entry))
			?.replace(/^Barrio\s+/i, "")
			.trim() ??
		locationLineMatch?.[1]?.trim();
	const municipality =
		bullets.find((entry) => /^Madrid capital,/i.test(entry))
			? "Madrid"
			: (locationLineMatch?.[2]?.trim() ??
				bullets.find((entry) => entry === "Madrid"));
	const province =
		bullets.find((entry) => /^Madrid capital,\s*Madrid$/i.test(entry))
			? "Madrid"
			: municipality === "Madrid"
				? "Madrid"
				: undefined;

	return {
		neighborhood: safeString(neighborhood),
		municipality: safeString(municipality),
		province,
	};
};

const extractApproximateMapCoordinates = (input?: string) => {
	const match = input?.match(/center=([-\d.]+)(?:%2C|,)([-\d.]+)/i);
	const approximateLat = safeNumber(match?.[1]);
	const approximateLng = safeNumber(match?.[2]);

	return approximateLat !== undefined && approximateLng !== undefined
		? {
				approximateLat,
				approximateLng,
				mapPrecisionMeters: DEFAULT_APPROXIMATE_MAP_PRECISION_METERS,
			}
		: {};
};

const extractImageUrls = (html?: string) => {
	if (!html) {
		return undefined;
	}

	const urls = Array.from(
		html.matchAll(/https:\/\/img\d+\.idealista\.com\/[^"'\s<>]+/g),
		(match) => decodeHtmlEntities(match[0]),
	);
	const seenImageKeys = new Set<string>();
	const uniqueUrls = urls.filter((url) => {
		const imageKey =
			url.match(/id\.pro\.es\.image\.master\/(.+?)\.(?:webp|jpe?g|png)(?:[?#]|$)/i)?.[1] ??
			url;

		if (seenImageKeys.has(imageKey)) {
			return false;
		}

		seenImageKeys.add(imageKey);
		return true;
	});

	return uniqueUrls.length > 0
		? Array.from(new Set(uniqueUrls)).slice(0, 12)
		: undefined;
};

const buildDeterministicSignals = (payload: unknown) => {
	const markdown = extractMarkdown(payload);
	const html = extractHtml(payload);
	const extractedLocation = extractNeighborhoodAndMunicipality(markdown);
	const imageUrls = extractImageUrls(html);

	return {
		title: extractTitle(markdown, html),
		price: extractPrice(markdown, html),
		propertyType: "homes" as const,
		areaM2: extractAreaM2(markdown),
		bedrooms: extractBedrooms(markdown),
		bathrooms: extractBathrooms(markdown),
		floorText: extractFloorText(markdown),
		primaryImageUrl: imageUrls?.[0],
		priceIncludesParking: extractPriceIncludesParking(markdown, html),
		isExterior: extractIsExterior(markdown, html),
		hasElevator: extractHasElevator(markdown, html),
		advertiserName: extractAdvertiserName(markdown, html),
		agencyName: extractAgencyName(markdown, html),
		daysPublished: extractDaysPublished(markdown, html),
		addressText: extractAddressText(markdown, html),
		portalHint: undefined,
		...extractedLocation,
		postalCodeHint: undefined,
		...extractApproximateMapCoordinates(`${html ?? ""}\n${markdown ?? ""}`),
		listingText: markdown,
		imageUrls,
	};
};

const buildMatchedSignals = (signals: IdealistaSignals) => {
	const matchedSignals = ["idealista_listing_id"];

	if (signals.title) matchedSignals.push("title");
	if (signals.price !== undefined) matchedSignals.push("price");
	if (signals.areaM2 !== undefined) matchedSignals.push("area_m2");
	if (signals.bedrooms !== undefined) matchedSignals.push("bedrooms");
	if (signals.bathrooms !== undefined) matchedSignals.push("bathrooms");
	if (signals.floorText) matchedSignals.push("floor_text");
	if (signals.primaryImageUrl) matchedSignals.push("primary_image_url");
	if (signals.imageUrls?.length) matchedSignals.push("image_urls");
	if (signals.priceIncludesParking) matchedSignals.push("parking_included");
	if (signals.isExterior) matchedSignals.push("exterior");
	if (signals.hasElevator) matchedSignals.push("elevator");
	if (signals.advertiserName) matchedSignals.push("advertiser_name");
	if (signals.agencyName) matchedSignals.push("agency_name");
	if (signals.daysPublished !== undefined) matchedSignals.push("days_published");
	if (signals.addressText) matchedSignals.push("address_text");
	if (signals.portalHint) matchedSignals.push("portal_hint");
	if (signals.neighborhood) matchedSignals.push("neighborhood");
	if (signals.municipality) matchedSignals.push("municipality");
	if (signals.province) matchedSignals.push("province");
	if (signals.postalCodeHint) matchedSignals.push("postal_code_hint");
	if (
		signals.approximateLat !== undefined &&
		signals.approximateLng !== undefined
	) {
		matchedSignals.push("approximate_coordinates");
	}
	if (signals.listingText) matchedSignals.push("listing_text");

	return matchedSignals;
};

const buildDiscardedSignals = (signals: IdealistaSignals) => {
	const discardedSignals: string[] = [];

	if (!signals.municipality) discardedSignals.push("municipality");
	if (!signals.province) discardedSignals.push("province");
	if (
		signals.approximateLat === undefined ||
		signals.approximateLng === undefined
	) {
		discardedSignals.push("approximate_coordinates");
	}
	if (!signals.postalCodeHint) discardedSignals.push("postal_code_hint");
	if (!signals.floorText) discardedSignals.push("floor_text");
	if (!signals.primaryImageUrl) discardedSignals.push("primary_image_url");
	if (!signals.advertiserName && !signals.agencyName) {
		discardedSignals.push("advertiser_or_agency");
	}

	return discardedSignals;
};

const buildReasonCodes = (signals: IdealistaSignals) => {
	const reasonCodes = ["firecrawl_selected", "firecrawl_page_signals"];

	if (
		signals.approximateLat !== undefined &&
		signals.approximateLng !== undefined
	) {
		reasonCodes.push("firecrawl_coordinates_found");
	}

	if (signals.municipality && signals.province) {
		reasonCodes.push("firecrawl_admin_area_found");
	}

	if (!signals.listingText) {
		reasonCodes.push("firecrawl_markdown_missing");
	}

	if (signals.imageUrls?.length) {
		reasonCodes.push("firecrawl_images_found");
	}

	if (
		signals.price !== undefined ||
		signals.areaM2 !== undefined ||
		signals.bedrooms !== undefined
	) {
		reasonCodes.push("firecrawl_listing_snapshot_found");
	}

	return reasonCodes;
};

const buildSignalsFromPayload = (
	input: LocalizaAdapterInput,
	payload: unknown,
): LocalizaAdapterOutput => {
	const deterministicSignals = buildDeterministicSignals(payload);
	const baseSignals = buildAdapterSignals(input, "firecrawl");
	const imageObservations = deterministicSignals.imageUrls?.map(
		(imageUrl, index) => ({
			imageUrl,
			sourcePortal: "idealista",
			sourceUrl: baseSignals.sourceUrl,
			observedAt: baseSignals.acquiredAt,
			lastVerifiedAt: baseSignals.acquiredAt,
			caption: index === 0 ? "Imagen principal del anuncio" : undefined,
		}),
	);

	const signals: IdealistaSignals = {
		...baseSignals,
		...deterministicSignals,
		imageObservations,
	};

	return {
		signals,
		matchedSignals: buildMatchedSignals(signals),
		discardedSignals: buildDiscardedSignals(signals),
		reasonCodes: buildReasonCodes(signals),
	};
};

export const firecrawlAdapter: LocalizaAdapter = {
	method: "firecrawl",
	label: "Firecrawl",
	timeoutMs: 25_000,
	isConfigured: () => Boolean(getFirecrawlApiKey()),
	async acquireSignals(input) {
		const apiKey = getFirecrawlApiKey();

		if (!apiKey) {
			throw new LocalizaServiceError(
				"upstream_unavailable",
				"Firecrawl is not configured in this environment.",
			);
		}

		const response = await fetch(FIRECRAWL_SCRAPE_URL, {
			method: "POST",
			signal: input.signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: input.sourceUrl,
				onlyMainContent: false,
				formats: ["html", "markdown"],
				location: {
					country: "ES",
					languages: ["es-ES"],
				},
				maxAge: 0,
			}),
		});

		if (!response.ok) {
			throw new LocalizaServiceError(
				"upstream_unavailable",
				`Firecrawl returned ${response.status} while processing this listing.`,
			);
		}

		const payload = (await response.json()) as unknown;
		return buildSignalsFromPayload(input, payload);
	},
};
