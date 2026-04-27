import assert from "node:assert/strict";
import test from "node:test";

import { TRPCError } from "@trpc/server";

import {
	canAddListingDraft,
	clearLocationAfterFailedResolve,
} from "../../../apps/web/src/app/app/onboarding/localiza-draft-state.ts";
import {
	buildLocalizaStrategyOptions,
	getPreferredLocalizaStrategy,
} from "../../../apps/web/src/lib/localiza-strategies.ts";
import {
	getLocalizaGoldenFrozenContractIssues,
	getLocalizaGoldenFrozenSummary,
	getLocalizaGoldenReadinessIssues,
	localizaGoldenFrozenFixtures,
} from "../../../apps/web/src/server/localiza/golden-dataset.ts";
import {
	classifyLocalizaCandidateOutcome,
	corpusIncludesDesignator,
	normalizeLocalizaText,
	provinceMatchesHint,
} from "../../../apps/web/src/server/localiza/score.ts";
import { parseIdealistaListingUrl } from "../../../apps/web/src/server/localiza/url.ts";
import {
	LOCALIZA_RESOLVER_VERSION,
	LOCALIZA_RESOLVER_VERSION_POLICY,
} from "../../../apps/web/src/server/localiza/version.ts";
import { buildLocalizaMetricsSnapshot } from "../../../convex/localizaMetrics.ts";
import { canCompleteLocationResolutionLease } from "../../../convex/locationResolutionLease.ts";
import { listingCreateInputSchema } from "./schema/listings.ts";
import {
	mapWorkflowError,
	requireAgencyRole,
	resolveCurrentAgencyRecord,
} from "./workflow-core.ts";

const withNodeEnv = async (nodeEnv: string, callback: () => Promise<void>) => {
	const previousNodeEnv = process.env.NODE_ENV;
	process.env.NODE_ENV = nodeEnv;

	try {
		await callback();
	} finally {
		process.env.NODE_ENV = previousNodeEnv;
	}
};

const buildListingCreateInput = (overrides: Record<string, unknown> = {}) => ({
	title: "Calle de Alcala 123",
	slug: "calle-de-alcala-123",
	sourceType: "idealista",
	sourceUrl: "https://www.idealista.com/inmueble/108926410/",
	sourceMetadata: {
		provider: "idealista",
		externalListingId: "108926410",
		sourceUrl: "https://www.idealista.com/inmueble/108926410/",
	},
	locationResolution: {
		status: "exact_match",
		confidenceScore: 0.96,
		officialSource: "Direccion General del Catastro",
		resolverVersion: "localiza-bootstrap-2026-04-23.2",
		resolvedAt: "2026-04-24T00:00:00.000Z",
		reasonCodes: ["listing_id_parsed", "state_catastro_exact_match"],
	},
	location: {
		street: "Calle de Alcala 123",
		city: "Madrid",
		stateOrProvince: "Madrid",
		postalCode: "28009",
		country: "Spain",
	},
	details: {
		priceAmount: 2350000,
		currencyCode: "EUR",
		bedrooms: 4,
		bathrooms: 3,
		interiorAreaSquareMeters: 110,
		propertyType: "condo",
		description: "Exterior corner flat with balcony.",
	},
	media: [],
	...overrides,
});

const buildReadyListingDraft = (overrides: Record<string, unknown> = {}) => ({
	title: "Calle de Alcala 123",
	sourceType: "idealista",
	sourceUrl: "https://www.idealista.com/inmueble/108926410/",
	sourceMetadata: {
		provider: "idealista",
		externalListingId: "108926410",
		sourceUrl: "https://www.idealista.com/inmueble/108926410/",
	},
	locationResolution: {
		status: "exact_match",
		confidenceScore: 0.96,
		officialSource: "Direccion General del Catastro",
		resolverVersion: "localiza-bootstrap-2026-04-23.2",
		resolvedAt: "2026-04-24T00:00:00.000Z",
		reasonCodes: ["listing_id_parsed", "state_catastro_exact_match"],
	},
	location: {
		street: "Calle de Alcala 123",
		city: "Madrid",
		stateOrProvince: "Madrid",
		postalCode: "28009",
		country: "Spain",
	},
	details: {
		description: "Exterior corner flat with balcony.",
	},
	...overrides,
});

const localizaFrozenOutcomeFixtures = [
	{
		name: "strong street and designator proof becomes exact",
		topScore: 0.96,
		secondScore: 0.8,
		hasStreetLevelProof: true,
		hasDesignatorProof: true,
		expectedStatus: "exact_match",
		expectedScoreGap: 0.16,
	},
	{
		name: "strong building proof without unit designator stays building-level",
		topScore: 0.86,
		secondScore: 0.62,
		hasStreetLevelProof: true,
		hasDesignatorProof: false,
		expectedStatus: "building_match",
		expectedScoreGap: 0.24,
	},
	{
		name: "close top candidates require confirmation",
		topScore: 0.96,
		secondScore: 0.91,
		hasStreetLevelProof: true,
		hasDesignatorProof: true,
		expectedStatus: "needs_confirmation",
		expectedScoreGap: 0.05,
	},
	{
		name: "low confidence remains confirmation-only",
		topScore: 0.74,
		secondScore: 0.4,
		hasStreetLevelProof: true,
		hasDesignatorProof: true,
		expectedStatus: "needs_confirmation",
		expectedScoreGap: 0.34,
	},
] as const;

test("resolveCurrentAgency rejects unauthenticated sessions", async () => {
	await assert.rejects(
		() =>
			resolveCurrentAgencyRecord({
				sessionUserId: null,
				nodeEnv: "development",
				getCurrentAgency: async () => null,
				createDefaultAgency: async () => null,
			}),
		(error) => error instanceof TRPCError && error.code === "UNAUTHORIZED",
	);
});

test("resolveCurrentAgency returns the existing agency", async () => {
	const currentAgency = {
		agency: { id: "agency_123" },
		membership: { role: "owner", userId: "user_123" },
	};

	await withNodeEnv("development", async () => {
		const result = await resolveCurrentAgencyRecord({
			sessionUserId: "user_123",
			nodeEnv: process.env.NODE_ENV,
			getCurrentAgency: async () => currentAgency,
			createDefaultAgency: async () => {
				throw new Error(
					"createDefaultAgency should not run when agency exists",
				);
			},
		});

		assert.equal(result, currentAgency);
	});
});

test("resolveCurrentAgency bootstraps a default agency in development", async () => {
	const currentAgency = {
		agency: { id: "agency_123" },
		membership: { role: "owner", userId: "user_123" },
	};

	await withNodeEnv("development", async () => {
		const result = await resolveCurrentAgencyRecord({
			sessionUserId: "user_123",
			nodeEnv: process.env.NODE_ENV,
			getCurrentAgency: async () => null,
			createDefaultAgency: async () => currentAgency,
		});

		assert.equal(result, currentAgency);
	});
});

test("resolveCurrentAgency forbids missing memberships in production", async () => {
	await withNodeEnv("production", async () => {
		await assert.rejects(
			() =>
				resolveCurrentAgencyRecord({
					sessionUserId: "user_123",
					nodeEnv: process.env.NODE_ENV,
					getCurrentAgency: async () => null,
					createDefaultAgency: async () => {
						throw new Error("createDefaultAgency should not run in production");
					},
				}),
			(error) => error instanceof TRPCError && error.code === "FORBIDDEN",
		);
	});
});

test("mapWorkflowError translates prefixed workflow errors", () => {
	assert.throws(
		() => mapWorkflowError(new Error("FORBIDDEN:blocked")),
		(error) =>
			error instanceof TRPCError &&
			error.code === "FORBIDDEN" &&
			error.message === "blocked",
	);
});

test("requireAgencyRole rejects disallowed roles", () => {
	assert.throws(
		() => requireAgencyRole("agent", ["owner", "manager"]),
		(error) => error instanceof TRPCError && error.code === "FORBIDDEN",
	);
});

test("listingCreateInputSchema rejects manual listings with a hidden imported URL", () => {
	const result = listingCreateInputSchema.safeParse(
		buildListingCreateInput({
			sourceType: "manual",
			sourceUrl: "https://www.idealista.com/inmueble/108926410/",
			sourceMetadata: undefined,
			locationResolution: undefined,
		}),
	);

	assert.equal(result.success, false);
	assert.match(
		JSON.stringify(result.error?.format()),
		/Manual listings cannot include a source URL/,
	);
});

test("listingCreateInputSchema rejects idealista listings when source metadata URL is not canonicalized", () => {
	const result = listingCreateInputSchema.safeParse(
		buildListingCreateInput({
			sourceUrl: "https://www.idealista.com/inmueble/108926410/?foo=bar",
		}),
	);

	assert.equal(result.success, false);
	assert.match(
		JSON.stringify(result.error?.format()),
		/Idealista source metadata must match the listing source URL/,
	);
});

test("listingCreateInputSchema accepts idealista listings when source URL matches canonical metadata", () => {
	const result = listingCreateInputSchema.safeParse(buildListingCreateInput());

	assert.equal(result.success, true);
});

test("clearLocationAfterFailedResolve removes Localiza-owned exact matches from the draft", () => {
	const nextLocation = clearLocationAfterFailedResolve(
		buildReadyListingDraft(),
	);

	assert.deepEqual(nextLocation, {
		street: "",
		city: "",
		stateOrProvince: "",
		postalCode: "",
		country: "Spain",
	});
});

test("clearLocationAfterFailedResolve preserves manual overrides after a failed resolve", () => {
	const nextLocation = clearLocationAfterFailedResolve(
		buildReadyListingDraft({
			locationResolution: {
				status: "manual_override",
				confidenceScore: 0.96,
				officialSource: "Direccion General del Catastro",
				resolverVersion: "localiza-bootstrap-2026-04-23.2",
				resolvedAt: "2026-04-24T00:00:00.000Z",
				reasonCodes: ["manual_address_override"],
			},
			location: {
				street: "Calle de Alcala 123, piso 4B",
				city: "Madrid",
				stateOrProvince: "Madrid",
				postalCode: "28009",
				country: "Spain",
			},
		}),
	);

	assert.deepEqual(nextLocation, {
		street: "Calle de Alcala 123, piso 4B",
		city: "Madrid",
		stateOrProvince: "Madrid",
		postalCode: "28009",
		country: "Spain",
	});
});

test("canAddListingDraft rejects submissions while a Localiza resolve is still in flight", () => {
	assert.equal(canAddListingDraft(buildReadyListingDraft(), true), false);
	assert.equal(canAddListingDraft(buildReadyListingDraft(), false), true);
});

test("buildLocalizaStrategyOptions hides Auto when no adapter is configured", () => {
	assert.deepEqual(buildLocalizaStrategyOptions([]), []);
});

test("buildLocalizaStrategyOptions includes Auto plus configured explicit strategies in stable order", () => {
	assert.deepEqual(
		buildLocalizaStrategyOptions(["browser_worker", "firecrawl"]),
		[
			{
				value: "auto",
				label: "Auto",
				description:
					"Use the best available method first, then let the user retry explicitly if needed.",
			},
			{
				value: "firecrawl",
				label: "Firecrawl",
				description: "Rendered extraction path for user-submitted URLs.",
			},
			{
				value: "browser_worker",
				label: "Browser worker",
				description: "Browserbase-backed fallback for tough pages.",
			},
		],
	);
});

test("getPreferredLocalizaStrategy falls back to the first selectable option", () => {
	assert.equal(
		getPreferredLocalizaStrategy("browser_worker", ["firecrawl"]),
		"auto",
	);
	assert.equal(
		getPreferredLocalizaStrategy("firecrawl", ["firecrawl"]),
		"firecrawl",
	);
	assert.equal(getPreferredLocalizaStrategy("auto", []), null);
});

test("parseIdealistaListingUrl canonicalizes supported listing URLs", () => {
	assert.deepEqual(
		parseIdealistaListingUrl(
			"https://www.idealista.com/inmueble/108926410/?utm_source=test",
		),
		{
			externalListingId: "108926410",
			sourceUrl: "https://www.idealista.com/inmueble/108926410/",
		},
	);
	assert.deepEqual(
		parseIdealistaListingUrl("https://idealista.com/inmueble/108926410"),
		{
			externalListingId: "108926410",
			sourceUrl: "https://idealista.com/inmueble/108926410/",
		},
	);
});

test("parseIdealistaListingUrl rejects unsupported URL shapes", () => {
	assert.throws(
		() => parseIdealistaListingUrl("not-a-url"),
		(error) =>
			error instanceof Error && "code" in error && error.code === "invalid_url",
	);
	assert.throws(
		() => parseIdealistaListingUrl("https://www.fotocasa.es/es/comprar/foo"),
		(error) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "unsupported_url",
	);
	assert.throws(
		() =>
			parseIdealistaListingUrl("https://www.idealista.com/venta-viviendas/"),
		(error) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "unsupported_url",
	);
	assert.throws(
		() =>
			parseIdealistaListingUrl("ftp://www.idealista.com/inmueble/108926410/"),
		(error) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "unsupported_url",
	);
	assert.throws(
		() =>
			parseIdealistaListingUrl(
				"https://www.idealista.com:8443/inmueble/108926410/",
			),
		(error) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "unsupported_url",
	);
});

test("corpusIncludesDesignator requires address context for numeric designators", () => {
	const bedroomCorpus = normalizeLocalizaText(
		"Piso exterior de 3 habitaciones junto a Calle de Alcala",
	);
	const portalCorpus = normalizeLocalizaText(
		"Piso exterior en portal 3 junto a Calle de Alcala",
	);
	const addressCorpus = normalizeLocalizaText(
		"Piso exterior en Calle de Alcala 3",
	);

	assert.equal(
		corpusIncludesDesignator(bedroomCorpus, "3", "Calle de Alcala"),
		false,
	);
	assert.equal(
		corpusIncludesDesignator(portalCorpus, "3", "Calle de Alcala"),
		true,
	);
	assert.equal(
		corpusIncludesDesignator(addressCorpus, "3", "Calle de Alcala"),
		true,
	);
});

test("province matching accepts official regional aliases", () => {
	assert.equal(provinceMatchesHint("01", "Araba"), true);
	assert.equal(provinceMatchesHint("20", "Guipúzcoa"), true);
	assert.equal(provinceMatchesHint("48", "Vizcaya"), true);
});

test("classifyLocalizaCandidateOutcome preserves exact-match safety thresholds", () => {
	for (const fixture of localizaFrozenOutcomeFixtures) {
		const result = classifyLocalizaCandidateOutcome({
			topScore: fixture.topScore,
			secondScore: fixture.secondScore,
			hasStreetLevelProof: fixture.hasStreetLevelProof,
			hasDesignatorProof: fixture.hasDesignatorProof,
		});

		assert.equal(result.status, fixture.expectedStatus, fixture.name);
		assert.equal(result.scoreGap, fixture.expectedScoreGap, fixture.name);
	}
});

test("canCompleteLocationResolutionLease rejects stale resolver completions", () => {
	assert.equal(canCompleteLocationResolutionLease(null, "owner-a"), true);
	assert.equal(
		canCompleteLocationResolutionLease({ leaseOwner: "owner-a" }, "owner-a"),
		true,
	);
	assert.equal(
		canCompleteLocationResolutionLease({ leaseOwner: "owner-b" }, "owner-a"),
		false,
	);
	assert.equal(
		canCompleteLocationResolutionLease({ leaseOwner: undefined }, "owner-a"),
		false,
	);
});

test("Localiza golden fixture registry covers all supported cadastral territories", () => {
	assert.equal(LOCALIZA_RESOLVER_VERSION, "localiza-bootstrap-2026-04-23.2");
	assert.equal(
		LOCALIZA_RESOLVER_VERSION_POLICY,
		"stable-bootstrap-date-plus-patch",
	);
	assert.equal(localizaGoldenFrozenFixtures.length, 30);
	assert.deepEqual(getLocalizaGoldenFrozenSummary().territories, [
		"alava_catastro",
		"bizkaia_catastro",
		"gipuzkoa_catastro",
		"navarra_rtn",
		"state_catastro",
	]);
	assert.equal(
		localizaGoldenFrozenFixtures.every(
			(fixture) =>
				fixture.layer === "frozen_normalized_signals" &&
				fixture.signals.listingId.length > 0 &&
				fixture.officialResolution.officialSource.length > 0,
		),
		true,
	);
});

test("Localiza golden frozen fixtures satisfy deterministic contract thresholds", () => {
	const summary = getLocalizaGoldenFrozenSummary();

	assert.deepEqual(getLocalizaGoldenFrozenContractIssues(), []);
	assert.equal(summary.hiddenBuildingOrBetterRate >= 0.8, true);
	assert.equal(summary.humanUnitExactRate >= 0.6, true);
});

test("Localiza golden readiness stays blocked until live links are officially validated", () => {
	assert.deepEqual(getLocalizaGoldenReadinessIssues(), [
		"localiza_live_regression_set_pending_official_validation",
	]);
});

test("Localiza metrics snapshot aggregates operator health and false-positive incidents", () => {
	const now = Date.parse("2026-04-25T00:00:00.000Z");
	const snapshot = buildLocalizaMetricsSnapshot({
		now,
		sinceMs: 60_000,
		resolutions: [
			{
				updatedAt: now - 1_000,
				lastAttemptAt: now - 9_000,
				lastCompletedAt: now - 5_000,
				result: {
					status: "exact_match",
					territoryAdapter: "state_catastro",
					evidence: {
						actualAcquisitionMethod: "firecrawl",
						reasonCodes: ["state_catastro_exact_match"],
					},
				},
			},
			{
				updatedAt: now - 2_000,
				lastAttemptAt: now - 8_000,
				lastCompletedAt: now - 3_000,
				errorCode: "state_catastro_timeout",
				result: {
					status: "unresolved",
					territoryAdapter: "state_catastro",
					evidence: {
						actualAcquisitionMethod: "firecrawl",
						reasonCodes: ["state_catastro_timeout"],
					},
				},
			},
			{
				updatedAt: now - 120_000,
				lastAttemptAt: now - 120_000,
				lastCompletedAt: now - 119_000,
				result: {
					status: "building_match",
					territoryAdapter: "navarra_rtn",
					evidence: {
						actualAcquisitionMethod: "firecrawl",
						reasonCodes: ["outside_window"],
					},
				},
			},
		],
		incidents: [
			{
				kind: "false_positive_autofill",
				severity: "sev1",
				status: "open",
				createdAt: now - 4_000,
				updatedAt: now - 4_000,
			},
		],
		listings: [
			{
				updatedAt: now - 1_000,
				locationResolution: {
					status: "manual_override",
					reasonCodes: ["manual_address_override"],
				},
			},
			{
				updatedAt: now - 2_000,
				locationResolution: {
					status: "building_match",
					reasonCodes: ["user_confirmed_candidate"],
				},
			},
		],
	});

	assert.equal(snapshot.counts.attempts, 2);
	assert.equal(snapshot.counts.completed, 2);
	assert.equal(snapshot.counts.success, 1);
	assert.equal(snapshot.counts.timeouts, 1);
	assert.equal(snapshot.counts.manualOverrides, 1);
	assert.equal(snapshot.counts.userConfirmations, 1);
	assert.equal(snapshot.counts.falsePositiveIncidents, 1);
	assert.equal(snapshot.counts.openFalsePositiveIncidents, 1);
	assert.equal(snapshot.statusCounts.exact_match, 1);
	assert.equal(snapshot.statusCounts.unresolved, 1);
	assert.deepEqual(snapshot.notTracked, []);
	assert.equal(
		snapshot.alerts.includes("localiza_false_positive_incident_reported"),
		true,
	);
	assert.equal(
		snapshot.alerts.includes("localiza_timeout_rate_threshold_breached"),
		true,
	);
});
