const statusKeys = [
	"exact_match",
	"building_match",
	"needs_confirmation",
	"unresolved",
] as const;

const successStatuses = new Set([
	"exact_match",
	"building_match",
	"needs_confirmation",
]);

const UNRESOLVED_ALERT_RATE = 0.2;
const TIMEOUT_ALERT_RATE = 0.05;
const FALSE_POSITIVE_INCIDENT_KIND = "false_positive_autofill";

const emptyStatusCounts = () =>
	Object.fromEntries(statusKeys.map((status) => [status, 0])) as Record<
		(typeof statusKeys)[number],
		number
	>;

const incrementStatus = (
	counts: Record<(typeof statusKeys)[number], number>,
	status?: (typeof statusKeys)[number],
) => {
	if (status) {
		counts[status] += 1;
	}
};

const incrementBucket = (
	buckets: Record<
		string,
		{ total: number; statuses: Record<(typeof statusKeys)[number], number> }
	>,
	key: string,
	status?: (typeof statusKeys)[number],
) => {
	buckets[key] ??= { total: 0, statuses: emptyStatusCounts() };
	buckets[key].total += 1;
	incrementStatus(buckets[key].statuses, status);
};

const roundRate = (numerator: number, denominator: number) =>
	denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : 0;

const median = (values: number[]) => {
	if (values.length === 0) {
		return null;
	}

	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);

	return sorted.length % 2 === 0
		? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
		: Math.round(sorted[middle]);
};

const hasTimeoutSignal = (record: {
	errorCode?: string;
	errorMessage?: string;
	result?: {
		evidence?: {
			reasonCodes?: string[];
		};
	};
}) =>
	[
		record.errorCode,
		record.errorMessage,
		...(record.result?.evidence?.reasonCodes ?? []),
	].some((value) => value?.toLowerCase().includes("timeout"));

type MetricsResolutionRecord = {
	result?: {
		status: (typeof statusKeys)[number];
		territoryAdapter?: string;
		evidence: {
			actualAcquisitionMethod?: string;
			territoryAdapter?: string;
			reasonCodes?: string[];
		};
	};
	lastAttemptAt?: number;
	lastCompletedAt?: number;
	errorCode?: string;
	errorMessage?: string;
	updatedAt: number;
};

type MetricsListingRecord = {
	locationResolution?: {
		status: string;
		reasonCodes: string[];
	};
	updatedAt: number;
};

type MetricsIncidentRecord = {
	kind: string;
	severity: string;
	status: "open" | "resolved";
	createdAt: number;
	resolvedAt?: number;
	updatedAt: number;
};

export const buildLocalizaMetricsSnapshot = (input: {
	resolutions: MetricsResolutionRecord[];
	incidents?: MetricsIncidentRecord[];
	listings: MetricsListingRecord[];
	now: number;
	sinceMs?: number;
}) => {
	const windowMs = input.sinceMs ?? 7 * 24 * 60 * 60 * 1000;
	const windowStart = input.now - windowMs;
	const completedResolutions = input.resolutions.filter(
		(record) =>
			Boolean(record.result) &&
			(record.lastCompletedAt ?? record.updatedAt) >= windowStart,
	);
	const attemptedResolutions = input.resolutions.filter(
		(record) => (record.lastAttemptAt ?? record.updatedAt) >= windowStart,
	);
	const localizaListings = input.listings.filter(
		(listing) =>
			Boolean(listing.locationResolution) && listing.updatedAt >= windowStart,
	);
	const falsePositiveIncidents = (input.incidents ?? []).filter(
		(incident) =>
			incident.kind === FALSE_POSITIVE_INCIDENT_KIND &&
			incident.severity === "sev1" &&
			incident.createdAt >= windowStart,
	);
	const openFalsePositiveIncidents = (input.incidents ?? []).filter(
		(incident) =>
			incident.kind === FALSE_POSITIVE_INCIDENT_KIND &&
			incident.severity === "sev1" &&
			incident.status === "open",
	);
	const statusCounts = emptyStatusCounts();
	const byAcquisitionAdapter: Record<
		string,
		{ total: number; statuses: Record<(typeof statusKeys)[number], number> }
	> = {};
	const byTerritoryAdapter: Record<
		string,
		{ total: number; statuses: Record<(typeof statusKeys)[number], number> }
	> = {};
	const durationMs = completedResolutions
		.map((record) => {
			if (!record.lastAttemptAt || !record.lastCompletedAt) {
				return null;
			}

			return record.lastCompletedAt - record.lastAttemptAt;
		})
		.filter((value): value is number => value !== null && value >= 0);

	for (const record of completedResolutions) {
		const status = record.result?.status;
		incrementStatus(statusCounts, status);
		incrementBucket(
			byAcquisitionAdapter,
			record.result?.evidence.actualAcquisitionMethod ?? "unknown",
			status,
		);
		incrementBucket(
			byTerritoryAdapter,
			record.result?.territoryAdapter ??
				record.result?.evidence.territoryAdapter ??
				"unknown",
			status,
		);
	}

	const successCount = completedResolutions.filter(
		(record) => record.result && successStatuses.has(record.result.status),
	).length;
	const unresolvedCount = statusCounts.unresolved;
	const timeoutCount = completedResolutions.filter(hasTimeoutSignal).length;
	const manualOverrideCount = localizaListings.filter(
		(listing) => listing.locationResolution?.status === "manual_override",
	).length;
	const userConfirmedCount = localizaListings.filter((listing) =>
		listing.locationResolution?.reasonCodes.some(
			(reasonCode) =>
				reasonCode === "building_match_accepted" ||
				reasonCode === "user_confirmed_candidate",
		),
	).length;
	const unresolvedRate = roundRate(
		unresolvedCount,
		completedResolutions.length,
	);
	const timeoutRate = roundRate(timeoutCount, completedResolutions.length);

	return {
		generatedAt: input.now,
		windowStart,
		windowMs,
		thresholds: {
			unresolvedRate: UNRESOLVED_ALERT_RATE,
			timeoutRate: TIMEOUT_ALERT_RATE,
		},
		counts: {
			attempts: attemptedResolutions.length,
			completed: completedResolutions.length,
			success: successCount,
			unresolved: unresolvedCount,
			timeouts: timeoutCount,
			listingsWithResolution: localizaListings.length,
			manualOverrides: manualOverrideCount,
			userConfirmations: userConfirmedCount,
			falsePositiveIncidents: falsePositiveIncidents.length,
			openFalsePositiveIncidents: openFalsePositiveIncidents.length,
		},
		rates: {
			success: roundRate(successCount, completedResolutions.length),
			unresolved: unresolvedRate,
			timeout: timeoutRate,
			manualOverride: roundRate(manualOverrideCount, localizaListings.length),
			userConfirmation: roundRate(userConfirmedCount, localizaListings.length),
		},
		durations: {
			medianMs: median(durationMs),
		},
		statusCounts,
		byAcquisitionAdapter,
		byTerritoryAdapter,
		notTracked: [],
		alerts: [
			...(openFalsePositiveIncidents.length > 0 ||
			falsePositiveIncidents.length > 0
				? ["localiza_false_positive_incident_reported"]
				: []),
			...(unresolvedRate >= UNRESOLVED_ALERT_RATE
				? ["localiza_unresolved_rate_threshold_breached"]
				: []),
			...(timeoutRate >= TIMEOUT_ALERT_RATE
				? ["localiza_timeout_rate_threshold_breached"]
				: []),
		],
	};
};
