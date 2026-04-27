import type {
	IdealistaSignals,
	ResolveIdealistaLocationCandidate,
} from "@casedra/types";

const IDEALISTA_MAPS_BASE_URL = "https://www.idealista.com/maps";
const IDEALISTA_MAPS_DEFAULT_TIMEOUT_MS = 2_000;
const IDEALISTA_MAPS_DEFAULT_ZOOM = 19;
const IDEALISTA_MAPS_USER_AGENT =
	"CasedraLocaliza/1.0 (+https://casedra.com/localiza)";

export type IdealistaMapsVerificationStatus = "confirmed" | "inconclusive";

export interface IdealistaMapsVerificationResult {
	status: IdealistaMapsVerificationStatus;
	reasonCodes: string[];
	matchedSignals: string[];
	checkedUrl?: string;
	confidenceBoost: number;
}

const inconclusive = (
	reasonCode: string,
	checkedUrl?: string,
): IdealistaMapsVerificationResult => ({
	status: "inconclusive",
	reasonCodes: [reasonCode],
	matchedSignals: [],
	checkedUrl,
	confidenceBoost: 0,
});

const buildMapsVerificationUrl = (input: {
	signals: IdealistaSignals;
	candidate: ResolveIdealistaLocationCandidate;
}) => {
	if (
		input.signals.approximateLat === undefined ||
		input.signals.approximateLng === undefined
	) {
		return null;
	}

	const lat = input.signals.approximateLat;
	const lng = input.signals.approximateLng;
	const propertyId = encodeURIComponent(input.signals.listingId);

	return `${IDEALISTA_MAPS_BASE_URL}/${lat},${lng},${IDEALISTA_MAPS_DEFAULT_ZOOM}/?propertyId=${propertyId}`;
};

const linkAbortSignal = (
	parent: AbortSignal | undefined,
	timeoutMs: number,
) => {
	const controller = new AbortController();
	const onParentAbort = () => controller.abort();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	if (parent) {
		if (parent.aborted) {
			controller.abort();
		} else {
			parent.addEventListener("abort", onParentAbort, { once: true });
		}
	}

	return {
		signal: controller.signal,
		cleanup: () => {
			clearTimeout(timeoutId);
			parent?.removeEventListener("abort", onParentAbort);
		},
	};
};

export const verifyIdealistaMaps = async (input: {
	signals: IdealistaSignals;
	candidate: ResolveIdealistaLocationCandidate;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<IdealistaMapsVerificationResult> => {
	const verificationUrl = buildMapsVerificationUrl({
		signals: input.signals,
		candidate: input.candidate,
	});

	if (!verificationUrl) {
		return inconclusive("idealista_maps_no_coordinates");
	}

	const { signal, cleanup } = linkAbortSignal(
		input.signal,
		input.timeoutMs ?? IDEALISTA_MAPS_DEFAULT_TIMEOUT_MS,
	);

	try {
		const response = await fetch(verificationUrl, {
			signal,
			redirect: "follow",
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": IDEALISTA_MAPS_USER_AGENT,
				"Accept-Language": "es-ES,es;q=0.9",
			},
			cache: "no-store",
		});

		if (!response.ok) {
			return inconclusive(
				`idealista_maps_http_${response.status}`,
				verificationUrl,
			);
		}

		const body = await response.text();
		const listingIdNeedles = [
			input.signals.listingId,
			`/inmueble/${input.signals.listingId}`,
		];

		const containsListingId = listingIdNeedles.some((needle) =>
			body.includes(needle),
		);

		if (!containsListingId) {
			return inconclusive(
				"idealista_maps_listing_id_not_found",
				verificationUrl,
			);
		}

		return {
			status: "confirmed",
			reasonCodes: [
				"idealista_maps_confirmed_listing_id",
				"independent_official_backlink",
			],
			matchedSignals: ["idealista_maps_listing_id"],
			checkedUrl: verificationUrl,
			confidenceBoost: 0.05,
		};
	} catch (error) {
		if (input.signal?.aborted) {
			throw error;
		}

		return inconclusive("idealista_maps_fetch_failed", verificationUrl);
	} finally {
		cleanup();
	}
};
