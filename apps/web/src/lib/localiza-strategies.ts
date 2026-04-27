import type { LocalizaAcquisitionStrategy } from "@casedra/types";

export type AvailableLocalizaStrategy = Exclude<
	LocalizaAcquisitionStrategy,
	"auto"
>;

export type LocalizaStrategyOption = {
	value: LocalizaAcquisitionStrategy;
	label: string;
	description: string;
};

const autoStrategyOption: LocalizaStrategyOption = {
	value: "auto",
	label: "Automático",
	description: "Usa el mejor camino disponible para encontrar la dirección.",
};

const explicitStrategyOptions: Record<
	AvailableLocalizaStrategy,
	LocalizaStrategyOption
> = {
	firecrawl: {
		value: "firecrawl",
		label: "Leer enlace",
		description: "Lee la URL que pegues y rellena lo que pueda confirmar.",
	},
	idealista_api: {
		value: "idealista_api",
		label: "Datos de Idealista",
		description: "Usa los datos disponibles del anuncio de Idealista.",
	},
	browser_worker: {
		value: "browser_worker",
		label: "Segundo intento",
		description: "Prueba otra lectura cuando el primer intento no basta.",
	},
};

export const availableLocalizaStrategyOrder: AvailableLocalizaStrategy[] = [
	"firecrawl",
	"idealista_api",
	"browser_worker",
];

const normalizeAvailableStrategies = (
	availableStrategies: AvailableLocalizaStrategy[],
) => {
	const availableStrategySet = new Set(availableStrategies);
	return availableLocalizaStrategyOrder.filter((strategy) =>
		availableStrategySet.has(strategy),
	);
};

export const buildLocalizaStrategyOptions = (
	availableStrategies: AvailableLocalizaStrategy[],
): LocalizaStrategyOption[] => {
	const normalizedStrategies =
		normalizeAvailableStrategies(availableStrategies);

	if (normalizedStrategies.length === 0) {
		return [];
	}

	return [
		autoStrategyOption,
		...normalizedStrategies.map(
			(strategy) => explicitStrategyOptions[strategy],
		),
	];
};

export const isLocalizaStrategySelectable = (
	strategy: LocalizaAcquisitionStrategy,
	availableStrategies: AvailableLocalizaStrategy[],
) =>
	buildLocalizaStrategyOptions(availableStrategies).some(
		(option) => option.value === strategy,
	);

export const getPreferredLocalizaStrategy = (
	strategy: LocalizaAcquisitionStrategy,
	availableStrategies: AvailableLocalizaStrategy[],
) => {
	if (isLocalizaStrategySelectable(strategy, availableStrategies)) {
		return strategy;
	}

	return buildLocalizaStrategyOptions(availableStrategies)[0]?.value ?? null;
};
