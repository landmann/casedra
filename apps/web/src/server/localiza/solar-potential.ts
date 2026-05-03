import type { LocalizaPropertyDossier } from "@casedra/types";

const SOLAR_COLLECTION_URL =
	"https://api-processes.idee.es/collections/radiacion_solar_edificios/items";
const SOLAR_SOURCE_URL = "https://eficiencia-energetica.ign.es/solar/";
const SOLAR_TIMEOUT_MS = 2_500;

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

type SolarFeature = {
	properties?: {
		id_parcela?: string;
		numberofdwellings?: number;
		numberoffloorsaboveground?: number;
		superficie?: number;
		valor_medio?: number;
		valor_maximo?: number;
		valor_minimo?: number;
		currentuse?: string;
	};
};

const normalizeReference = (value?: string) =>
	value?.toUpperCase().replace(/[^A-Z0-9]/g, "");

const formatInteger = (value?: number) =>
	value === undefined
		? undefined
		: new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);

const formatArea = (value?: number) => {
	const formatted = formatInteger(value);
	return formatted ? `${formatted} m²` : undefined;
};

const formatSolarIrradiance = (value?: number) => {
	const formatted = formatInteger(value);
	return formatted ? `${formatted} kWh/m² año` : undefined;
};

const formatCount = (value: number | undefined, singular: string, plural: string) =>
	value === undefined
		? undefined
		: `${formatInteger(value)} ${value === 1 ? singular : plural}`;

const formatUse = (value?: string) =>
	({
		"1_residential": "Residencial",
		"2_agriculture": "Agrario",
		"3_industrial": "Industrial",
		"4_1_office": "Oficinas",
		"4_2_retail": "Comercial",
		"4_3_publicServices": "Servicios públicos",
		"4_4_ancillary": "Anexo",
	}[value ?? ""] ??
	value
		?.replace(/^\d+_/, "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase()));

const buildSolarEvidence = (
	properties: NonNullable<SolarFeature["properties"]>,
): LocalizaOnlineEvidenceItem[] => {
	const evidence = [
		{
			label: "Radiación solar media en cubierta",
			value: formatSolarIrradiance(properties.valor_medio),
		},
		{
			label: "Radiación solar máxima en cubierta",
			value: formatSolarIrradiance(properties.valor_maximo),
		},
		{
			label: "Radiación solar mínima en cubierta",
			value: formatSolarIrradiance(properties.valor_minimo),
		},
		{
			label: "Superficie de cubierta analizada",
			value: formatArea(properties.superficie),
		},
		{
			label: "Viviendas en edificio",
			value: formatCount(properties.numberofdwellings, "vivienda", "viviendas"),
		},
		{
			label: "Plantas sobre rasante",
			value: formatCount(
				properties.numberoffloorsaboveground,
				"planta",
				"plantas",
			),
		},
		{
			label: "Uso del edificio solar",
			value: formatUse(properties.currentuse),
		},
	];

	return evidence
		.filter(
			(item): item is { label: string; value: string } => Boolean(item.value),
		)
		.map((item) => ({
			...item,
			sourceLabel: "CNIG / Potencial solar de edificios",
			sourceUrl: SOLAR_SOURCE_URL,
			kind: "solar_potential",
		}));
};

export const fetchSolarPotentialEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const parcelReference = dossier.officialIdentity.parcelRef14;

	if (!parcelReference) {
		return [];
	}

	const url = new URL(SOLAR_COLLECTION_URL);
	url.searchParams.set("f", "json");
	url.searchParams.set("limit", "3");
	url.searchParams.set(
		"properties",
		[
			"id_parcela",
			"numberofdwellings",
			"numberoffloorsaboveground",
			"superficie",
			"valor_medio",
			"valor_maximo",
			"valor_minimo",
			"currentuse",
		].join(","),
	);
	url.searchParams.set("skipGeometry", "true");
	url.searchParams.set("id_parcela", parcelReference);

	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), SOLAR_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			method: "GET",
			signal: abortController.signal,
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as { features?: SolarFeature[] };
		const normalizedReference = normalizeReference(parcelReference);
		const matchingFeature = (payload.features ?? []).find(
			(feature) =>
				feature.properties &&
				normalizeReference(feature.properties.id_parcela) === normalizedReference,
		);

		return matchingFeature?.properties
			? buildSolarEvidence(matchingFeature.properties)
			: [];
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};
