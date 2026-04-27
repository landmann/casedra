import type {
	ListingCreateInput,
	ListingLocationResolution,
} from "@casedra/types";

type LocalizaOperatorEvent =
	| "localiza.resolve.user_confirmed"
	| "localiza.resolve.manual_override";

const userConfirmedReasonCodes = new Set([
	"building_match_accepted",
	"user_confirmed_candidate",
]);

const getResolvedToSavedDurationMs = (resolvedAt?: string) => {
	if (!resolvedAt) {
		return undefined;
	}

	const resolvedTime = Date.parse(resolvedAt);
	return Number.isFinite(resolvedTime) ? Date.now() - resolvedTime : undefined;
};

const hasUserConfirmation = (resolution: ListingLocationResolution) =>
	resolution.reasonCodes.some((reasonCode) =>
		userConfirmedReasonCodes.has(reasonCode),
	);

export const logLocalizaOperatorEvent = (
	event: LocalizaOperatorEvent,
	payload: Record<string, unknown>,
) => {
	console.info(
		JSON.stringify({
			scope: "localiza",
			event,
			timestamp: new Date().toISOString(),
			...payload,
		}),
	);
};

export const logLocalizaListingTransitions = (input: {
	userId: string;
	listingId: string;
	listing: ListingCreateInput;
}) => {
	const resolution = input.listing.locationResolution;

	if (!resolution) {
		return;
	}

	const basePayload = {
		userId: input.userId,
		listingId: input.listingId,
		sourceUrl: input.listing.sourceUrl,
		externalListingId: input.listing.sourceMetadata?.externalListingId,
		adapterUsed: resolution.actualAcquisitionMethod,
		requestedStrategy: resolution.requestedStrategy,
		territoryAdapter: resolution.territoryAdapter,
		officialSource: resolution.officialSource,
		officialSourceUrl: resolution.officialSourceUrl,
		status: resolution.status,
		confidenceScore: resolution.confidenceScore,
		candidateCount: resolution.candidateCount,
		durationMs: getResolvedToSavedDurationMs(resolution.resolvedAt),
		reasonCodes: resolution.reasonCodes,
		resolverVersion: resolution.resolverVersion,
		resolvedAt: resolution.resolvedAt,
	};

	if (resolution.status === "manual_override") {
		logLocalizaOperatorEvent("localiza.resolve.manual_override", basePayload);
		return;
	}

	if (hasUserConfirmation(resolution)) {
		logLocalizaOperatorEvent("localiza.resolve.user_confirmed", basePayload);
	}
};
