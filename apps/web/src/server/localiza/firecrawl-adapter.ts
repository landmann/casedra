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

const propertyTypes = new Set<
  NonNullable<IdealistaSignals["propertyType"]>
>(["homes", "offices", "premises", "garages", "bedrooms"]);

const firecrawlJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    price: { type: "number" },
    propertyType: {
      type: "string",
      enum: ["homes", "offices", "premises", "garages", "bedrooms"],
    },
    areaM2: { type: "number" },
    bedrooms: { type: "number" },
    bathrooms: { type: "number" },
    floorText: { type: "string" },
    portalHint: { type: "string" },
    neighborhood: { type: "string" },
    municipality: { type: "string" },
    province: { type: "string" },
    postalCodeHint: { type: "string" },
    approximateLat: { type: "number" },
    approximateLng: { type: "number" },
    mapPrecisionMeters: { type: "number" },
    listingText: { type: "string" },
    imageUrls: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

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
    const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const safeImageUrls = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const urls = value
    .map((entry) => safeString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return urls.length > 0 ? urls : undefined;
};

const safePropertyType = (
  value: unknown
): IdealistaSignals["propertyType"] | undefined => {
  const normalized = safeString(value)?.toLowerCase();
  return normalized && propertyTypes.has(normalized as NonNullable<IdealistaSignals["propertyType"]>)
    ? (normalized as NonNullable<IdealistaSignals["propertyType"]>)
    : undefined;
};

const extractStructuredPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const maybeData =
    "data" in payload && payload.data && typeof payload.data === "object"
      ? payload.data
      : undefined;

  if (!maybeData) {
    return {};
  }

  const jsonPayload =
    ("json" in maybeData && maybeData.json && typeof maybeData.json === "object"
      ? maybeData.json
      : undefined) ??
    ("extract" in maybeData && maybeData.extract && typeof maybeData.extract === "object"
      ? maybeData.extract
      : undefined) ??
    ("llm_extraction" in maybeData &&
    maybeData.llm_extraction &&
    typeof maybeData.llm_extraction === "object"
      ? maybeData.llm_extraction
      : undefined);

  return (jsonPayload ?? {}) as Record<string, unknown>;
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

const buildMatchedSignals = (signals: IdealistaSignals) => {
  const matchedSignals = ["idealista_listing_id"];

  if (signals.title) matchedSignals.push("title");
  if (signals.price !== undefined) matchedSignals.push("price");
  if (signals.areaM2 !== undefined) matchedSignals.push("area_m2");
  if (signals.bedrooms !== undefined) matchedSignals.push("bedrooms");
  if (signals.bathrooms !== undefined) matchedSignals.push("bathrooms");
  if (signals.floorText) matchedSignals.push("floor_text");
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
  if (signals.approximateLat === undefined || signals.approximateLng === undefined) {
    discardedSignals.push("approximate_coordinates");
  }
  if (!signals.postalCodeHint) discardedSignals.push("postal_code_hint");
  if (!signals.floorText) discardedSignals.push("floor_text");

  return discardedSignals;
};

const buildReasonCodes = (signals: IdealistaSignals) => {
  const reasonCodes = ["firecrawl_selected", "firecrawl_structured_signals"];

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

  return reasonCodes;
};

const buildSignalsFromPayload = (
  input: LocalizaAdapterInput,
  payload: unknown
): LocalizaAdapterOutput => {
  const extracted = extractStructuredPayload(payload);
  const markdown = extractMarkdown(payload);
  const baseSignals = buildAdapterSignals(input, "firecrawl");

  const signals: IdealistaSignals = {
    ...baseSignals,
    title: safeString(extracted.title),
    price: safeNumber(extracted.price),
    propertyType: safePropertyType(extracted.propertyType),
    areaM2: safeNumber(extracted.areaM2),
    bedrooms: safeNumber(extracted.bedrooms),
    bathrooms: safeNumber(extracted.bathrooms),
    floorText: safeString(extracted.floorText),
    portalHint: safeString(extracted.portalHint),
    neighborhood: safeString(extracted.neighborhood),
    municipality: safeString(extracted.municipality),
    province: safeString(extracted.province),
    postalCodeHint: safeString(extracted.postalCodeHint),
    approximateLat: safeNumber(extracted.approximateLat),
    approximateLng: safeNumber(extracted.approximateLng),
    mapPrecisionMeters: safeNumber(extracted.mapPrecisionMeters),
    listingText:
      safeString(extracted.listingText)?.slice(0, MAX_LISTING_TEXT_LENGTH) ??
      markdown,
    imageUrls: safeImageUrls(extracted.imageUrls),
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
  timeoutMs: 8_000,
  isConfigured: () => Boolean(env.FIRECRAWL_API_KEY),
  async acquireSignals(input) {
    const response = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      signal: input.signal,
      headers: {
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: input.sourceUrl,
        onlyMainContent: true,
        formats: [
          "markdown",
          {
            type: "json",
            prompt:
              "Extract normalized signals from this Spanish Idealista property listing. Keep values conservative, leave unknown fields empty, and use municipality/province names exactly as shown when available.",
            schema: firecrawlJsonSchema,
          },
        ],
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
        `Firecrawl returned ${response.status} while processing this listing.`
      );
    }

    const payload = (await response.json()) as unknown;
    return buildSignalsFromPayload(input, payload);
  },
};
