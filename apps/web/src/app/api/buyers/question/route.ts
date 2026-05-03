import { createHash } from "node:crypto";

import { api } from "@casedra/api";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import {
	BUYER_PRIVACY_VERSION,
	BUYER_QUESTION_CONSENT,
	BUYER_SIGNUP_CONSENT,
	buildBuyerQuestionMessage,
	buildRawBuyerPayload,
	buyerQuestionSchema,
	enforceLightRateLimit,
	getRequestProof,
	hashValue,
} from "@/server/buyers/forms";
import { createConvexClient } from "@/server/convexClient";

const resolveVerifiedAgency = async (
	convex: ReturnType<typeof createConvexClient>,
	agencySlug?: string,
) => {
	if (!agencySlug) {
		return null;
	}
	return convex.query(api.newsletter.getPublicBuyerAgency, { agencySlug });
};

const buildDedupeKey = (payload: {
	email?: string;
	phone?: string;
	propertyUrl: string;
	question: string;
	formPath: string;
}) =>
	createHash("sha256")
		.update(
			[
				payload.email ?? "",
				payload.phone ?? "",
				payload.propertyUrl,
				payload.question,
				payload.formPath,
			].join("|"),
		)
	.digest("hex");

export async function POST(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "El cuerpo JSON no es válido." }, { status: 400 });
	}

	const parsed = buyerQuestionSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "La consulta del comprador no es válida.", issues: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const payload = parsed.data;
	const proof = getRequestProof(request);
	const rateKey =
		hashValue(
			`${proof.ipHash ?? "unknown"}:${payload.email ?? payload.phone}:${payload.formPath}`,
		) ?? payload.propertyUrl;
	if (!enforceLightRateLimit(rateKey)) {
		return NextResponse.json(
			{ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
			{ status: 429 },
		);
	}

	const convex = createConvexClient();
	const requestedAgency = await resolveVerifiedAgency(convex, payload.agencySlug);
	const fallbackAgency = requestedAgency
		? null
		: await resolveVerifiedAgency(convex, env.BUYER_INTAKE_FALLBACK_AGENCY_SLUG);
	const routingAgency = requestedAgency ?? fallbackAgency;
	const routingMode = requestedAgency
		? "agency_link"
		: fallbackAgency
			? "fallback"
			: "unrouted";
	if (!routingAgency) {
		return NextResponse.json(
			{ error: "La recepción de consultas de comprador no está configurada." },
			{ status: 503 },
		);
	}

	let consentEventId: string | undefined;
	if (payload.subscribeToBrief && payload.email) {
		const subscribeResult = await convex.mutation(api.newsletter.publicSubscribe, {
			ownerType: requestedAgency ? "agency" : "casedra",
			agencySlug: requestedAgency?.slug,
			email: payload.email,
			fullName: payload.fullName,
			language: payload.language,
			audience: payload.audience,
			market: payload.market,
			source: payload.source,
			campaign: payload.campaign,
			signal: payload.signal,
			contactPreference: payload.contactPreference,
			formPath: payload.formPath,
			consentText: BUYER_SIGNUP_CONSENT,
			privacyVersion: BUYER_PRIVACY_VERSION,
			ipHash: proof.ipHash,
			userAgentHash: proof.userAgentHash,
			rawPayload: buildRawBuyerPayload(payload, {
				propertyUrl: payload.propertyUrl,
				budgetBand: payload.budgetBand,
				buyingTimeline: payload.buyingTimeline,
				resolvedAgencySlug: requestedAgency?.slug,
				routingMode: requestedAgency ? "agency_link" : "casedra_public",
			}),
		});
		consentEventId = subscribeResult.subscribeConsentEventId;
	}

	const sentAt = Date.now();
	const dedupeKey = buildDedupeKey(payload);
	const questionConsentProofId =
		consentEventId ??
		hashValue(
			[
				dedupeKey,
				BUYER_QUESTION_CONSENT,
				BUYER_PRIVACY_VERSION,
				proof.ipHash ?? "",
				proof.userAgentHash ?? "",
			].join("|"),
		);
	await convex.mutation(api.workflow.ingestBuyerWebForm, {
		agencySlug: routingAgency.slug,
		channel: {
			externalChannelId: `informe-comprador-${routingAgency.slug}`,
			label: "Consulta del Informe del Comprador",
			provider: "web",
		},
		contact: {
			fullName: payload.fullName,
			email: payload.email,
			phone: payload.phone,
			preferredLanguage: payload.language,
			notes: [
				payload.subscribeToBrief
					? "Aceptó recibir el Informe del Comprador."
					: "Envió una consulta del Informe del Comprador sin aceptar el boletín.",
				routingMode === "agency_link"
					? `Enrutado desde enlace verificado de agencia: ${routingAgency.slug}.`
					: "Enrutado mediante el destino de respaldo para compradores.",
			].join(" "),
		},
		lead: {
			externalLeadId: dedupeKey,
			sourceLabel: "Consulta del Informe del Comprador",
			rawPayload: buildRawBuyerPayload(payload, {
				propertyUrl: payload.propertyUrl,
				budgetBand: payload.budgetBand,
				buyingTimeline: payload.buyingTimeline,
				contactPreference: payload.contactPreference,
				consentProofId: questionConsentProofId,
				consentText: BUYER_QUESTION_CONSENT,
				privacyVersion: BUYER_PRIVACY_VERSION,
				requestedAgencySlug: payload.agencySlug,
				resolvedAgencySlug: routingAgency.slug,
				routingMode,
			}),
		},
		message: {
			body: buildBuyerQuestionMessage(payload),
			sentAt,
			dedupeKey,
			metadata: {
				propertyUrl: payload.propertyUrl,
				budgetBand: payload.budgetBand,
				buyingTimeline: payload.buyingTimeline,
				contactPreference: payload.contactPreference,
				consentProofId: questionConsentProofId,
				formPath: payload.formPath,
				campaign: payload.campaign,
				signal: payload.signal,
				requestedAgencySlug: payload.agencySlug,
				resolvedAgencySlug: routingAgency.slug,
				routingMode,
			},
		},
		summary: `Consulta de comprador sobre ${payload.propertyUrl}`,
		nextRecommendedStep:
			payload.contactPreference === "whatsapp"
				? "Responder en la bandeja y continuar por WhatsApp solo porque el comprador eligió ese canal."
				: "Responder en la bandeja con las primeras comprobaciones verificables y pedir las restricciones de compra que falten.",
	});

	return NextResponse.json({ ok: true });
}
