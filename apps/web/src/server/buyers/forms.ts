import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

export const BUYER_PRIVACY_VERSION = "informe-comprador-2026-05-03";
export const BUYER_SIGNUP_CONSENT =
	"Acepto recibir el Informe del Comprador de Casedra y que Casedra conserve prueba de este consentimiento.";
export const BUYER_QUESTION_CONSENT =
	"Acepto que Casedra procese esta consulta, mis datos de contacto y la prueba de consentimiento para responder.";

const languageSchema = z.enum(["es", "en"]).default("es");
const audienceSchema = z
	.enum(["buyers", "sellers", "investors", "landlords", "past_clients"])
	.default("buyers");
const sourceSchema = z
	.enum([
		"google_search",
		"seo",
		"linkedin",
		"meta",
		"partner",
		"community",
		"referral",
		"manual",
		"app",
	])
	.default("seo");
const signalSchema = z
	.enum([
		"search_intent",
		"mortgage_readiness",
		"foreign_buyer",
		"rental_fatigue",
		"investor",
		"hidden_address",
		"area_heat",
		"unknown",
	])
	.default("search_intent");
const contactPreferenceSchema = z
	.enum(["email", "whatsapp", "phone", "none"])
	.default("email");

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmedString = (max: number) =>
	z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));
const agencySlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export const normalizeAgencySlug = (value?: string | null) => {
	const normalized = value?.trim().toLowerCase();
	if (!normalized || !agencySlugPattern.test(normalized)) {
		return undefined;
	}
	return normalized;
};

const optionalAgencySlug = z.preprocess(
	(value) => (typeof value === "string" ? normalizeAgencySlug(value) : undefined),
	z.string().optional(),
);

const utmSchema = z
	.object({
		utm_source: optionalTrimmedString(120),
		utm_medium: optionalTrimmedString(120),
		utm_campaign: optionalTrimmedString(160),
		utm_term: optionalTrimmedString(160),
		utm_content: optionalTrimmedString(160),
	})
	.default({});

const baseBuyerPayloadSchema = z.object({
	language: languageSchema,
	market: z.string().trim().min(1).max(80).default("madrid"),
	audience: audienceSchema,
	source: sourceSchema,
	campaign: optionalTrimmedString(160),
	signal: signalSchema,
	contactPreference: contactPreferenceSchema,
	agencySlug: optionalAgencySlug,
	formPath: z.string().trim().min(1).max(240).default("/buyers"),
	landingPath: z.string().trim().max(240).optional(),
	utm: utmSchema,
	honeypot: z.string().trim().max(0).optional().default(""),
	consentAccepted: z.literal(true),
	privacyAccepted: z.literal(true),
});

export const buyerSubscribeSchema = baseBuyerPayloadSchema.extend({
	email: z.string().trim().toLowerCase().email().max(240),
	fullName: optionalTrimmedString(160),
});

export const buyerQuestionSchema = baseBuyerPayloadSchema
	.extend({
		fullName: trimmedString(160),
		email: z.string().trim().toLowerCase().email().max(240).optional(),
		phone: optionalTrimmedString(80),
		propertyUrl: z.string().trim().url().max(500),
		question: trimmedString(2000),
		budgetBand: trimmedString(120),
		buyingTimeline: trimmedString(120),
		subscribeToBrief: z.boolean().default(false),
	})
	.refine((data) => data.email || data.phone, {
		message: "Email o teléfono es obligatorio",
		path: ["email"],
	})
	.refine((data) => !data.subscribeToBrief || Boolean(data.email), {
		message: "El email es obligatorio para recibir el Informe del Comprador",
		path: ["email"],
	});

const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 8;
const rateLimitHits = new Map<string, number[]>();

export const hashValue = (value?: string | null) => {
	const normalized = value?.trim();
	if (!normalized) {
		return undefined;
	}
	return createHash("sha256").update(normalized).digest("hex");
};

export const getRequestProof = (request: NextRequest) => {
	const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
	const ip = forwardedFor ?? request.headers.get("x-real-ip");
	const userAgent = request.headers.get("user-agent");

	return {
		ipHash: hashValue(ip),
		userAgentHash: hashValue(userAgent),
	};
};

export const enforceLightRateLimit = (key: string) => {
	const timestamp = Date.now();
	const currentWindow = (rateLimitHits.get(key) ?? []).filter(
		(hit) => timestamp - hit < rateLimitWindowMs,
	);
	if (currentWindow.length >= maxRequestsPerWindow) {
		return false;
	}
	rateLimitHits.set(key, [...currentWindow, timestamp]);
	return true;
};

export const buildRawBuyerPayload = (
	payload: z.infer<typeof baseBuyerPayloadSchema>,
	extra: Record<string, unknown> = {},
) => ({
	formPath: payload.formPath,
	landingPath: payload.landingPath,
	utm: payload.utm,
	agencySlug: payload.agencySlug,
	source: payload.source,
	campaign: payload.campaign,
	signal: payload.signal,
	language: payload.language,
	market: payload.market,
	...extra,
});

const formatContactPreference = (
	value: z.infer<typeof contactPreferenceSchema>,
) => {
	switch (value) {
		case "whatsapp":
			return "WhatsApp";
		case "phone":
			return "teléfono";
		case "none":
			return "sin preferencia";
		default:
			return "email";
	}
};

export const buildBuyerQuestionMessage = (payload: z.infer<typeof buyerQuestionSchema>) =>
	[
		`URL del anuncio: ${payload.propertyUrl}`,
		`Presupuesto: ${payload.budgetBand}`,
		`Horizonte: ${payload.buyingTimeline}`,
		`Contacto preferido: ${formatContactPreference(payload.contactPreference)}`,
		"",
		payload.question,
	].join("\n");
