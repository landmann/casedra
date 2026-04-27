import type {
	ListingCreateInput,
	ListingLocationResolution,
	ListingSourceType,
} from "@casedra/types";

type ListingDraftLike = {
	title: string;
	sourceType: ListingSourceType;
	sourceUrl: string;
	sourceMetadata?: ListingCreateInput["sourceMetadata"];
	locationResolution?: ListingLocationResolution;
	location: ListingCreateInput["location"];
	details: Pick<ListingCreateInput["details"], "description">;
};

export const hasLocalizaLinkedDraftState = (
	draft: Pick<ListingDraftLike, "sourceMetadata" | "locationResolution">,
) => Boolean(draft.sourceMetadata) || Boolean(draft.locationResolution);

export const buildClearedLocationDraft = (
	sourceType: ListingSourceType,
	previousCountry?: string,
): ListingCreateInput["location"] => ({
	street: "",
	city: "",
	stateOrProvince: "",
	postalCode: "",
	country: sourceType === "idealista" ? "España" : previousCountry?.trim() || "",
});

const shouldClearLocalizaOwnedLocation = (
	status?: ListingLocationResolution["status"],
) => status === "exact_match" || status === "building_match";

export const clearLocationAfterFailedResolve = (
	draft: Pick<
		ListingDraftLike,
		"sourceType" | "location" | "locationResolution"
	>,
): ListingCreateInput["location"] =>
	shouldClearLocalizaOwnedLocation(draft.locationResolution?.status)
		? buildClearedLocationDraft(draft.sourceType, draft.location.country)
		: draft.location;

export const canAddListingDraft = (
	draft: Pick<
		ListingDraftLike,
		"title" | "sourceType" | "sourceUrl" | "location" | "details"
	>,
	isLocalizaResolving: boolean,
) => {
	if (isLocalizaResolving) {
		return false;
	}

	if (
		!draft.title.trim() ||
		!draft.location.street.trim() ||
		!draft.location.city.trim() ||
		!draft.location.stateOrProvince.trim() ||
		!draft.location.postalCode.trim() ||
		!draft.location.country.trim() ||
		!draft.details.description.trim()
	) {
		return false;
	}

	if (draft.sourceType === "manual") {
		return true;
	}

	return draft.sourceUrl.trim().length > 0;
};
