import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUserId } from "./auth";

const expectedStatusValidator = v.union(
	v.literal("exact_match"),
	v.literal("building_match"),
	v.literal("needs_confirmation"),
	v.literal("unresolved"),
);

const territoryAdapterValidator = v.union(
	v.literal("state_catastro"),
	v.literal("navarra_rtn"),
	v.literal("alava_catastro"),
	v.literal("bizkaia_catastro"),
	v.literal("gipuzkoa_catastro"),
);

const validationStatusValidator = v.union(
	v.literal("pending_official_validation"),
	v.literal("officially_validated"),
);

const sourceValidator = v.union(
	v.literal("seed"),
	v.literal("incident_auto_added"),
);

const expectedLocationValidator = v.object({
	street: v.string(),
	city: v.string(),
	stateOrProvince: v.string(),
	country: v.string(),
	postalCode: v.optional(v.string()),
});

export const list = query({
	args: {},
	handler: async (ctx) => {
		await requireAuthenticatedUserId(ctx);
		const fixtures = await ctx.db.query("localizaGoldenLiveFixtures").collect();
		return fixtures.sort((left, right) => right.updatedAt - left.updatedAt);
	},
});

export const upsertFromSeed = mutation({
	args: {
		fixtureId: v.string(),
		sourceUrl: v.string(),
		expectedStatus: expectedStatusValidator,
		territoryAdapter: territoryAdapterValidator,
		humanUnitResolvable: v.boolean(),
		expectedLocation: expectedLocationValidator,
		validationStatus: validationStatusValidator,
		lastValidationRunAt: v.optional(v.string()),
		lastObservedStatus: v.optional(expectedStatusValidator),
		lastObservedTerritoryAdapter: v.optional(territoryAdapterValidator),
		lastObservedReasonCodes: v.optional(v.array(v.string())),
		observedAt: v.string(),
		validationNotes: v.string(),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const existing = await ctx.db
			.query("localizaGoldenLiveFixtures")
			.withIndex("by_fixture_id", (q) => q.eq("fixtureId", args.fixtureId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				sourceUrl: args.sourceUrl,
				expectedStatus: args.expectedStatus,
				territoryAdapter: args.territoryAdapter,
				humanUnitResolvable: args.humanUnitResolvable,
				expectedLocation: args.expectedLocation,
				validationStatus: args.validationStatus,
				lastValidationRunAt: args.lastValidationRunAt,
				lastObservedStatus: args.lastObservedStatus,
				lastObservedTerritoryAdapter: args.lastObservedTerritoryAdapter,
				lastObservedReasonCodes: args.lastObservedReasonCodes,
				observedAt: args.observedAt,
				validationNotes: args.validationNotes,
				updatedAt: now,
			});
			return { id: existing._id, kind: "updated" as const };
		}

		const id = await ctx.db.insert("localizaGoldenLiveFixtures", {
			fixtureId: args.fixtureId,
			sourceUrl: args.sourceUrl,
			expectedStatus: args.expectedStatus,
			territoryAdapter: args.territoryAdapter,
			humanUnitResolvable: args.humanUnitResolvable,
			expectedLocation: args.expectedLocation,
			validationStatus: args.validationStatus,
			lastValidationRunAt: args.lastValidationRunAt,
			lastObservedStatus: args.lastObservedStatus,
			lastObservedTerritoryAdapter: args.lastObservedTerritoryAdapter,
			lastObservedReasonCodes: args.lastObservedReasonCodes,
			observedAt: args.observedAt,
			validationNotes: args.validationNotes,
			source: "seed",
			createdAt: now,
			updatedAt: now,
		});
		return { id, kind: "created" as const };
	},
});

export const recordObservation = mutation({
	args: {
		fixtureId: v.string(),
		lastObservedStatus: expectedStatusValidator,
		lastObservedTerritoryAdapter: v.optional(territoryAdapterValidator),
		lastObservedReasonCodes: v.optional(v.array(v.string())),
		lastObservedAddressLabel: v.optional(v.string()),
		lastObservedLocation: v.optional(expectedLocationValidator),
		lastObservedParcelRef14: v.optional(v.string()),
		lastObservedUnitRef20: v.optional(v.string()),
		lastObservedResolverVersion: v.optional(v.string()),
		lastObservedOnlineEvidenceKinds: v.optional(v.array(v.string())),
		lastObservedOnlineEvidenceCount: v.optional(v.number()),
		lastObservedPublicHistoryCount: v.optional(v.number()),
		lastObservedImageCount: v.optional(v.number()),
		lastValidationRunAt: v.string(),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		const fixture = await ctx.db
			.query("localizaGoldenLiveFixtures")
			.withIndex("by_fixture_id", (q) => q.eq("fixtureId", args.fixtureId))
			.first();
		if (!fixture) {
			throw new Error("localiza_live_fixture_not_found");
		}

		await ctx.db.patch(fixture._id, {
			lastObservedStatus: args.lastObservedStatus,
			lastObservedTerritoryAdapter: args.lastObservedTerritoryAdapter,
			lastObservedReasonCodes: args.lastObservedReasonCodes,
			lastObservedAddressLabel: args.lastObservedAddressLabel,
			lastObservedLocation: args.lastObservedLocation,
			lastObservedParcelRef14: args.lastObservedParcelRef14,
			lastObservedUnitRef20: args.lastObservedUnitRef20,
			lastObservedResolverVersion: args.lastObservedResolverVersion,
			lastObservedOnlineEvidenceKinds: args.lastObservedOnlineEvidenceKinds,
			lastObservedOnlineEvidenceCount: args.lastObservedOnlineEvidenceCount,
			lastObservedPublicHistoryCount: args.lastObservedPublicHistoryCount,
			lastObservedImageCount: args.lastObservedImageCount,
			lastValidationRunAt: args.lastValidationRunAt,
			updatedAt: args.now ?? Date.now(),
		});
		return { id: fixture._id };
	},
});

export const markOfficiallyValidated = mutation({
	args: {
		fixtureId: v.string(),
		validationNotes: v.optional(v.string()),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		const fixture = await ctx.db
			.query("localizaGoldenLiveFixtures")
			.withIndex("by_fixture_id", (q) => q.eq("fixtureId", args.fixtureId))
			.first();
		if (!fixture) {
			throw new Error("localiza_live_fixture_not_found");
		}

		await ctx.db.patch(fixture._id, {
			validationStatus: "officially_validated",
			validationNotes: args.validationNotes ?? fixture.validationNotes,
			updatedAt: args.now ?? Date.now(),
		});
		return { id: fixture._id };
	},
});

export const upsertFromIncident = mutation({
	args: {
		sourceUrl: v.string(),
		territoryAdapter: territoryAdapterValidator,
		incidentId: v.id("localizaIncidents"),
		validationNotes: v.string(),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const existing = await ctx.db
			.query("localizaGoldenLiveFixtures")
			.withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				incidentId: args.incidentId,
				validationStatus: "pending_official_validation",
				validationNotes: args.validationNotes,
				updatedAt: now,
			});
			return { id: existing._id, kind: "updated" as const };
		}

		const fixtureId = `incident-${args.incidentId}`;
		const id = await ctx.db.insert("localizaGoldenLiveFixtures", {
			fixtureId,
			sourceUrl: args.sourceUrl,
			expectedStatus: "unresolved",
			territoryAdapter: args.territoryAdapter,
			humanUnitResolvable: false,
			expectedLocation: {
				street: "",
				city: "",
				stateOrProvince: "",
				country: "Spain",
			},
			validationStatus: "pending_official_validation",
			observedAt: new Date(now).toISOString(),
			validationNotes: args.validationNotes,
			source: "incident_auto_added",
			incidentId: args.incidentId,
			createdAt: now,
			updatedAt: now,
		});
		return { id, kind: "created" as const };
	},
});
