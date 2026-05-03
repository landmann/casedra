import type {
	LocalizaDataCoverageSource,
	LocalizaDataCoverageSummary,
	LocalizaMetricsSnapshot,
	LocalizaReadinessSnapshot,
} from "@casedra/types";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
	getLocalizaBetaAcquisitionContract,
	LOCALIZA_BETA_AUTO_STRATEGY_ORDER,
} from "./acquisition-contract";
import { getAvailableLocalizaStrategies } from "./availability";
import {
	getLocalizaGoldenFrozenSummary,
	getLocalizaGoldenReadinessIssues,
	localizaGoldenLiveFixtures as staticLocalizaGoldenLiveFixtures,
} from "./golden-dataset";
import {
	isOportunistaPriceHistoryConfigured,
	OPORTUNISTA_PRICE_HISTORY_REFRESH_MS,
} from "./oportunista-price-history";

type LocalizaLiveFixtureValidationStatus =
	| "pending_official_validation"
	| "officially_validated";

type LocalizaLiveFixtureRecord = {
	validationStatus: LocalizaLiveFixtureValidationStatus;
	lastObservedStatus?:
		| "exact_match"
		| "building_match"
		| "needs_confirmation"
		| "unresolved";
	lastObservedAddressLabel?: string;
	lastObservedLocation?: {
		street?: string;
		city?: string;
		stateOrProvince?: string;
		country?: string;
		postalCode?: string;
	};
	lastObservedParcelRef14?: string;
	lastObservedUnitRef20?: string;
	lastObservedOnlineEvidenceKinds?: string[];
	lastObservedOnlineEvidenceCount?: number;
	lastObservedPublicHistoryCount?: number;
	lastObservedImageCount?: number;
	lastValidationRunAt?: string;
};

const listLiveFixturesRef = makeFunctionReference<
	"query",
	Record<string, never>,
	LocalizaLiveFixtureRecord[]
>("localizaGoldenLiveFixtures:list");

const getMetricsSnapshotRef = makeFunctionReference<
	"query",
	{
		sinceMs?: number;
		now: number;
	},
	LocalizaMetricsSnapshot
>("locationResolutions:getMetricsSnapshot");

const DEFAULT_METRICS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const buildUnavailableMetricsSnapshot = (input: {
	now: number;
	sinceMs?: number;
}): LocalizaMetricsSnapshot => {
	const windowMs = input.sinceMs ?? DEFAULT_METRICS_WINDOW_MS;

	return {
		generatedAt: input.now,
		windowStart: input.now - windowMs,
		windowMs,
		thresholds: {
			unresolvedRate: 0.2,
			timeoutRate: 0.05,
		},
		counts: {
			attempts: 0,
			completed: 0,
			success: 0,
			unresolved: 0,
			timeouts: 0,
			listingsWithResolution: 0,
			manualOverrides: 0,
			userConfirmations: 0,
			falsePositiveIncidents: 0,
			openFalsePositiveIncidents: 0,
		},
		rates: {
			success: 0,
			unresolved: 0,
			timeout: 0,
			manualOverride: 0,
			userConfirmation: 0,
		},
		durations: {
			medianMs: null,
		},
		statusCounts: {
			exact_match: 0,
			building_match: 0,
			needs_confirmation: 0,
			unresolved: 0,
		},
		byAcquisitionAdapter: {},
		byTerritoryAdapter: {},
		notTracked: ["localiza_metrics_unavailable"],
		alerts: ["localiza_metrics_unavailable"],
	};
};

const getMetricsSnapshot = async (input: {
	convex: ConvexHttpClient;
	now: number;
	sinceMs?: number;
}) => {
	try {
		return await input.convex.query(getMetricsSnapshotRef, {
			now: input.now,
			sinceMs: input.sinceMs,
		});
	} catch {
		return buildUnavailableMetricsSnapshot({
			now: input.now,
			sinceMs: input.sinceMs,
		});
	}
};

const loadLiveFixtures = async (
	convex: ConvexHttpClient,
): Promise<LocalizaLiveFixtureRecord[]> => {
	try {
		const fixtures = await convex.query(listLiveFixturesRef, {});
		if (fixtures.length === 0) {
			return staticLocalizaGoldenLiveFixtures;
		}
		return fixtures;
	} catch {
		return staticLocalizaGoldenLiveFixtures;
	}
};

const buildLocalizaLiveCoverageSummary = (
	fixtures: LocalizaLiveFixtureRecord[],
): LocalizaDataCoverageSummary => {
	const observedFixtures = fixtures.filter(
		(fixture) => fixture.lastValidationRunAt || fixture.lastObservedStatus,
	);

	return {
		liveFixtureCount: fixtures.length,
		observedFixtureCount: observedFixtures.length,
		addressObservedCount: observedFixtures.filter(
			(fixture) =>
				Boolean(fixture.lastObservedAddressLabel) ||
				Boolean(fixture.lastObservedLocation?.street),
		).length,
		cadastralIdentityObservedCount: observedFixtures.filter(
			(fixture) =>
				Boolean(fixture.lastObservedUnitRef20) ||
				Boolean(fixture.lastObservedParcelRef14),
		).length,
		buildingOrBetterObservedCount: observedFixtures.filter(
			(fixture) =>
				fixture.lastObservedStatus === "exact_match" ||
				fixture.lastObservedStatus === "building_match",
		).length,
		onlineEvidenceObservedCount: observedFixtures.filter(
			(fixture) => (fixture.lastObservedOnlineEvidenceCount ?? 0) > 0,
		).length,
		listingArchiveObservedCount: observedFixtures.filter((fixture) =>
			fixture.lastObservedOnlineEvidenceKinds?.includes("listing_archive"),
		).length,
		multiSourceHistoryObservedCount: observedFixtures.filter(
			(fixture) => (fixture.lastObservedPublicHistoryCount ?? 0) > 1,
		).length,
		needsConfirmationObservedCount: observedFixtures.filter(
			(fixture) => fixture.lastObservedStatus === "needs_confirmation",
		).length,
		unresolvedObservedCount: observedFixtures.filter(
			(fixture) => fixture.lastObservedStatus === "unresolved",
		).length,
	};
};

const buildLocalizaDataCoverageSources = (input: {
	configuredStrategies: string[];
	isMarketHistoryConfigured: boolean;
}): LocalizaDataCoverageSource[] => {
	const hasFirecrawl = input.configuredStrategies.includes("firecrawl");

	return [
		{
			id: "firecrawl",
			label: "Lectura del anuncio",
			status: hasFirecrawl ? "active" : "missing_credentials",
			configured: hasFirecrawl,
			coverage: [
				"título",
				"precio",
				"m²",
				"habitaciones",
				"zona",
				"mapa aproximado",
				"imagen principal",
			],
			gap: hasFirecrawl
				? undefined
				: "Sin Firecrawl no hay señales iniciales del anuncio.",
			action: hasFirecrawl
				? "Vigilar precisión en las pruebas reales."
				: "Configurar FIRECRAWL_API_KEY o uno de sus alias.",
			blockerCode: hasFirecrawl
				? undefined
				: "localiza_firecrawl_not_configured",
		},
		{
			id: "official_public_sources",
			label: "Fuentes oficiales",
			status: "active",
			configured: true,
			coverage: [
				"dirección oficial",
				"parcela",
				"unidad",
				"edificio",
				"energía",
				"riesgos",
				"solar",
				"servicios cercanos",
				"urbanismo",
				"patrimonio",
			],
			action: "Validar los enlaces vivos antes de ampliar acceso.",
		},
		{
			id: "oportunista_rapidapi",
			label: "Archivo Idealista",
			status: input.isMarketHistoryConfigured ? "active" : "reserved",
			configured: input.isMarketHistoryConfigured,
			coverage: [
				"histórico de precio",
				"primer visto",
				"última captura",
				"estado",
				"fotos",
				"anunciante",
				"dirección archivada",
			],
			gap: input.isMarketHistoryConfigured
				? undefined
				: "No hay alta pública verificada para el feed histórico. El informe mantiene el archivo automático apagado.",
			action: input.isMarketHistoryConfigured
				? "Revisar cobertura real por fixture."
				: "Usar import manual o añadir un proveedor con contrato verificable.",
		},
		{
			id: "operator_market_import",
			label: "Import manual de mercado",
			status: "manual",
			configured: true,
			coverage: [
				"Fotocasa",
				"Habitaclia",
				"Pisos.com",
				"agencia",
				"días publicado",
				"duplicados",
			],
			action: "Usar pegado masivo hasta tener un feed licenciado.",
		},
		{
			id: "licensed_comparable_feed",
			label: "Feed comparable licenciado",
			status: "reserved",
			configured: false,
			coverage: [
				"comparables cerrados",
				"benchmark por zona",
				"oferta multiportal",
			],
			gap: "No hay proveedor aprobado conectado todavía.",
			action: "Añadir solo cuando exista un feed legal y atribuible.",
		},
	];
};

export const getLocalizaReadinessSnapshot = async (input: {
	convex: ConvexHttpClient;
	now?: number;
	sinceMs?: number;
}): Promise<LocalizaReadinessSnapshot> => {
	const now = input.now ?? Date.now();
	const configuredStrategies = getAvailableLocalizaStrategies();
	const [metrics, liveFixtures] = await Promise.all([
		getMetricsSnapshot({
			convex: input.convex,
			now,
			sinceMs: input.sinceMs,
		}),
		loadLiveFixtures(input.convex),
	]);
	const goldenIssues = getLocalizaGoldenReadinessIssues(liveFixtures);
	const missingRequiredStrategies = LOCALIZA_BETA_AUTO_STRATEGY_ORDER.filter(
		(strategy) => !configuredStrategies.includes(strategy),
	).map((strategy) => `localiza_${strategy}_not_configured`);
	const isMarketHistoryConfigured = isOportunistaPriceHistoryConfigured();
	const blockers = Array.from(
		new Set([...missingRequiredStrategies, ...goldenIssues, ...metrics.alerts]),
	);

	return {
		generatedAt: now,
		status: blockers.length === 0 ? "ready" : "blocked",
		canWidenAllowlist: blockers.length === 0,
		blockers,
		acquisitionContract:
			getLocalizaBetaAcquisitionContract(configuredStrategies),
		marketHistoryProvider: {
			provider: "oportunista_rapidapi",
			configured: isMarketHistoryConfigured,
			refreshIntervalMs: OPORTUNISTA_PRICE_HISTORY_REFRESH_MS,
		},
		dataCoverage: {
			sources: buildLocalizaDataCoverageSources({
				configuredStrategies,
				isMarketHistoryConfigured,
			}),
			liveSummary: buildLocalizaLiveCoverageSummary(liveFixtures),
		},
		goldenDataset: {
			summary: getLocalizaGoldenFrozenSummary(liveFixtures),
			issues: goldenIssues,
		},
		metrics,
	};
};
