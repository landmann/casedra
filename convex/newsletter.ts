import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentMembership } from "./auth";

const ownerTypeValidator = v.union(v.literal("casedra"), v.literal("agency"));
const languageValidator = v.union(v.literal("es"), v.literal("en"));
const audienceValidator = v.union(
	v.literal("buyers"),
	v.literal("sellers"),
	v.literal("investors"),
	v.literal("landlords"),
	v.literal("past_clients"),
);
const sourceValidator = v.union(
	v.literal("google_search"),
	v.literal("seo"),
	v.literal("linkedin"),
	v.literal("meta"),
	v.literal("partner"),
	v.literal("community"),
	v.literal("referral"),
	v.literal("manual"),
	v.literal("app"),
);
const signalValidator = v.union(
	v.literal("search_intent"),
	v.literal("mortgage_readiness"),
	v.literal("foreign_buyer"),
	v.literal("rental_fatigue"),
	v.literal("investor"),
	v.literal("hidden_address"),
	v.literal("area_heat"),
	v.literal("unknown"),
);
const contactPreferenceValidator = v.union(
	v.literal("email"),
	v.literal("whatsapp"),
	v.literal("phone"),
	v.literal("none"),
);
const draftStatusValidator = v.union(
	v.literal("draft"),
	v.literal("ready"),
	v.literal("archived"),
);
const suppressionEventValidator = v.union(
	v.literal("bounce"),
	v.literal("complaint"),
	v.literal("unsubscribe"),
	v.literal("manual_suppression"),
);

const sourceSnapshotValidator = v.array(
	v.object({
		label: v.string(),
		url: v.string(),
		description: v.optional(v.string()),
	}),
);

const agencySlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

const normalizeAgencySlug = (value: string) => {
	const normalized = value.trim().toLowerCase();
	if (!agencySlugPattern.test(normalized)) {
		return undefined;
	}
	return normalized;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const now = () => Date.now();

const raiseNewsletterError = (code: string, message: string): never => {
	throw new Error(`${code}:${message}`);
};

const requireDispatchSecret = (provided: string) => {
	const configured = process.env.NEWSLETTER_DISPATCH_SECRET;
	if (!configured) {
		raiseNewsletterError("FORBIDDEN", "Newsletter dispatch is not configured");
	}
	if (provided !== configured) {
		raiseNewsletterError("FORBIDDEN", "Newsletter dispatch secret is invalid");
	}
};

const resolveAgencyId = async (
	ctx: QueryCtx | MutationCtx,
	ownerType: "casedra" | "agency",
	agencySlug?: string,
) => {
	if (ownerType === "casedra") {
		return undefined;
	}
	if (!agencySlug) {
		raiseNewsletterError("VALIDATION", "Agency-owned newsletter records need an agency slug");
	}
	const resolvedAgencySlug = agencySlug as string;

	const agency = await ctx.db
		.query("agencies")
		.withIndex("by_slug", (q) => q.eq("slug", resolvedAgencySlug))
		.unique();
	if (!agency) {
		raiseNewsletterError("NOT_FOUND", "Agency not found");
	}

	return agency!._id;
};

const getSubscriberByAudience = async (
	ctx: QueryCtx | MutationCtx,
	args: {
		ownerType: "casedra" | "agency";
		agencyId?: Id<"agencies">;
		email: string;
		audience: Doc<"newsletterSubscribers">["audience"];
		market: string;
	},
) =>
	ctx.db
		.query("newsletterSubscribers")
		.withIndex("by_owner_email_audience_market", (q) =>
			q
				.eq("ownerType", args.ownerType)
				.eq("agencyId", args.agencyId)
				.eq("email", args.email)
				.eq("audience", args.audience)
				.eq("market", args.market),
		)
		.unique();

const insertConsentEvent = async (
	ctx: MutationCtx,
	args: {
		subscriberId: Id<"newsletterSubscribers">;
		event: Doc<"newsletterConsentEvents">["event"];
		source: Doc<"newsletterConsentEvents">["source"];
		campaign?: string;
		formPath: string;
		consentText: string;
		privacyVersion: string;
		ipHash?: string;
		userAgentHash?: string;
		occurredAt: number;
		rawPayload?: unknown;
	},
) =>
	ctx.db.insert("newsletterConsentEvents", {
		subscriberId: args.subscriberId,
		event: args.event,
		source: args.source,
		campaign: args.campaign,
		formPath: args.formPath,
		consentText: args.consentText,
		privacyVersion: args.privacyVersion,
		ipHash: args.ipHash,
		userAgentHash: args.userAgentHash,
		occurredAt: args.occurredAt,
		rawPayload: args.rawPayload,
	});

export const getPublicBuyerAgency = query({
	args: {
		agencySlug: v.string(),
	},
	handler: async (ctx, args) => {
		const slug = normalizeAgencySlug(args.agencySlug);
		if (!slug) {
			return null;
		}
		const agency = await ctx.db
			.query("agencies")
			.withIndex("by_slug", (q) => q.eq("slug", slug))
			.unique();
		if (!agency || agency.status !== "active") {
			return null;
		}
		return {
			name: agency.name,
			slug: agency.slug,
		};
	},
});

export const publicSubscribe = mutation({
	args: {
		ownerType: ownerTypeValidator,
		agencySlug: v.optional(v.string()),
		email: v.string(),
		fullName: v.optional(v.string()),
		language: languageValidator,
		audience: audienceValidator,
		market: v.string(),
		source: sourceValidator,
		campaign: v.optional(v.string()),
		signal: signalValidator,
		contactPreference: contactPreferenceValidator,
		formPath: v.string(),
		consentText: v.string(),
		privacyVersion: v.string(),
		ipHash: v.optional(v.string()),
		userAgentHash: v.optional(v.string()),
		rawPayload: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const timestamp = now();
		const agencyId = await resolveAgencyId(ctx, args.ownerType, args.agencySlug);
		const email = normalizeEmail(args.email);
		const existing = await getSubscriberByAudience(ctx, {
			ownerType: args.ownerType,
			agencyId,
			email,
			audience: args.audience,
			market: args.market,
		});

		const subscriberId = existing
			? existing._id
			: await ctx.db.insert("newsletterSubscribers", {
					ownerType: args.ownerType,
					agencyId,
					email,
					fullName: args.fullName,
					language: args.language,
					audience: args.audience,
					market: args.market,
					status: "subscribed",
					source: args.source,
					campaign: args.campaign,
					signal: args.signal,
					contactPreference: args.contactPreference,
					firstSubscribedAt: timestamp,
					lastConsentAt: timestamp,
					createdAt: timestamp,
					updatedAt: timestamp,
				});

		if (existing) {
			await ctx.db.patch(existing._id, {
				fullName: args.fullName ?? existing.fullName,
				language: args.language,
				status: "subscribed",
				source: args.source,
				campaign: args.campaign ?? existing.campaign,
				signal: args.signal,
				contactPreference: args.contactPreference,
				lastConsentAt: timestamp,
				unsubscribedAt: undefined,
				updatedAt: timestamp,
			});
		}

		const subscribeConsentEventId = await insertConsentEvent(ctx, {
			subscriberId,
			event: "subscribe",
			source: args.source,
			campaign: args.campaign,
			formPath: args.formPath,
			consentText: args.consentText,
			privacyVersion: args.privacyVersion,
			ipHash: args.ipHash,
			userAgentHash: args.userAgentHash,
			occurredAt: timestamp,
			rawPayload: args.rawPayload,
		});
		const privacyConsentEventId = await insertConsentEvent(ctx, {
			subscriberId,
			event: "privacy_accept",
			source: args.source,
			campaign: args.campaign,
			formPath: args.formPath,
			consentText: args.consentText,
			privacyVersion: args.privacyVersion,
			ipHash: args.ipHash,
			userAgentHash: args.userAgentHash,
			occurredAt: timestamp,
			rawPayload: args.rawPayload,
		});

		return {
			subscriberId,
			subscribeConsentEventId,
			privacyConsentEventId,
			reactivated: Boolean(existing),
		};
	},
});

export const listDrafts = query({
	args: {},
	handler: async (ctx) => {
		const { membership } = await requireCurrentMembership(ctx);
		const drafts = await ctx.db
			.query("newsletterDrafts")
			.withIndex("by_agency", (q) => q.eq("agencyId", membership.agencyId))
			.collect();

		return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
	},
});

export const saveDraft = mutation({
	args: {
		draftId: v.optional(v.id("newsletterDrafts")),
		market: v.string(),
		audience: audienceValidator,
		title: v.string(),
		subject: v.string(),
		preheader: v.string(),
		body: v.string(),
		sourceSnapshot: sourceSnapshotValidator,
		status: draftStatusValidator,
	},
	handler: async (ctx, args) => {
		const { membership, userId } = await requireCurrentMembership(ctx);
		const timestamp = now();

		if (args.draftId) {
			const draft = await ctx.db.get(args.draftId);
			if (!draft || draft.agencyId !== membership.agencyId) {
				raiseNewsletterError("NOT_FOUND", "Newsletter draft not found");
			}
			await ctx.db.patch(args.draftId, {
				market: args.market,
				audience: args.audience,
				title: args.title,
				subject: args.subject,
				preheader: args.preheader,
				body: args.body,
				sourceSnapshot: args.sourceSnapshot,
				status: args.status,
				updatedAt: timestamp,
			});
			return args.draftId;
		}

		return ctx.db.insert("newsletterDrafts", {
			agencyId: membership.agencyId,
			createdByUserId: userId,
			market: args.market,
			audience: args.audience,
			title: args.title,
			subject: args.subject,
			preheader: args.preheader,
			body: args.body,
			sourceSnapshot: args.sourceSnapshot,
			status: args.status,
			createdAt: timestamp,
			updatedAt: timestamp,
		});
	},
});

const launchDrafts = [
	{
		legacyTitle: "The buyer checklist before you bid.",
		title: "La lista del comprador antes de pujar.",
		subject: "Madrid: la lista del comprador antes de pujar",
		preheader:
			"NIE, hipoteca, impuestos, fuentes oficiales y qué comprobar antes de hacer una oferta.",
		body: "Una compra seria en Madrid empieza antes de la visita. Comprueba primero la base: NIE, preparación hipotecaria, impuestos y gastos totales, nota simple, identidad catastral, ITE/IEE, deudas de comunidad, certificado energético y riesgos locales.\n\nUsa el anuncio como la pregunta, no como la respuesta. Pide qué puede probarse, qué solo está descrito y qué necesita revisión profesional antes de pujar.",
	},
	{
		legacyTitle: "Hidden-address listings: what can and cannot be verified.",
		title: "Anuncios sin dirección: qué puede verificarse y qué no.",
		subject: "Anuncios sin dirección en Madrid: qué comprobar",
		preheader:
			"Cómo tratar anuncios que ocultan la dirección exacta antes de confiar en el precio.",
		body: "Una dirección oculta no inutiliza un anuncio, pero sí cambia la carga de prueba. Antes de pujar, separa qué puede verificarse desde el propio anuncio, qué necesita confirmación en fuente oficial y qué seguirá siendo desconocido hasta conocer la dirección exacta.\n\nLa decisión prudente no es adivinar. Prepara una lista corta, pide los datos que faltan y condiciona la oferta a la evidencia.",
	},
	{
		legacyTitle: "Foreign buyer Madrid pack: NIE, taxes, mortgage, and official checks.",
		title: "Pack Madrid para comprador extranjero: NIE, impuestos, hipoteca y comprobaciones.",
		subject: "Comprador extranjero en Madrid: documentos, impuestos, hipoteca y pruebas",
		preheader:
			"Los hechos que necesita un comprador internacional antes de confiar en un anuncio en Madrid.",
		body: "Un comprador extranjero necesita un proceso más pausado, más claro y más apoyado en pruebas. Antes de confiar en un anuncio, ordena el NIE, el recorrido de fondos, los impuestos, las exigencias hipotecarias y las comprobaciones oficiales de la vivienda.\n\nComprar a distancia encarece las respuestas vagas. Trata cada anuncio atractivo como un expediente que debe probarse: identidad legal, contexto de precio, estado del edificio y qué puede documentar el vendedor o la agencia.",
	},
] as const;

const launchSourceSnapshot = [
	{
		label: "Plan de captación de compradores",
		url: "internal:feat/outbound.md",
		description:
			"Secuencia de lanzamiento y estrategia de captación con consentimiento.",
	},
];

export const ensureLaunchBuyerBriefDrafts = mutation({
	args: {},
	handler: async (ctx) => {
		const { membership, userId } = await requireCurrentMembership(ctx);
		const timestamp = now();
		const existing = await ctx.db
			.query("newsletterDrafts")
			.withIndex("by_agency", (q) => q.eq("agencyId", membership.agencyId))
			.collect();
		const created: Id<"newsletterDrafts">[] = [];

		for (const draft of launchDrafts) {
			const existingDraft = existing.find(
				(item) => item.title === draft.title || item.title === draft.legacyTitle,
			);
			if (existingDraft) {
				if (existingDraft.title === draft.legacyTitle) {
					await ctx.db.patch(existingDraft._id, {
						title: draft.title,
						subject: draft.subject,
						preheader: draft.preheader,
						body: draft.body,
						sourceSnapshot: launchSourceSnapshot,
						updatedAt: timestamp,
					});
				}
				continue;
			}
			created.push(
				await ctx.db.insert("newsletterDrafts", {
					agencyId: membership.agencyId,
					createdByUserId: userId,
					market: "madrid",
					audience: "buyers",
					title: draft.title,
					subject: draft.subject,
					preheader: draft.preheader,
					body: draft.body,
					sourceSnapshot: launchSourceSnapshot,
					status: "draft",
					createdAt: timestamp,
					updatedAt: timestamp,
				}),
			);
		}

		return { createdCount: created.length, created };
	},
});

export const getOutboundOverview = query({
	args: {},
	handler: async (ctx) => {
		const { membership } = await requireCurrentMembership(ctx);
		const [agencyDrafts, casedraSubscribers, agencySubscribers, leads] =
			await Promise.all([
				ctx.db
					.query("newsletterDrafts")
					.withIndex("by_agency", (q) => q.eq("agencyId", membership.agencyId))
					.collect(),
				ctx.db
					.query("newsletterSubscribers")
					.withIndex("by_owner_status_market_audience", (q) =>
						q
							.eq("ownerType", "casedra")
							.eq("agencyId", undefined)
							.eq("status", "subscribed")
							.eq("market", "madrid")
							.eq("audience", "buyers"),
					)
					.collect(),
				ctx.db
					.query("newsletterSubscribers")
					.withIndex("by_owner_status_market_audience", (q) =>
						q
							.eq("ownerType", "agency")
							.eq("agencyId", membership.agencyId)
							.eq("status", "subscribed")
							.eq("market", "madrid")
							.eq("audience", "buyers"),
					)
					.collect(),
				ctx.db
					.query("leads")
					.withIndex("by_agency", (q) => q.eq("agencyId", membership.agencyId))
					.collect(),
			]);

		const subscribers = [...casedraSubscribers, ...agencySubscribers];
		const consentEvents = await Promise.all(
			subscribers.map((subscriber) =>
				ctx.db
					.query("newsletterConsentEvents")
					.withIndex("by_subscriber", (q) => q.eq("subscriberId", subscriber._id))
					.collect(),
			),
		);
		const consentCovered = consentEvents.filter(
			(events) =>
				events.some((event) => event.event === "subscribe") &&
				events.some((event) => event.event === "privacy_accept"),
		).length;
		const propertyQuestionCount = leads.filter(
			(lead) =>
				lead.kind === "buyer_inquiry" &&
				lead.sourceType === "web_form" &&
				lead.sourceLabel === "Consulta del Informe del Comprador",
		).length;

		return {
			buyerSubscriberCount: subscribers.length,
			consentProofCoveragePct:
				subscribers.length > 0
					? Math.round((consentCovered / subscribers.length) * 100)
					: 100,
			propertyQuestionCount,
			savedBuyerDraftCount: agencyDrafts.filter(
				(draft) => draft.audience === "buyers" && draft.market === "madrid",
			).length,
			readyDraftCount: agencyDrafts.filter((draft) => draft.status === "ready").length,
		};
	},
});

export const createIssueFromDraft = mutation({
	args: {
		draftId: v.id("newsletterDrafts"),
	},
	handler: async (ctx, args) => {
		const { membership, userId } = await requireCurrentMembership(ctx);
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			raiseNewsletterError("NOT_FOUND", "Newsletter draft not found");
		}
		const draftDoc = draft!;
		if (draftDoc.agencyId !== membership.agencyId) {
			raiseNewsletterError("NOT_FOUND", "Newsletter draft not found");
		}
		if (draftDoc.status !== "ready") {
			raiseNewsletterError("VALIDATION", "Only ready drafts can become issues");
		}
		const timestamp = now();
		return ctx.db.insert("newsletterIssues", {
			agencyId: membership.agencyId,
			draftId: draftDoc._id,
			createdByUserId: userId,
			market: draftDoc.market,
			audience: draftDoc.audience,
			title: draftDoc.title,
			subject: draftDoc.subject,
			preheader: draftDoc.preheader,
			body: draftDoc.body,
			sourceSnapshot: draftDoc.sourceSnapshot,
			status: "draft",
			createdAt: timestamp,
			updatedAt: timestamp,
		});
	},
});

export const queueIssueDeliveries = mutation({
	args: {
		issueId: v.id("newsletterIssues"),
	},
	handler: async (ctx, args) => {
		const { membership } = await requireCurrentMembership(ctx);
		const issue = await ctx.db.get(args.issueId);
		if (!issue) {
			raiseNewsletterError("NOT_FOUND", "Newsletter issue not found");
		}
		const issueDoc = issue!;
		if (issueDoc.agencyId !== membership.agencyId) {
			raiseNewsletterError("NOT_FOUND", "Newsletter issue not found");
		}
		const timestamp = now();
		const [casedraSubscribers, agencySubscribers, existingDeliveries] = await Promise.all([
			ctx.db
				.query("newsletterSubscribers")
				.withIndex("by_owner_status_market_audience", (q) =>
					q
						.eq("ownerType", "casedra")
						.eq("agencyId", undefined)
						.eq("status", "subscribed")
						.eq("market", issueDoc.market)
						.eq("audience", issueDoc.audience),
				)
				.collect(),
			ctx.db
				.query("newsletterSubscribers")
				.withIndex("by_owner_status_market_audience", (q) =>
					q
						.eq("ownerType", "agency")
						.eq("agencyId", membership.agencyId)
						.eq("status", "subscribed")
						.eq("market", issueDoc.market)
						.eq("audience", issueDoc.audience),
				)
				.collect(),
			ctx.db
				.query("newsletterDeliveries")
				.withIndex("by_issue", (q) => q.eq("issueId", issueDoc._id))
				.collect(),
		]);
		const subscribers = [...casedraSubscribers, ...agencySubscribers];
		const existingSubscriberIds = new Set(
			existingDeliveries.map((delivery) => delivery.subscriberId),
		);
		let queuedCount = 0;

		for (const subscriber of subscribers) {
			if (existingSubscriberIds.has(subscriber._id)) {
				continue;
			}
			const events = await ctx.db
				.query("newsletterConsentEvents")
				.withIndex("by_subscriber", (q) => q.eq("subscriberId", subscriber._id))
				.collect();
			const hasConsent =
				events.some((event) => event.event === "subscribe") &&
				events.some((event) => event.event === "privacy_accept");
			if (!hasConsent) {
				continue;
			}
			await ctx.db.insert("newsletterDeliveries", {
				issueId: issueDoc._id,
				subscriberId: subscriber._id,
				email: subscriber.email,
				status: "queued",
				attemptCount: 0,
				createdAt: timestamp,
				updatedAt: timestamp,
			});
			queuedCount += 1;
		}

		await ctx.db.patch(issueDoc._id, {
			status: queuedCount > 0 ? "queued" : issueDoc.status,
			updatedAt: timestamp,
		});

		return { queuedCount };
	},
});

export const listQueuedDeliveries = query({
	args: {
		dispatchSecret: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		requireDispatchSecret(args.dispatchSecret);
		const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
		const deliveries = await ctx.db
			.query("newsletterDeliveries")
			.withIndex("by_status", (q) => q.eq("status", "queued"))
			.take(limit);

		return Promise.all(
			deliveries.map(async (delivery) => {
				const [issue, subscriber] = await Promise.all([
					ctx.db.get(delivery.issueId),
					ctx.db.get(delivery.subscriberId),
				]);
				return { delivery, issue, subscriber };
			}),
		);
	},
});

export const markDeliverySending = mutation({
	args: {
		dispatchSecret: v.string(),
		deliveryId: v.id("newsletterDeliveries"),
		unsubscribeTokenHash: v.string(),
	},
	handler: async (ctx, args) => {
		requireDispatchSecret(args.dispatchSecret);
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery) {
			raiseNewsletterError("NOT_FOUND", "Newsletter delivery not found");
		}
		const deliveryDoc = delivery!;
		const timestamp = now();
		await Promise.all([
			ctx.db.patch(deliveryDoc._id, {
				status: "sending",
				attemptCount: deliveryDoc.attemptCount + 1,
				lastAttemptAt: timestamp,
				updatedAt: timestamp,
			}),
			ctx.db.patch(deliveryDoc.subscriberId, {
				unsubscribeTokenHash: args.unsubscribeTokenHash,
				updatedAt: timestamp,
			}),
		]);
		return { ok: true };
	},
});

export const markDeliverySent = mutation({
	args: {
		dispatchSecret: v.string(),
		deliveryId: v.id("newsletterDeliveries"),
		sesMessageId: v.string(),
	},
	handler: async (ctx, args) => {
		requireDispatchSecret(args.dispatchSecret);
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery) {
			raiseNewsletterError("NOT_FOUND", "Newsletter delivery not found");
		}
		const deliveryDoc = delivery!;
		const timestamp = now();
		await ctx.db.patch(deliveryDoc._id, {
			status: "sent",
			sesMessageId: args.sesMessageId,
			sentAt: timestamp,
			updatedAt: timestamp,
		});
		return { ok: true };
	},
});

export const markDeliveryFailed = mutation({
	args: {
		dispatchSecret: v.string(),
		deliveryId: v.id("newsletterDeliveries"),
		errorMessage: v.string(),
	},
	handler: async (ctx, args) => {
		requireDispatchSecret(args.dispatchSecret);
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery) {
			raiseNewsletterError("NOT_FOUND", "Newsletter delivery not found");
		}
		const deliveryDoc = delivery!;
		const timestamp = now();
		await ctx.db.patch(deliveryDoc._id, {
			status: "failed",
			errorMessage: args.errorMessage,
			failedAt: timestamp,
			updatedAt: timestamp,
		});
		return { ok: true };
	},
});

export const recordSuppressionEvent = mutation({
	args: {
		dispatchSecret: v.string(),
		email: v.string(),
		event: suppressionEventValidator,
		source: v.union(v.literal("ses"), v.literal("public_unsubscribe"), v.literal("manual")),
		sesMessageId: v.optional(v.string()),
		rawPayload: v.optional(v.any()),
		occurredAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		requireDispatchSecret(args.dispatchSecret);
		const timestamp = args.occurredAt ?? now();
		const email = normalizeEmail(args.email);
		const subscribers = await ctx.db
			.query("newsletterSubscribers")
			.withIndex("by_email", (q) => q.eq("email", email))
			.collect();

		for (const subscriber of subscribers) {
			await ctx.db.patch(subscriber._id, {
				status: args.event === "bounce" ? "bounced" : "suppressed",
				updatedAt: timestamp,
			});
			await ctx.db.insert("newsletterSuppressionEvents", {
				subscriberId: subscriber._id,
				email,
				event: args.event,
				source: args.source,
				sesMessageId: args.sesMessageId,
				rawPayload: args.rawPayload,
				occurredAt: timestamp,
				createdAt: now(),
			});
		}

		if (subscribers.length === 0) {
			await ctx.db.insert("newsletterSuppressionEvents", {
				email,
				event: args.event,
				source: args.source,
				sesMessageId: args.sesMessageId,
				rawPayload: args.rawPayload,
				occurredAt: timestamp,
				createdAt: now(),
			});
		}

		return { affectedSubscriberCount: subscribers.length };
	},
});

export const unsubscribeByTokenHash = mutation({
	args: {
		tokenHash: v.string(),
		formPath: v.string(),
		rawPayload: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const subscriber = await ctx.db
			.query("newsletterSubscribers")
			.withIndex("by_unsubscribe_token", (q) =>
				q.eq("unsubscribeTokenHash", args.tokenHash),
			)
			.unique();
		if (!subscriber) {
			return { ok: true };
		}
		const timestamp = now();
		await ctx.db.patch(subscriber._id, {
			status: "unsubscribed",
			unsubscribedAt: timestamp,
			updatedAt: timestamp,
		});
		await insertConsentEvent(ctx, {
			subscriberId: subscriber._id,
			event: "unsubscribe",
			source: subscriber.source,
			campaign: subscriber.campaign,
			formPath: args.formPath,
			consentText: "Subscriber used the public unsubscribe link.",
			privacyVersion: "informe-comprador-2026-05-03",
			occurredAt: timestamp,
			rawPayload: args.rawPayload,
		});
		await ctx.db.insert("newsletterSuppressionEvents", {
			subscriberId: subscriber._id,
			email: subscriber.email,
			event: "unsubscribe",
			source: "public_unsubscribe",
			rawPayload: args.rawPayload,
			occurredAt: timestamp,
			createdAt: timestamp,
		});

		return { ok: true };
	},
});
