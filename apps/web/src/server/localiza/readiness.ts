import type {
	LocalizaMetricsSnapshot,
	LocalizaReadinessSnapshot,
} from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
	getLocalizaBetaAcquisitionContract,
	LOCALIZA_BETA_AUTO_STRATEGY_ORDER,
} from "./acquisition-contract";
import { getAvailableLocalizaStrategies } from "./availability";
import {
	getLocalizaGoldenFrozenSummary,
	getLocalizaGoldenReadinessIssues,
} from "./golden-dataset";

const getMetricsSnapshotRef = makeFunctionReference<
	"query",
	{
		sinceMs?: number;
		now: number;
	},
	LocalizaMetricsSnapshot
>("locationResolutions:getMetricsSnapshot");

const DEFAULT_METRICS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const buildUnavailableMetricsSnapshot = (input: {
	now: number;
	sinceMs?: number;
}): LocalizaMetricsSnapshot => {
	const windowMs = input.sinceMs ?? DEFAULT_METRICS_WINDOW_MS;

	return {
		generatedAt: input.now,
		windowStart: input.now - windowMs,
		windowMs,
		thresholds: {
			unresolvedRate: 0.2,
			timeoutRate: 0.05,
		},
		counts: {
			attempts: 0,
			completed: 0,
			success: 0,
			unresolved: 0,
			timeouts: 0,
			listingsWithResolution: 0,
			manualOverrides: 0,
			userConfirmations: 0,
			falsePositiveIncidents: 0,
			openFalsePositiveIncidents: 0,
		},
		rates: {
			success: 0,
			unresolved: 0,
			timeout: 0,
			manualOverride: 0,
			userConfirmation: 0,
		},
		durations: {
			medianMs: null,
		},
		statusCounts: {
			exact_match: 0,
			building_match: 0,
			needs_confirmation: 0,
			unresolved: 0,
		},
		byAcquisitionAdapter: {},
		byTerritoryAdapter: {},
		notTracked: ["localiza_metrics_unavailable"],
		alerts: ["localiza_metrics_unavailable"],
	};
};

const getMetricsSnapshot = async (input: {
	convex: ConvexHttpClient;
	now: number;
	sinceMs?: number;
}) => {
	try {
		return await input.convex.query(getMetricsSnapshotRef, {
			now: input.now,
			sinceMs: input.sinceMs,
		});
	} catch {
		return buildUnavailableMetricsSnapshot({
			now: input.now,
			sinceMs: input.sinceMs,
		});
	}
};

export const getLocalizaReadinessSnapshot = async (input: {
	convex: ConvexHttpClient;
	now?: number;
	sinceMs?: number;
}): Promise<LocalizaReadinessSnapshot> => {
	const now = input.now ?? Date.now();
	const configuredStrategies = getAvailableLocalizaStrategies();
	const metrics = await getMetricsSnapshot({
		convex: input.convex,
		now,
		sinceMs: input.sinceMs,
	});
	const goldenIssues = getLocalizaGoldenReadinessIssues();
	const missingRequiredStrategies = LOCALIZA_BETA_AUTO_STRATEGY_ORDER.filter(
		(strategy) => !configuredStrategies.includes(strategy),
	).map((strategy) => `localiza_${strategy}_not_configured`);
	const blockers = Array.from(
		new Set([...missingRequiredStrategies, ...goldenIssues, ...metrics.alerts]),
	);

	return {
		generatedAt: now,
		status: blockers.length === 0 ? "ready" : "blocked",
		canWidenAllowlist: blockers.length === 0,
		blockers,
		acquisitionContract:
			getLocalizaBetaAcquisitionContract(configuredStrategies),
		goldenDataset: {
			summary: getLocalizaGoldenFrozenSummary(),
			issues: goldenIssues,
		},
		metrics,
	};
};
