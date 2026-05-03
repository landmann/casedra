import { api } from "@casedra/api";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { hashValue } from "@/server/buyers/forms";
import { createConvexClient } from "@/server/convexClient";
import { createUnsubscribeToken, sendNewsletterEmail } from "@/server/newsletter/ses";

const getDispatchSecret = (request: NextRequest) =>
	request.headers.get("x-casedra-newsletter-secret") ??
	request.nextUrl.searchParams.get("secret");

export async function POST(request: NextRequest) {
	if (!env.NEWSLETTER_DISPATCH_SECRET) {
		return NextResponse.json(
			{ error: "El envío del informe no está configurado." },
			{ status: 503 },
		);
	}
	if (getDispatchSecret(request) !== env.NEWSLETTER_DISPATCH_SECRET) {
		return NextResponse.json({ error: "No autorizado." }, { status: 401 });
	}

	const convex = createConvexClient();
	const queued = await convex.query(api.newsletter.listQueuedDeliveries, {
		dispatchSecret: env.NEWSLETTER_DISPATCH_SECRET,
		limit: 25,
	});
	const results: Array<{ deliveryId: string; status: "sent" | "failed"; error?: string }> =
		[];

	for (const item of queued) {
		if (!item.issue || !item.subscriber) {
			continue;
		}
		const unsubscribeToken = createUnsubscribeToken();
		const unsubscribeTokenHash = hashValue(unsubscribeToken);
		if (!unsubscribeTokenHash) {
			continue;
		}

		await convex.mutation(api.newsletter.markDeliverySending, {
			dispatchSecret: env.NEWSLETTER_DISPATCH_SECRET,
			deliveryId: item.delivery._id,
			unsubscribeTokenHash,
		});

		try {
			const sendResult = await sendNewsletterEmail({
				to: item.delivery.email,
				subject: item.issue.subject,
				preheader: item.issue.preheader,
				body: item.issue.body,
				unsubscribeToken,
			});
			if (!sendResult.messageId) {
				throw new Error("SES no devolvió identificador de mensaje.");
			}
			await convex.mutation(api.newsletter.markDeliverySent, {
				dispatchSecret: env.NEWSLETTER_DISPATCH_SECRET,
				deliveryId: item.delivery._id,
				sesMessageId: sendResult.messageId,
			});
			results.push({ deliveryId: item.delivery._id, status: "sent" });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "No se pudo enviar el informe.";
			await convex.mutation(api.newsletter.markDeliveryFailed, {
				dispatchSecret: env.NEWSLETTER_DISPATCH_SECRET,
				deliveryId: item.delivery._id,
				errorMessage: message,
			});
			results.push({
				deliveryId: item.delivery._id,
				status: "failed",
				error: message,
			});
		}
	}

	return NextResponse.json({
		ok: true,
		processedCount: results.length,
		results,
	});
}
