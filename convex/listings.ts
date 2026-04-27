import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUserId } from "./auth";

const listingCreateArgs = {
	title: v.string(),
	slug: v.optional(v.string()),
	sourceType: v.union(
		v.literal("manual"),
		v.literal("firecrawl"),
		v.literal("idealista"),
	),
	sourceUrl: v.optional(v.string()),
	sourceMetadata: v.optional(
		v.object({
			provider: v.literal("idealista"),
			externalListingId: v.string(),
			sourceUrl: v.string(),
		}),
	),
	locationResolution: v.optional(
		v.object({
			status: v.union(
				v.literal("exact_match"),
				v.literal("building_match"),
				v.literal("needs_confirmation"),
				v.literal("unresolved"),
				v.literal("manual_override"),
			),
			confidenceScore: v.number(),
			officialSource: v.string(),
			officialSourceUrl: v.optional(v.string()),
			territoryAdapter: v.optional(
				v.union(
					v.literal("state_catastro"),
					v.literal("navarra_rtn"),
					v.literal("alava_catastro"),
					v.literal("bizkaia_catastro"),
					v.literal("gipuzkoa_catastro"),
				),
			),
			requestedStrategy: v.optional(
				v.union(
					v.literal("auto"),
					v.literal("idealista_api"),
					v.literal("firecrawl"),
					v.literal("browser_worker"),
				),
			),
			actualAcquisitionMethod: v.optional(
				v.union(
					v.literal("url_parse"),
					v.literal("idealista_api"),
					v.literal("firecrawl"),
					v.literal("browser_worker"),
				),
			),
			parcelRef14: v.optional(v.string()),
			unitRef20: v.optional(v.string()),
			resolvedAddressLabel: v.optional(v.string()),
			resolverVersion: v.string(),
			resolvedAt: v.string(),
			candidateCount: v.optional(v.number()),
			reasonCodes: v.array(v.string()),
		}),
	),
	location: v.object({
		street: v.string(),
		city: v.string(),
		stateOrProvince: v.string(),
		postalCode: v.string(),
		country: v.string(),
	}),
	displayAddressLabel: v.optional(v.string()),
	details: v.object({
		priceAmount: v.number(),
		currencyCode: v.union(v.literal("EUR"), v.literal("USD")),
		bedrooms: v.number(),
		bathrooms: v.number(),
		interiorAreaSquareMeters: v.optional(v.number()),
		lotAreaSquareMeters: v.optional(v.number()),
		yearBuilt: v.optional(v.number()),
		propertyType: v.string(),
		description: v.string(),
	}),
	media: v.array(
		v.object({
			url: v.string(),
			type: v.union(
				v.literal("photo"),
				v.literal("video"),
				v.literal("floor_plan"),
				v.literal("virtual_tour"),
				v.literal("document"),
			),
			caption: v.optional(v.string()),
			tags: v.optional(v.array(v.string())),
		}),
	),
};

type ListingCreateRecordInput = {
	title: string;
	slug?: string;
	sourceType: "manual" | "firecrawl" | "idealista";
	sourceUrl?: string;
	sourceMetadata?: {
		provider: "idealista";
		externalListingId: string;
		sourceUrl: string;
	};
	locationResolution?: {
		status:
			| "exact_match"
			| "building_match"
			| "needs_confirmation"
			| "unresolved"
			| "manual_override";
		confidenceScore: number;
		officialSource: string;
		officialSourceUrl?: string;
		territoryAdapter?:
			| "state_catastro"
			| "navarra_rtn"
			| "alava_catastro"
			| "bizkaia_catastro"
			| "gipuzkoa_catastro";
		requestedStrategy?:
			| "auto"
			| "idealista_api"
			| "firecrawl"
			| "browser_worker";
		actualAcquisitionMethod?:
			| "url_parse"
			| "idealista_api"
			| "firecrawl"
			| "browser_worker";
		parcelRef14?: string;
		unitRef20?: string;
		resolvedAddressLabel?: string;
		resolverVersion: string;
		resolvedAt: string;
		candidateCount?: number;
		reasonCodes: string[];
	};
	location: {
		street: string;
		city: string;
		stateOrProvince: string;
		postalCode: string;
		country: string;
	};
	displayAddressLabel?: string;
	details: {
		priceAmount: number;
		currencyCode: "EUR" | "USD";
		bedrooms: number;
		bathrooms: number;
		interiorAreaSquareMeters?: number;
		lotAreaSquareMeters?: number;
		yearBuilt?: number;
		propertyType: string;
		description: string;
	};
	media: Array<{
		url: string;
		type: "photo" | "video" | "floor_plan" | "virtual_tour" | "document";
		caption?: string;
		tags?: string[];
	}>;
};

const assertListingSourceConsistency = (listing: ListingCreateRecordInput) => {
	if (listing.sourceType === "manual") {
		if (listing.sourceUrl) {
			throw new Error("Manual listings cannot include a source URL.");
		}
		if (listing.sourceMetadata) {
			throw new Error("Manual listings cannot include source metadata.");
		}
		if (listing.locationResolution) {
			throw new Error(
				"Manual listings cannot include location resolution metadata.",
			);
		}
		return;
	}

	if (!listing.sourceUrl) {
		throw new Error("Imported listings require a source URL.");
	}

	if (listing.sourceType === "firecrawl") {
		if (listing.sourceMetadata) {
			throw new Error(
				"Firecrawl listings cannot include Idealista source metadata.",
			);
		}
		if (listing.locationResolution) {
			throw new Error(
				"Only Idealista listings can include location resolution metadata.",
			);
		}
		return;
	}

	if (listing.locationResolution && !listing.sourceMetadata) {
		throw new Error("Idealista location resolution requires source metadata.");
	}

	if (
		listing.sourceMetadata &&
		listing.sourceMetadata.sourceUrl !== listing.sourceUrl
	) {
		throw new Error(
			"Idealista source metadata must match the listing source URL.",
		);
	}
};

const buildListingInsert = (
	agentId: string,
	args: ListingCreateRecordInput,
	now: number,
	index = 0,
) => {
	const slug =
		args.slug ??
		args.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)+/g, "")
			.concat(`-${now + index}`);

	const displayAddressLabel =
		args.displayAddressLabel ?? args.locationResolution?.resolvedAddressLabel;

	return {
		agentId,
		title: args.title,
		slug,
		status: "draft" as const,
		sourceType: args.sourceType,
		sourceUrl: args.sourceUrl,
		sourceMetadata: args.sourceMetadata,
		locationResolution: args.locationResolution,
		location: args.location,
		displayAddressLabel,
		details: args.details,
		media: args.media,
		createdAt: now,
		updatedAt: now,
	};
};

export const create = mutation({
	args: listingCreateArgs,
	handler: async (ctx, args) => {
		const agentId = await requireAuthenticatedUserId(ctx);
		const now = Date.now();
		assertListingSourceConsistency(args);
		return await ctx.db.insert(
			"listings",
			buildListingInsert(agentId, args, now),
		);
	},
});

export const createBatch = mutation({
	args: {
		idempotencyKey: v.string(),
		listings: v.array(
			v.object({
				title: listingCreateArgs.title,
				slug: listingCreateArgs.slug,
				sourceType: listingCreateArgs.sourceType,
				sourceUrl: listingCreateArgs.sourceUrl,
				sourceMetadata: listingCreateArgs.sourceMetadata,
				locationResolution: listingCreateArgs.locationResolution,
				location: listingCreateArgs.location,
				displayAddressLabel: listingCreateArgs.displayAddressLabel,
				details: listingCreateArgs.details,
				media: listingCreateArgs.media,
			}),
		),
	},
	handler: async (ctx, args) => {
		const agentId = await requireAuthenticatedUserId(ctx);
		const existingRequest = await ctx.db
			.query("listingCreateRequests")
			.withIndex("by_agent_and_key", (q) =>
				q.eq("agentId", agentId).eq("idempotencyKey", args.idempotencyKey),
			)
			.first();

		if (existingRequest) {
			return {
				listingIds: existingRequest.listingIds,
				created: false,
			};
		}

		const now = Date.now();
		const ids = [];

		for (const [index, listing] of args.listings.entries()) {
			assertListingSourceConsistency(listing);

			const id = await ctx.db.insert(
				"listings",
				buildListingInsert(agentId, listing, now, index),
			);
			ids.push(id);
		}

		await ctx.db.insert("listingCreateRequests", {
			agentId,
			idempotencyKey: args.idempotencyKey,
			listingIds: ids,
			createdAt: now,
			updatedAt: now,
		});

		return {
			listingIds: ids,
			created: true,
		};
	},
});

export const list = query({
	args: {
		status: v.optional(
			v.union(
				v.literal("draft"),
				v.literal("active"),
				v.literal("sold"),
				v.literal("archived"),
			),
		),
		search: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		let listingsQuery = ctx.db.query("listings");

		if (args.status) {
			listingsQuery = listingsQuery.filter((q) =>
				q.eq(q.field("status"), args.status),
			);
		}

		const listings = await listingsQuery.collect();

		if (args.search) {
			const needle = args.search.toLowerCase();
			return listings.filter((listing) =>
				[listing.title, listing.details.description, listing.location.city]
					.filter(Boolean)
					.some((value) => value.toLowerCase().includes(needle)),
			);
		}

		return listings;
	},
});

export const listPublic = query({
	args: {
		status: v.optional(v.union(v.literal("active"), v.literal("sold"))),
		search: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		let listingsQuery = ctx.db.query("listings");

		if (args.status) {
			listingsQuery = listingsQuery.filter((q) =>
				q.eq(q.field("status"), args.status),
			);
		}

		const listings = await listingsQuery.collect();

		const filtered = listings.filter((listing) => {
			if (args.search) {
				const needle = args.search.toLowerCase();
				return [
					listing.title,
					listing.details.description,
					listing.location.city,
				]
					.filter(Boolean)
					.some((value) => value.toLowerCase().includes(needle));
			}

			return true;
		});

		return filtered.map(({ agentId, ...rest }) => rest);
	},
});

export const byId = query({
	args: {
		id: v.string(),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		const listingId = ctx.db.normalizeId("listings", args.id);
		if (!listingId) {
			return null;
		}

		const listing = await ctx.db.get(listingId);
		return listing ?? null;
	},
});
