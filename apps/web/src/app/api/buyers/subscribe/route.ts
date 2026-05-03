import { api } from "@casedra/api";
import { NextRequest, NextResponse } from "next/server";

import {
	BUYER_PRIVACY_VERSION,
	BUYER_SIGNUP_CONSENT,
	buildRawBuyerPayload,
	buyerSubscribeSchema,
	enforceLightRateLimit,
	getRequestProof,
	hashValue,
} from "@/server/buyers/forms";
import { createConvexClient } from "@/server/convexClient";

export async function POST(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "El cuerpo JSON no es válido." }, { status: 400 });
	}

	const parsed = buyerSubscribeSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "El alta del comprador no es válida.", issues: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const payload = parsed.data;
	const proof = getRequestProof(request);
	const rateKey =
		hashValue(`${proof.ipHash ?? "unknown"}:${payload.email}:${payload.formPath}`) ??
		payload.email;
	if (!enforceLightRateLimit(rateKey)) {
		return NextResponse.json(
			{ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
			{ status: 429 },
		);
	}

	const convex = createConvexClient();
	const verifiedAgency = payload.agencySlug
		? await convex.query(api.newsletter.getPublicBuyerAgency, {
				agencySlug: payload.agencySlug,
			})
		: null;
	await convex.mutation(api.newsletter.publicSubscribe, {
		ownerType: verifiedAgency ? "agency" : "casedra",
		agencySlug: verifiedAgency?.slug,
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
			resolvedAgencySlug: verifiedAgency?.slug,
			routingMode: verifiedAgency ? "agency_link" : "casedra_public",
		}),
	});

	return NextResponse.json({ ok: true });
}
