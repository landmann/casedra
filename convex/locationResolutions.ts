import type { LocalizaTableHistoryRow } from "@casedra/types";
import { type Infer, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUserId } from "./auth";
import {
	normalizeLocalizaMarketObservation,
	requireLocalizaMarketObservationText as requireText,
} from "./localizaMarketObservations";
import { buildLocalizaMetricsSnapshot } from "./localizaMetrics";
import { canCompleteLocationResolutionLease } from "./locationResolutionLease";

const listingLocationValidator = v.object({
	street: v.string(),
	city: v.string(),
	stateOrProvince: v.string(),
	postalCode: v.string(),
	country: v.string(),
});

const requestedStrategyValidator = v.union(
	v.literal("auto"),
	v.literal("idealista_api"),
	v.literal("firecrawl"),
	v.literal("browser_worker"),
);

const acquisitionMethodValidator = v.union(
	v.literal("url_parse"),
	v.literal("idealista_api"),
	v.literal("firecrawl"),
	v.literal("browser_worker"),
);

const territoryAdapterValidator = v.union(
	v.literal("state_catastro"),
	v.literal("navarra_rtn"),
	v.literal("alava_catastro"),
	v.literal("bizkaia_catastro"),
	v.literal("gipuzkoa_catastro"),
);

const locationResolutionResultStatusValidator = v.union(
	v.literal("exact_match"),
	v.literal("building_match"),
	v.literal("needs_confirmation"),
	v.literal("unresolved"),
);

const sourceMetadataValidator = v.object({
	provider: v.literal("idealista"),
	externalListingId: v.string(),
	sourceUrl: v.string(),
});

const localizaDossierImageValidator = v.object({
	imageUrl: v.string(),
	thumbnailUrl: v.optional(v.string()),
	sourcePortal: v.string(),
	sourceUrl: v.string(),
	observedAt: v.string(),
	lastVerifiedAt: v.optional(v.string()),
	sourcePublishedAt: v.optional(v.string()),
	caption: v.optional(v.string()),
});

const localizaOnlineEvidenceKindValidator = v.union(
	v.literal("listing_archive"),
	v.literal("building_cadastre"),
	v.literal("building_condition"),
	v.literal("official_cadastre"),
	v.literal("energy_certificate"),
	v.literal("solar_potential"),
	v.literal("risk_overlay"),
	v.literal("local_amenity"),
	v.literal("planning_heritage"),
	v.literal("market_benchmark"),
	v.literal("licensed_feed"),
);

const localizaOnlineEvidenceItemValidator = v.object({
	label: v.string(),
	value: v.string(),
	sourceLabel: v.string(),
	sourceUrl: v.optional(v.string()),
	observedAt: v.optional(v.string()),
	kind: localizaOnlineEvidenceKindValidator,
});

const localizaPropertyDossierValidator = v.object({
	listingSnapshot: v.object({
		title: v.optional(v.string()),
		leadImageUrl: v.optional(v.string()),
		askingPrice: v.optional(v.number()),
		currencyCode: v.optional(v.literal("EUR")),
		priceIncludesParking: v.optional(v.boolean()),
		areaM2: v.optional(v.number()),
		bedrooms: v.optional(v.number()),
		bathrooms: v.optional(v.number()),
		floorText: v.optional(v.string()),
		isExterior: v.optional(v.boolean()),
		hasElevator: v.optional(v.boolean()),
		sourcePortal: v.literal("idealista"),
		sourceUrl: v.string(),
	}),
	imageGallery: v.array(localizaDossierImageValidator),
	onlineEvidence: v.optional(v.array(localizaOnlineEvidenceItemValidator)),
	officialIdentity: v.object({
		proposedAddressLabel: v.optional(v.string()),
		street: v.optional(v.string()),
		number: v.optional(v.string()),
		staircase: v.optional(v.string()),
		floor: v.optional(v.string()),
		door: v.optional(v.string()),
		postalCode: v.optional(v.string()),
		municipality: v.optional(v.string()),
		province: v.optional(v.string()),
		parcelRef14: v.optional(v.string()),
		unitRef20: v.optional(v.string()),
		officialSource: v.string(),
		officialSourceUrl: v.optional(v.string()),
	}),
	publicHistory: v.array(
		v.object({
			observedAt: v.string(),
			askingPrice: v.optional(v.number()),
			currencyCode: v.optional(v.literal("EUR")),
			portal: v.string(),
			advertiserName: v.optional(v.string()),
			agencyName: v.optional(v.string()),
			sourceUrl: v.optional(v.string()),
			daysPublished: v.optional(v.number()),
		}),
	),
	duplicateGroup: v.object({
		count: v.number(),
		records: v.array(
			v.object({
				portal: v.string(),
				sourceUrl: v.optional(v.string()),
				advertiserName: v.optional(v.string()),
				agencyName: v.optional(v.string()),
				firstSeenAt: v.optional(v.string()),
				lastSeenAt: v.optional(v.string()),
				askingPrice: v.optional(v.number()),
			}),
		),
	}),
	publicationDurations: v.array(
		v.object({
			label: v.string(),
			kind: v.union(
				v.literal("advertiser"),
				v.literal("agency"),
				v.literal("portal"),
			),
			daysPublished: v.number(),
		}),
	),
	actions: v.object({
		reportDownloadUrl: v.optional(v.string()),
		valuationUrl: v.optional(v.string()),
	}),
});

const resolutionEvidenceValidator = v.object({
	reasonCodes: v.array(v.string()),
	matchedSignals: v.array(v.string()),
	discardedSignals: v.array(v.string()),
	candidateCount: v.number(),
	requestedStrategy: requestedStrategyValidator,
	actualAcquisitionMethod: v.optional(acquisitionMethodValidator),
	officialSource: v.string(),
	officialSourceUrl: v.optional(v.string()),
	territoryAdapter: v.optional(territoryAdapterValidator),
});

const resolutionCandidateValidator = v.object({
	id: v.string(),
	label: v.string(),
	parcelRef14: v.optional(v.string()),
	unitRef20: v.optional(v.string()),
	officialUrl: v.optional(v.string()),
	distanceMeters: v.optional(v.number()),
	score: v.number(),
	reasonCodes: v.array(v.string()),
	prefillLocation: v.optional(listingLocationValidator),
	selectionDisabled: v.optional(v.boolean()),
	rationale: v.optional(
		v.object({
			title: v.string(),
			description: v.string(),
			sourceLabel: v.optional(v.string()),
			sourceUrl: v.optional(v.string()),
			matchedSignals: v.array(v.string()),
			discardedSignals: v.array(v.string()),
		}),
	),
});

const resolveIdealistaLocationResultValidator = v.object({
	status: locationResolutionResultStatusValidator,
	requestedStrategy: requestedStrategyValidator,
	confidenceScore: v.number(),
	officialSource: v.string(),
	officialSourceUrl: v.optional(v.string()),
	territoryAdapter: v.optional(territoryAdapterValidator),
	resolverVersion: v.string(),
	resolvedAt: v.string(),
	resolvedAddressLabel: v.optional(v.string()),
	parcelRef14: v.optional(v.string()),
	unitRef20: v.optional(v.string()),
	prefillLocation: v.optional(listingLocationValidator),
	candidates: v.array(resolutionCandidateValidator),
	evidence: resolutionEvidenceValidator,
	sourceMetadata: sourceMetadataValidator,
	propertyDossier: v.optional(localizaPropertyDossierValidator),
	cacheExpiresAt: v.optional(v.string()),
});

type ResolveIdealistaLocationResultValue = Infer<
	typeof resolveIdealistaLocationResultValidator
>;

const lookupArgsValidator = {
	provider: v.literal("idealista"),
	externalListingId: v.string(),
	requestedStrategy: requestedStrategyValidator,
	resolverVersion: v.string(),
};

export const getByLookup = query({
	args: lookupArgsValidator,
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		return await ctx.db
			.query("locationResolutions")
			.withIndex("by_lookup", (q) =>
				q
					.eq("provider", args.provider)
					.eq("externalListingId", args.externalListingId)
					.eq("requestedStrategy", args.requestedStrategy)
					.eq("resolverVersion", args.resolverVersion),
			)
			.first();
	},
});

export const getBySourceUrl = query({
	args: {
		sourceUrl: v.string(),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const matches = await ctx.db
			.query("locationResolutions")
			.withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
			.collect();

		return (
			matches.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
		);
	},
});

export const getLatestSuccessfulBySourceUrl = query({
	args: {
		sourceUrl: v.string(),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const matches = await ctx.db
			.query("locationResolutions")
			.withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
			.collect();

		return (
			matches
				.filter(
					(record) =>
						record.result &&
						record.normalizedSignals &&
						record.resultStatus !== "unresolved",
				)
				.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
		);
	},
});

export const getPropertyHistoryByKey = query({
	args: {
		propertyHistoryKey: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
		const records = await ctx.db
			.query("locationResolutions")
			.withIndex("by_property_history_key", (q) =>
				q.eq("propertyHistoryKey", args.propertyHistoryKey),
			)
			.order("desc")
			.take(limit);

		return records
			.map((record) => record.result?.propertyDossier)
			.filter((dossier) => Boolean(dossier));
	},
});

export const getMarketObservationsByKey = query({
	args: {
		propertyHistoryKey: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const propertyHistoryKey = requireText(
			args.propertyHistoryKey,
			"property_history_key",
		);
		const limit = Math.min(Math.max(args.limit ?? 100, 1), 250);
		const records = await ctx.db
			.query("localizaMarketObservations")
			.withIndex("by_property_history_key", (q) =>
				q.eq("propertyHistoryKey", propertyHistoryKey),
			)
			.order("desc")
			.take(limit);

		return records.map((record) => ({
			_id: record._id,
			propertyHistoryKey: record.propertyHistoryKey,
			portal: record.portal,
			observedAt: record.observedAt,
			askingPrice: record.askingPrice,
			currencyCode: record.currencyCode,
			advertiserName: record.advertiserName,
			agencyName: record.agencyName,
			sourceUrl: record.sourceUrl,
			daysPublished: record.daysPublished,
			firstSeenAt: record.firstSeenAt,
			lastSeenAt: record.lastSeenAt,
			provenanceLabel: record.provenanceLabel,
			provenanceUrl: record.provenanceUrl,
			sourceRecordId: record.sourceRecordId,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		}));
	},
});

export const listRecentMarketObservations = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
		const records = await ctx.db
			.query("localizaMarketObservations")
			.order("desc")
			.take(limit);

		return records.map((record) => ({
			_id: record._id,
			propertyHistoryKey: record.propertyHistoryKey,
			portal: record.portal,
			observedAt: record.observedAt,
			askingPrice: record.askingPrice,
			currencyCode: record.currencyCode,
			advertiserName: record.advertiserName,
			agencyName: record.agencyName,
			sourceUrl: record.sourceUrl,
			daysPublished: record.daysPublished,
			provenanceLabel: record.provenanceLabel,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		}));
	},
});

export const listRecentPropertyHistoryKeys = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const limit = Math.min(Math.max(args.limit ?? 12, 1), 50);
		const records = await ctx.db
			.query("locationResolutions")
			.order("desc")
			.take(250);
		const keysByValue = new Map<
			string,
			{
				propertyHistoryKey: string;
				label?: string;
				unitRef20?: string;
				parcelRef14?: string;
				sourceUrl: string;
				resolverVersion: string;
				updatedAt: number;
			}
		>();

		for (const record of records) {
			if (
				!record.propertyHistoryKey ||
				keysByValue.has(record.propertyHistoryKey)
			) {
				continue;
			}

			keysByValue.set(record.propertyHistoryKey, {
				propertyHistoryKey: record.propertyHistoryKey,
				label:
					record.result?.propertyDossier?.officialIdentity
						.proposedAddressLabel ?? record.result?.resolvedAddressLabel,
				unitRef20: record.result?.propertyDossier?.officialIdentity.unitRef20,
				parcelRef14:
					record.result?.propertyDossier?.officialIdentity.parcelRef14,
				sourceUrl: record.sourceUrl,
				resolverVersion: record.resolverVersion,
				updatedAt: record.updatedAt,
			});

			if (keysByValue.size >= limit) {
				break;
			}
		}

		return Array.from(keysByValue.values());
	},
});

const localizaMarketObservationInputValidator = {
	propertyHistoryKey: v.string(),
	portal: v.string(),
	observedAt: v.string(),
	askingPrice: v.optional(v.number()),
	currencyCode: v.optional(v.literal("EUR")),
	advertiserName: v.optional(v.string()),
	agencyName: v.optional(v.string()),
	sourceUrl: v.optional(v.string()),
	daysPublished: v.optional(v.number()),
	firstSeenAt: v.optional(v.string()),
	lastSeenAt: v.optional(v.string()),
	provenanceLabel: v.string(),
	provenanceUrl: v.optional(v.string()),
	sourceRecordId: v.optional(v.string()),
};

export const upsertMarketObservation = mutation({
	args: {
		...localizaMarketObservationInputValidator,
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const normalizedObservation = normalizeLocalizaMarketObservation(args);
		const existing = await ctx.db
			.query("localizaMarketObservations")
			.withIndex("by_observation_key", (q) =>
				q.eq("observationKey", normalizedObservation.observationKey),
			)
			.first();
		const record = {
			...normalizedObservation,
			updatedAt: now,
		};

		if (existing) {
			await ctx.db.patch(existing._id, record);
			return { id: existing._id, created: false };
		}

		const id = await ctx.db.insert("localizaMarketObservations", {
			...record,
			createdByUserId: userId,
			createdAt: now,
		});

		return { id, created: true };
	},
});

export const upsertMarketObservations = mutation({
	args: {
		observations: v.array(v.object(localizaMarketObservationInputValidator)),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const normalizedByKey = new Map<
			string,
			ReturnType<typeof normalizeLocalizaMarketObservation>
		>();

		for (const observation of args.observations.slice(0, 100)) {
			const normalizedObservation =
				normalizeLocalizaMarketObservation(observation);
			normalizedByKey.set(
				normalizedObservation.observationKey,
				normalizedObservation,
			);
		}

		let created = 0;
		let updated = 0;

		for (const normalizedObservation of normalizedByKey.values()) {
			const existing = await ctx.db
				.query("localizaMarketObservations")
				.withIndex("by_observation_key", (q) =>
					q.eq("observationKey", normalizedObservation.observationKey),
				)
				.first();
			const record = {
				...normalizedObservation,
				updatedAt: now,
			};

			if (existing) {
				await ctx.db.patch(existing._id, record);
				updated += 1;
				continue;
			}

			await ctx.db.insert("localizaMarketObservations", {
				...record,
				createdByUserId: userId,
				createdAt: now,
			});
			created += 1;
		}

		return {
			created,
			updated,
			total: created + updated,
		};
	},
});

const normalizeUserHistoryUrlKey = (sourceUrl: string) => {
	try {
		const parsedUrl = new URL(sourceUrl.trim());
		parsedUrl.hash = "";
		parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
		parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

		return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
	} catch {
		return sourceUrl.trim().replace(/\/+$/, "").toLowerCase();
	}
};

const normalizePropertyHistoryKeyPart = (value?: string) =>
	value
		?.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

const getUserHistoryPropertyKey = (
	result: ResolveIdealistaLocationResultValue,
) => {
	const identity = result.propertyDossier?.officialIdentity;

	if (!identity) {
		return undefined;
	}

	if (identity.unitRef20) {
		return `unit:${identity.unitRef20.toUpperCase()}`;
	}

	if (identity.parcelRef14) {
		return `parcel:${identity.parcelRef14.toUpperCase()}`;
	}

	if (result.status === "needs_confirmation") {
		return undefined;
	}

	const addressKey = [
		identity.street,
		identity.number,
		identity.postalCode,
		identity.municipality,
		identity.province,
	]
		.map(normalizePropertyHistoryKeyPart)
		.filter(Boolean)
		.join("|");

	return addressKey ? `address:${addressKey}` : undefined;
};

const buildUserPropertyHistorySnapshot = (input: {
	result: ResolveIdealistaLocationResultValue;
	propertyHistoryKey?: string;
}) => {
	const { result } = input;
	const dossier = result.propertyDossier;
	const listingSnapshot = dossier?.listingSnapshot;
	const officialIdentity = dossier?.officialIdentity;
	const image = dossier?.imageGallery[0];

	return {
		sourceUrl: result.sourceMetadata.sourceUrl,
		sourceUrlKey: normalizeUserHistoryUrlKey(result.sourceMetadata.sourceUrl),
		externalListingId: result.sourceMetadata.externalListingId,
		resultStatus: result.status,
		requestedStrategy: result.requestedStrategy,
		resolverVersion: result.resolverVersion,
		resolvedAt: result.resolvedAt,
		resolvedAddressLabel: result.resolvedAddressLabel,
		officialSource: result.officialSource,
		officialSourceUrl: result.officialSourceUrl,
		territoryAdapter: result.territoryAdapter,
		confidenceScore: result.confidenceScore,
		parcelRef14: result.parcelRef14 ?? officialIdentity?.parcelRef14,
		unitRef20: result.unitRef20 ?? officialIdentity?.unitRef20,
		propertyHistoryKey:
			input.propertyHistoryKey ?? getUserHistoryPropertyKey(result),
		title: listingSnapshot?.title,
		thumbnailUrl:
			listingSnapshot?.leadImageUrl ?? image?.thumbnailUrl ?? image?.imageUrl,
		askingPrice: listingSnapshot?.askingPrice,
		currencyCode: listingSnapshot?.currencyCode,
		areaM2: listingSnapshot?.areaM2,
		bedrooms: listingSnapshot?.bedrooms,
		bathrooms: listingSnapshot?.bathrooms,
		floorText: listingSnapshot?.floorText,
		isExterior: listingSnapshot?.isExterior,
		hasElevator: listingSnapshot?.hasElevator,
		officialAddress:
			officialIdentity?.proposedAddressLabel ?? result.resolvedAddressLabel,
		municipality: officialIdentity?.municipality,
		province: officialIdentity?.province,
		postalCode: officialIdentity?.postalCode,
	};
};

const toLocalizaTableHistoryRow = (
	record: Doc<"localizaUserPropertyHistory">,
): LocalizaTableHistoryRow => ({
	id: record._id,
	sourceUrl: record.sourceUrl,
	externalListingId: record.externalListingId,
	resultStatus: record.resultStatus,
	requestedStrategy: record.requestedStrategy,
	resolverVersion: record.resolverVersion,
	resolvedAt: record.resolvedAt,
	resolvedAddressLabel: record.resolvedAddressLabel,
	officialSource: record.officialSource,
	officialSourceUrl: record.officialSourceUrl,
	territoryAdapter: record.territoryAdapter,
	confidenceScore: record.confidenceScore,
	parcelRef14: record.parcelRef14,
	unitRef20: record.unitRef20,
	propertyHistoryKey: record.propertyHistoryKey,
	title: record.title,
	thumbnailUrl: record.thumbnailUrl,
	askingPrice: record.askingPrice,
	currencyCode: record.currencyCode,
	areaM2: record.areaM2,
	bedrooms: record.bedrooms,
	bathrooms: record.bathrooms,
	floorText: record.floorText,
	isExterior: record.isExterior,
	hasElevator: record.hasElevator,
	officialAddress: record.officialAddress,
	municipality: record.municipality,
	province: record.province,
	postalCode: record.postalCode,
	createdAt: record.createdAt,
	updatedAt: record.updatedAt,
});

export const recordUserPropertyHistory = mutation({
	args: {
		result: resolveIdealistaLocationResultValidator,
		propertyHistoryKey: v.optional(v.string()),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const snapshot = buildUserPropertyHistorySnapshot({
			result: args.result,
			propertyHistoryKey: args.propertyHistoryKey,
		});
		const existing = await ctx.db
			.query("localizaUserPropertyHistory")
			.withIndex("by_user_source_key", (q) =>
				q.eq("userId", userId).eq("sourceUrlKey", snapshot.sourceUrlKey),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				...snapshot,
				hiddenAt: undefined,
				updatedAt: now,
			});
			return { id: existing._id, created: false };
		}

		const id = await ctx.db.insert("localizaUserPropertyHistory", {
			...snapshot,
			userId,
			createdAt: now,
			updatedAt: now,
		});

		return { id, created: true };
	},
});

export const listUserPropertyHistory = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const limit = Math.min(Math.max(args.limit ?? 100, 1), 250);
		const records = await ctx.db
			.query("localizaUserPropertyHistory")
			.withIndex("by_user_updated", (q) => q.eq("userId", userId))
			.order("desc")
			.take(Math.min(limit * 2, 500));

		return records
			.filter((record) => !record.hiddenAt)
			.slice(0, limit)
			.map(toLocalizaTableHistoryRow);
	},
});

export const hideUserPropertyHistoryRow = mutation({
	args: {
		id: v.id("localizaUserPropertyHistory"),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const record = await ctx.db.get(args.id);

		if (!record || record.userId !== userId) {
			throw new Error("NOT_FOUND:Localiza table row not found");
		}

		const now = args.now ?? Date.now();
		await ctx.db.patch(args.id, {
			hiddenAt: now,
			updatedAt: now,
		});

		return { id: args.id };
	},
});

export const claimLease = mutation({
	args: {
		...lookupArgsValidator,
		sourceUrl: v.string(),
		leaseOwner: v.string(),
		leaseDurationMs: v.number(),
		defaultExpiresAt: v.number(),
		now: v.number(),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const existing = await ctx.db
			.query("locationResolutions")
			.withIndex("by_lookup", (q) =>
				q
					.eq("provider", args.provider)
					.eq("externalListingId", args.externalListingId)
					.eq("requestedStrategy", args.requestedStrategy)
					.eq("resolverVersion", args.resolverVersion),
			)
			.first();

		const nextLeaseExpiresAt = args.now + args.leaseDurationMs;

		if (!existing) {
			const id = await ctx.db.insert("locationResolutions", {
				provider: args.provider,
				externalListingId: args.externalListingId,
				sourceUrl: args.sourceUrl,
				requestedStrategy: args.requestedStrategy,
				resolverVersion: args.resolverVersion,
				leaseOwner: args.leaseOwner,
				leaseExpiresAt: nextLeaseExpiresAt,
				lastAttemptAt: args.now,
				expiresAt: args.defaultExpiresAt,
				createdAt: args.now,
				updatedAt: args.now,
			});

			return {
				kind: "acquired" as const,
				id,
			};
		}

		const hasFreshResult =
			Boolean(existing.result) && existing.expiresAt > args.now;

		if (hasFreshResult) {
			return {
				kind: "cached" as const,
				id: existing._id,
			};
		}

		const leaseExpiresAt = existing.leaseExpiresAt;
		const leaseIsActive =
			Boolean(existing.leaseOwner) &&
			leaseExpiresAt !== undefined &&
			leaseExpiresAt > args.now &&
			existing.leaseOwner !== args.leaseOwner;

		if (leaseIsActive) {
			return {
				kind: "in_flight" as const,
				id: existing._id,
			};
		}

		await ctx.db.patch(existing._id, {
			sourceUrl: args.sourceUrl,
			leaseOwner: args.leaseOwner,
			leaseExpiresAt: nextLeaseExpiresAt,
			lastAttemptAt: args.now,
			updatedAt: args.now,
		});

		return {
			kind: "acquired" as const,
			id: existing._id,
		};
	},
});

export const complete = mutation({
	args: {
		...lookupArgsValidator,
		sourceUrl: v.string(),
		leaseOwner: v.string(),
		result: resolveIdealistaLocationResultValidator,
		normalizedSignals: v.optional(v.any()),
		propertyHistoryKey: v.optional(v.string()),
		expiresAt: v.number(),
		now: v.number(),
		errorCode: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const existing = await ctx.db
			.query("locationResolutions")
			.withIndex("by_lookup", (q) =>
				q
					.eq("provider", args.provider)
					.eq("externalListingId", args.externalListingId)
					.eq("requestedStrategy", args.requestedStrategy)
					.eq("resolverVersion", args.resolverVersion),
			)
			.first();

		if (!existing) {
			throw new Error("location_resolution_lease_missing");
		}

		if (!canCompleteLocationResolutionLease(existing, args.leaseOwner)) {
			return { id: existing._id };
		}

		const patch = {
			sourceUrl: args.sourceUrl,
			resultStatus: args.result.status,
			propertyHistoryKey: args.propertyHistoryKey,
			result: args.result,
			normalizedSignals: args.normalizedSignals,
			leaseOwner: undefined,
			leaseExpiresAt: undefined,
			lastCompletedAt: args.now,
			expiresAt: args.expiresAt,
			errorCode: args.errorCode,
			errorMessage: args.errorMessage,
			updatedAt: args.now,
		};

		await ctx.db.patch(existing._id, patch);
		return { id: existing._id };
	},
});

export const pruneExpired = mutation({
	args: {
		now: v.number(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
		const expiredRecords = await ctx.db
			.query("locationResolutions")
			.withIndex("by_expires_at", (q) => q.lt("expiresAt", args.now))
			.take(limit);

		for (const record of expiredRecords) {
			await ctx.db.delete(record._id);
		}

		return {
			deleted: expiredRecords.length,
			hasMore: expiredRecords.length === limit,
		};
	},
});

export const reportFalsePositiveIncident = mutation({
	args: {
		sourceUrl: v.string(),
		externalListingId: v.optional(v.string()),
		listingId: v.optional(v.id("listings")),
		resolverVersion: v.optional(v.string()),
		resultStatus: v.optional(
			v.union(
				v.literal("exact_match"),
				v.literal("building_match"),
				v.literal("needs_confirmation"),
				v.literal("unresolved"),
				v.literal("manual_override"),
			),
		),
		territoryAdapter: v.optional(territoryAdapterValidator),
		notes: v.optional(v.string()),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const incidentId = await ctx.db.insert("localizaIncidents", {
			kind: "false_positive_autofill",
			severity: "sev1",
			status: "open",
			sourceUrl: args.sourceUrl,
			externalListingId: args.externalListingId,
			listingId: args.listingId,
			resolverVersion: args.resolverVersion,
			resultStatus: args.resultStatus,
			reportedByUserId: userId,
			notes: args.notes,
			createdAt: now,
			updatedAt: now,
		});

		const territoryAdapter = args.territoryAdapter ?? "state_catastro";
		const validationNotes = args.notes
			? `Auto-added from sev1 incident: ${args.notes}`
			: "Auto-added from confirmed wrong-address incident; widening blocked until officially validated.";

		const existingFixture = await ctx.db
			.query("localizaGoldenLiveFixtures")
			.withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
			.first();

		if (existingFixture) {
			await ctx.db.patch(existingFixture._id, {
				incidentId,
				validationStatus: "pending_official_validation",
				validationNotes,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("localizaGoldenLiveFixtures", {
				fixtureId: `incident-${incidentId}`,
				sourceUrl: args.sourceUrl,
				expectedStatus: "unresolved",
				territoryAdapter,
				humanUnitResolvable: false,
				expectedLocation: {
					street: "",
					city: "",
					stateOrProvince: "",
					country: "Spain",
				},
				validationStatus: "pending_official_validation",
				observedAt: new Date(now).toISOString(),
				validationNotes,
				source: "incident_auto_added",
				incidentId,
				createdAt: now,
				updatedAt: now,
			});
		}

		return { id: incidentId };
	},
});

export const resolveFalsePositiveIncident = mutation({
	args: {
		id: v.id("localizaIncidents"),
		resolutionNotes: v.optional(v.string()),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();

		await ctx.db.patch(args.id, {
			status: "resolved",
			resolvedByUserId: userId,
			resolutionNotes: args.resolutionNotes,
			resolvedAt: now,
			updatedAt: now,
		});

		return { id: args.id };
	},
});

export const listFalsePositiveIncidents = query({
	args: {
		status: v.optional(v.union(v.literal("open"), v.literal("resolved"))),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		const status = args.status;

		const incidents = status
			? await ctx.db
					.query("localizaIncidents")
					.withIndex("by_status_and_kind", (q) =>
						q.eq("status", status).eq("kind", "false_positive_autofill"),
					)
					.collect()
			: await ctx.db.query("localizaIncidents").collect();

		return incidents
			.filter((incident) => incident.kind === "false_positive_autofill")
			.sort((left, right) => right.updatedAt - left.updatedAt);
	},
});

export const getMetricsSnapshot = query({
	args: {
		sinceMs: v.optional(v.number()),
		now: v.number(),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);

		const resolutions = await ctx.db.query("locationResolutions").collect();
		const incidents = await ctx.db.query("localizaIncidents").collect();
		const listings = await ctx.db.query("listings").collect();

		return buildLocalizaMetricsSnapshot({
			resolutions,
			incidents,
			listings,
			now: args.now,
			sinceMs: args.sinceMs,
		});
	},
});
