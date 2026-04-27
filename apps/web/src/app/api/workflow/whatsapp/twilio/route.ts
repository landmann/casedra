import { api } from "@casedra/api";
import { NextRequest, NextResponse } from "next/server";

import { createConvexClient } from "@/server/convexClient";
import {
	formDataToTwilioWebhookFields,
	getTwilioWebhookValidationUrl,
	isTwilioWhatsAppConfigured,
	normalizeTwilioWhatsAppInboundMessage,
	validateTwilioWebhookRequest,
} from "@/server/whatsapp/twilio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	if (!isTwilioWhatsAppConfigured()) {
		return NextResponse.json(
			{ error: "Twilio WhatsApp is not configured." },
			{ status: 503 },
		);
	}

	const agencySlug = request.nextUrl.searchParams.get("agencySlug")?.trim();
	if (!agencySlug) {
		return NextResponse.json(
			{ error: "Missing agencySlug query parameter." },
			{ status: 400 },
		);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json(
			{ error: "Invalid Twilio webhook body." },
			{ status: 400 },
		);
	}

	const fields = formDataToTwilioWebhookFields(formData);
	const isValidSignature = validateTwilioWebhookRequest({
		signature: request.headers.get("x-twilio-signature"),
		url: getTwilioWebhookValidationUrl(request.url),
		params: fields,
	});

	if (!isValidSignature) {
		return NextResponse.json(
			{ error: "Invalid Twilio signature." },
			{ status: 401 },
		);
	}

	let normalizedEvent;
	try {
		normalizedEvent = normalizeTwilioWhatsAppInboundMessage(fields);
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Failed to normalize the WhatsApp webhook payload.";

		return NextResponse.json({ error: message }, { status: 400 });
	}

	try {
		const convex = createConvexClient();
		const result = await convex.mutation(api.workflow.ingestWhatsAppMessage, {
			agencySlug,
			...normalizedEvent,
		});

		return NextResponse.json({ ok: true, ...result });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "WhatsApp ingestion failed.";

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
