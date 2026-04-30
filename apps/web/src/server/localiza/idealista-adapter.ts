import { LocalizaServiceError } from "./errors";
import type { LocalizaAdapter } from "./types";

export const idealistaApiAdapter: LocalizaAdapter = {
	method: "idealista_api",
	label: "Idealista API",
	timeoutMs: 5_000,
	// Beta is Firecrawl-only; keep this disabled until official API access is approved and implemented.
	isConfigured: () => false,
	async acquireSignals() {
		throw new LocalizaServiceError(
			"upstream_unavailable",
			"The Idealista official API adapter is not implemented in this build.",
		);
	},
};
