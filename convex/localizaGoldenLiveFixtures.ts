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
	v.literal("user_feedback"),
);

const addressFeedbackVerdictValidator = v.union(
	v.literal("correct"),
	v.literal("incorrect"),
);

const expectedLocationValidator = v.object({
	street: v.string(),
	city: v.string(),
	stateOrProvince: v.string(),
	country: v.string(),
	postalCode: v.optional(v.string()),
});

const postalCodePattern = /\b(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})\b/;

const cleanText = (value?: string) => {
	const trimmed = value?.replace(/\s+/g, " ").trim();
	return trimmed ? trimmed : undefined;
};

const buildExpectedLocationFromAddressLabel = (addressLabel?: string) => {
	const label = cleanText(addressLabel);
	const postalCode = label?.match(postalCodePattern)?.[1];
	const parts =
		label
			?.split(",")
			.map((part) => cleanText(part))
			.filter((part): part is string => Boolean(part)) ?? [];
	const postalPart = parts.find((part) => postalCode && part.includes(postalCode));
	const city = cleanText(postalPart?.replace(postalCodePattern, ""));

	return {
		street: parts[0] ?? label ?? "",
		city: city ?? "",
		stateOrProvince: city ?? "",
		country: "Spain",
		postalCode,
	};
};

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

export const submitUserFeedback = mutation({
	args: {
		sourceUrl: v.string(),
		externalListingId: v.optional(v.string()),
		verdict: addressFeedbackVerdictValidator,
		resultStatus: v.optional(expectedStatusValidator),
		resolverVersion: v.optional(v.string()),
		territoryAdapter: v.optional(territoryAdapterValidator),
		resolvedAddressLabel: v.optional(v.string()),
		selectedCandidateId: v.optional(v.string()),
		selectedCandidateLabel: v.optional(v.string()),
		correctedAddressLabel: v.optional(v.string()),
		reasonCodes: v.optional(v.array(v.string())),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const now = args.now ?? Date.now();
		const correctedAddressLabel = cleanText(args.correctedAddressLabel);

		if (args.verdict === "incorrect" && !correctedAddressLabel) {
			throw new Error("localiza_corrected_address_required");
		}

		const selectedAddressLabel = cleanText(
			args.selectedCandidateLabel ?? args.resolvedAddressLabel,
		);
		const expectedAddressLabel =
			args.verdict === "incorrect"
				? correctedAddressLabel
				: selectedAddressLabel;
		const expectedStatus =
			args.verdict === "correct"
				? (args.resultStatus ?? "needs_confirmation")
				: "needs_confirmation";
		const feedbackId = await ctx.db.insert("localizaAddressFeedback", {
			sourceUrl: args.sourceUrl,
			externalListingId: cleanText(args.externalListingId),
			verdict: args.verdict,
			resultStatus: args.resultStatus,
			resolverVersion: cleanText(args.resolverVersion),
			territoryAdapter: args.territoryAdapter,
			resolvedAddressLabel: cleanText(args.resolvedAddressLabel),
			selectedCandidateId: cleanText(args.selectedCandidateId),
			selectedCandidateLabel: cleanText(args.selectedCandidateLabel),
			correctedAddressLabel,
			reasonCodes: args.reasonCodes ?? [],
			submittedByUserId: userId,
			createdAt: now,
		});
		const existing = await ctx.db
			.query("localizaGoldenLiveFixtures")
			.withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
			.first();
		const validationNotes =
			args.verdict === "correct"
				? `User confirmed Localiza result: ${selectedAddressLabel ?? "no address label"}.`
				: `User corrected Localiza result. Expected address: ${correctedAddressLabel}. Localiza showed: ${selectedAddressLabel ?? args.resolvedAddressLabel ?? "no address label"}.`;
		const validationStatus:
			| "pending_official_validation"
			| "officially_validated" =
			args.verdict === "correct" &&
			existing?.validationStatus === "officially_validated"
				? "officially_validated"
				: "pending_official_validation";
		const expectedLocation =
			args.verdict === "correct" && existing
				? existing.expectedLocation
				: buildExpectedLocationFromAddressLabel(expectedAddressLabel);
		const lastObservedLocation = buildExpectedLocationFromAddressLabel(
			selectedAddressLabel ?? args.resolvedAddressLabel,
		);
		const patch = {
			expectedStatus,
			expectedLocation,
			expectedAddressLabel,
			validationStatus,
			lastObservedStatus: args.resultStatus,
			lastObservedTerritoryAdapter: args.territoryAdapter,
			lastObservedReasonCodes: args.reasonCodes,
			lastObservedAddressLabel:
				selectedAddressLabel ?? cleanText(args.resolvedAddressLabel),
			lastObservedLocation,
			lastObservedResolverVersion: cleanText(args.resolverVersion),
			validationNotes,
			lastUserFeedbackVerdict: args.verdict,
			lastUserFeedbackAt: now,
			lastUserFeedbackByUserId: userId,
			lastUserCorrectedAddressLabel: correctedAddressLabel,
			lastUserSelectedAddressLabel: selectedAddressLabel,
			updatedAt: now,
		};

		if (existing) {
			await ctx.db.patch(existing._id, patch);
			return {
				feedbackId,
				liveFixtureId: existing._id,
				validationStatus,
			};
		}

		const liveFixtureId = await ctx.db.insert("localizaGoldenLiveFixtures", {
			fixtureId: `feedback-${feedbackId}`,
			sourceUrl: args.sourceUrl,
			territoryAdapter: args.territoryAdapter ?? "state_catastro",
			humanUnitResolvable: Boolean(expectedAddressLabel),
			observedAt: new Date(now).toISOString(),
			source: "user_feedback",
			createdAt: now,
			...patch,
		});

		return {
			feedbackId,
			liveFixtureId,
			validationStatus,
		};
	},
});
