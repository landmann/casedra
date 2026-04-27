import type { LocalizaAdapterMethod } from "./types";

export const LOCALIZA_BETA_ACQUISITION_MODE = "firecrawl_only_beta" as const;

export const LOCALIZA_BETA_AUTO_STRATEGY_ORDER: LocalizaAdapterMethod[] = [
	"firecrawl",
];

export const LOCALIZA_BETA_DISABLED_STRATEGIES: LocalizaAdapterMethod[] = [
	"idealista_api",
	"browser_worker",
];

export const getLocalizaBetaAcquisitionContract = (
	configuredStrategies: LocalizaAdapterMethod[],
) => ({
	mode: LOCALIZA_BETA_ACQUISITION_MODE,
	autoStrategyOrder: LOCALIZA_BETA_AUTO_STRATEGY_ORDER,
	configuredStrategies,
	disabledStrategies: LOCALIZA_BETA_DISABLED_STRATEGIES,
	complianceApprovalRequiredForBrowserWorker: true,
});
