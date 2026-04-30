import { LocalizaServiceError } from "./errors";
import type { LocalizaAdapter } from "./types";

export const browserWorkerAdapter: LocalizaAdapter = {
	method: "browser_worker",
	label: "Browser worker",
	timeoutMs: 8_000,
	// Beta is Firecrawl-only; keep this disabled until browser automation has explicit compliance approval.
	isConfigured: () => false,
	async acquireSignals() {
		throw new LocalizaServiceError(
			"upstream_unavailable",
			"The browser-worker adapter is not implemented in this build.",
		);
	},
};
