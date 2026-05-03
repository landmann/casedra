import { api } from "@casedra/api";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { createConvexClient } from "@/server/convexClient";

const getDispatchSecret = (request: NextRequest) =>
	request.headers.get("x-casedra-newsletter-secret") ??
	request.nextUrl.searchParams.get("secret");

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const stringArray = (value: unknown) => (Array.isArray(value) ? value : []);

const extractEvent = (body: unknown) => {
	const record = asRecord(body);
	const message =
		typeof record.Message === "string" ? JSON.parse(record.Message) : record;
	const payload = asRecord(message);
	const eventType = String(payload.eventType ?? payload.notificationType ?? "");
	const mail = asRecord(payload.mail);
	const sesMessageId = typeof mail.messageId === "string" ? mail.messageId : undefined;
	const occurredAt = Date.parse(String(mail.timestamp ?? "")) || Date.now();

	if (eventType === "Bounce") {
		const bounce = asRecord(payload.bounce);
		const emails = stringArray(bounce.bouncedRecipients)
			.map((recipient) => asRecord(recipient).emailAddress)
			.filter((email): email is string => typeof email === "string");
		return { event: "bounce" as const, emails, sesMessageId, occurredAt, payload };
	}

	if (eventType === "Complaint") {
		const complaint = asRecord(payload.complaint);
		const emails = stringArray(complaint.complainedRecipients)
			.map((recipient) => asRecord(recipient).emailAddress)
			.filter((email): email is string => typeof email === "string");
		return { event: "complaint" as const, emails, sesMessageId, occurredAt, payload };
	}

	return null;
};

export async function POST(request: NextRequest) {
	if (!env.NEWSLETTER_DISPATCH_SECRET) {
		return NextResponse.json(
			{ error: "El procesamiento de eventos del informe no está configurado." },
			{ status: 503 },
		);
	}
	if (getDispatchSecret(request) !== env.NEWSLETTER_DISPATCH_SECRET) {
		return NextResponse.json({ error: "No autorizado." }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "El cuerpo JSON no es válido." }, { status: 400 });
	}

	const event = extractEvent(body);
	if (!event) {
		return NextResponse.json({ ok: true, ignored: true });
	}

	const convex = createConvexClient();
	for (const email of event.emails) {
		await convex.mutation(api.newsletter.recordSuppressionEvent, {
			dispatchSecret: env.NEWSLETTER_DISPATCH_SECRET,
			email,
			event: event.event,
			source: "ses",
			sesMessageId: event.sesMessageId,
			rawPayload: event.payload,
			occurredAt: event.occurredAt,
		});
	}

	return NextResponse.json({
		ok: true,
		event: event.event,
		affectedEmailCount: event.emails.length,
	});
}
