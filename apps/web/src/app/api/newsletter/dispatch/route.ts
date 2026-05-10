import { api } from "@casedra/api";
import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { hashValue } from "@/server/buyers/forms";
import { createConvexClient } from "@/server/convexClient";
import { createUnsubscribeToken, sendNewsletterEmail } from "@/server/newsletter/ses";

const getDispatchSecret = (request: NextRequest) =>
	request.headers.get("x-casedra-newsletter-secret") ??
	request.nextUrl.searchParams.get("secret");

const buildDeliveryClaim = () => {
	const unsubscribeToken = createUnsubscribeToken();
	const unsubscribeTokenHash = hashValue(unsubscribeToken);
	if (!unsubscribeTokenHash) {
		throw new Error("No se pudo preparar el token de baja.");
	}

	return { unsubscribeToken, unsubscribeTokenHash };
};

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
	const claimed = await convex.mutation(api.newsletter.claimQueuedDeliveries, {
		dispatchSecret: env.NEWSLETTER_DISPATCH_SECRET,
		claims: Array.from({ length: 25 }, buildDeliveryClaim),
	});
	const results: Array<{ deliveryId: string; status: "sent" | "failed"; error?: string }> =
		[];

	for (const item of claimed) {
		try {
			const sendResult = await sendNewsletterEmail({
				to: item.delivery.email,
				subject: item.issue.subject,
				preheader: item.issue.preheader,
				body: item.issue.body,
				unsubscribeToken: item.unsubscribeToken,
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
