import type { AvailableLocalizaStrategy } from "@/lib/localiza-strategies";

import { LOCALIZA_BETA_AUTO_STRATEGY_ORDER } from "./acquisition-contract";
import { browserWorkerAdapter } from "./browser-worker-adapter";
import { firecrawlAdapter } from "./firecrawl-adapter";
import { idealistaApiAdapter } from "./idealista-adapter";

const strategyAvailabilityRegistry: Record<
	AvailableLocalizaStrategy,
	{ isConfigured: () => boolean }
> = {
	firecrawl: firecrawlAdapter,
	idealista_api: idealistaApiAdapter,
	browser_worker: browserWorkerAdapter,
};

export const getAvailableLocalizaStrategies = () =>
	LOCALIZA_BETA_AUTO_STRATEGY_ORDER.filter((strategy) =>
		strategyAvailabilityRegistry[strategy].isConfigured(),
	);
