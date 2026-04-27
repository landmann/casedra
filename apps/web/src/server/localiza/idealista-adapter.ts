import type { LocalizaAdapter } from "./types";
import { buildAdapterSignals } from "./types";

export const idealistaApiAdapter: LocalizaAdapter = {
	method: "idealista_api",
	label: "Idealista API",
	timeoutMs: 5_000,
	// Beta is Firecrawl-only; keep this disabled until official API access is approved and implemented.
	isConfigured: () => false,
	async acquireSignals(input) {
		return {
			signals: buildAdapterSignals(input, "idealista_api"),
			matchedSignals: ["idealista_listing_id"],
			discardedSignals: [],
			reasonCodes: ["idealista_api_selected", "adapter_pending_implementation"],
		};
	},
};
