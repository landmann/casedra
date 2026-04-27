import type { LocalizaAdapter } from "./types";
import { buildAdapterSignals } from "./types";

export const browserWorkerAdapter: LocalizaAdapter = {
	method: "browser_worker",
	label: "Browser worker",
	timeoutMs: 8_000,
	// Beta is Firecrawl-only; keep this disabled until browser automation has explicit compliance approval.
	isConfigured: () => false,
	async acquireSignals(input) {
		return {
			signals: buildAdapterSignals(input, "browser_worker"),
			matchedSignals: ["idealista_listing_id"],
			discardedSignals: [],
			reasonCodes: [
				"browser_worker_selected",
				"adapter_pending_implementation",
			],
		};
	},
};
