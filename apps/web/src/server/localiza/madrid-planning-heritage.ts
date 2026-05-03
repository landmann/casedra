import type {
	IdealistaSignals,
	LocalizaPropertyDossier,
	ResolveIdealistaLocationResult,
} from "@casedra/types";

const MADRID_PLANNING_TIMEOUT_MS = 4_000;
const MADRID_PGOUM_SOURCE_URL =
	"https://www.madrid.es/portales/munimadrid/es/Inicio/El-Ayuntamiento/Urbanismo-y-vivienda/PGOUM-1997?vgnextchannel=8dba171c30036010VgnVCM100000dc0ca8c0RCRD&vgnextoid=8293d468e4b4f110VgnVCM2000000c205a0aRCRD";
const MADRID_HERITAGE_SOURCE_URL =
	"https://datos.madrid.es/dataset/300158-0-edificios-protegidos";
const MADRID_NORMAS_ZONALES_QUERY_URL =
	"https://sigma.madrid.es/hosted/rest/services/DESARROLLO_URBANO_ACTUALIZADO/NORMAS_ZONALES/MapServer/0/query";
const MADRID_PROTECTED_BUILDINGS_QUERY_URL =
	"https://sigma.madrid.es/hosted/rest/services/DESARROLLO_URBANO_ACTUALIZADO/EDIFICIOS_PROTEGIDOS_VIGENTE/MapServer/4/query";
const MAX_PLANNING_COORDINATE_PRECISION_METERS = 50;

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

type ArcGisFeature<TAttributes> = {
	attributes?: TAttributes;
};

type ArcGisQueryResponse<TAttributes> = {
	features?: Array<ArcGisFeature<TAttributes>>;
};

type MadridZoningAttributes = {
	AMB_TX_ETIQ?: string;
	AMB_TX_DENOM?: string;
};

type MadridProtectedBuildingAttributes = {
	CEP_TX_NUMCAT?: string;
	CEP_TX_NOMBRE?: string | null;
	CEP_TX_PROTECCION?: string | null;
	CEP_TX_CJTO_HOMOGENEO?: string | null;
	CEP_TX_EXPEDIENTE?: string | null;
	CEP_TX_OBSERVACIONES?: string | null;
};

const cleanText = (value?: string | null) => {
	const trimmed = value?.trim();
	return trimmed && trimmed !== "---" ? trimmed : undefined;
};

const isMadridResult = (input: {
	result: ResolveIdealistaLocationResult;
	signals?: IdealistaSignals;
}) => {
	const corpus = [
		input.result.prefillLocation?.city,
		input.result.prefillLocation?.stateOrProvince,
		input.signals?.municipality,
		input.signals?.province,
		input.result.resolvedAddressLabel,
	]
		.filter(Boolean)
		.join(" ")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

	return /\bmadrid\b/.test(corpus);
};

const buildPointQueryUrl = (input: {
	baseUrl: string;
	latitude: number;
	longitude: number;
	outFields: string;
}) => {
	const url = new URL(input.baseUrl);
	url.searchParams.set("f", "json");
	url.searchParams.set("geometry", `${input.longitude},${input.latitude}`);
	url.searchParams.set("geometryType", "esriGeometryPoint");
	url.searchParams.set("inSR", "4326");
	url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
	url.searchParams.set("outFields", input.outFields);
	url.searchParams.set("returnGeometry", "false");
	url.searchParams.set("resultRecordCount", "3");
	return url;
};

const queryArcGisPointLayer = async <TAttributes>(input: {
	baseUrl: string;
	latitude: number;
	longitude: number;
	outFields: string;
	signal: AbortSignal;
}) => {
	try {
		const response = await fetch(buildPointQueryUrl(input), {
			method: "GET",
			signal: input.signal,
			cache: "no-store",
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (compatible; Casedra Localiza/1.0)",
			},
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as ArcGisQueryResponse<TAttributes>;
		return payload.features ?? [];
	} catch {
		return [];
	}
};

const buildZoningEvidence = (
	feature?: ArcGisFeature<MadridZoningAttributes>,
): LocalizaOnlineEvidenceItem[] => {
	const attributes = feature?.attributes;
	const zoningCode = cleanText(attributes?.AMB_TX_ETIQ);
	const zoningName = cleanText(attributes?.AMB_TX_DENOM);

	if (!zoningCode && !zoningName) {
		return [];
	}

	return [
		{
			label: "Norma zonal PGOUM",
			value: [zoningCode, zoningName].filter(Boolean).join(" · "),
			sourceLabel: "Ayuntamiento de Madrid - PGOUM 1997",
			sourceUrl: MADRID_PGOUM_SOURCE_URL,
			observedAt: new Date().toISOString(),
			kind: "planning_heritage",
		},
	];
};

const buildProtectedBuildingEvidence = (
	feature?: ArcGisFeature<MadridProtectedBuildingAttributes>,
): LocalizaOnlineEvidenceItem[] => {
	const attributes = feature?.attributes;
	const protection = cleanText(attributes?.CEP_TX_PROTECCION);
	const catalogNumber = cleanText(attributes?.CEP_TX_NUMCAT);

	if (!protection && !catalogNumber) {
		return [];
	}

	const name = cleanText(attributes?.CEP_TX_NOMBRE);
	const homogeneousSet = cleanText(attributes?.CEP_TX_CJTO_HOMOGENEO);
	const expediente = cleanText(attributes?.CEP_TX_EXPEDIENTE);
	const observations = cleanText(attributes?.CEP_TX_OBSERVACIONES);
	const rows = [
		{
			label: "Protección urbanística",
			value: [
				protection,
				catalogNumber ? `Catálogo ${catalogNumber}` : undefined,
			]
				.filter(Boolean)
				.join(" · "),
		},
		{
			label: "Elemento protegido",
			value: [name, homogeneousSet ? `Conjunto ${homogeneousSet}` : undefined]
				.filter(Boolean)
				.join(" · "),
		},
		{
			label: "Expediente patrimonio",
			value: expediente,
		},
		{
			label: "Observación patrimonio",
			value: observations,
		},
	];

	return rows
		.filter((row): row is { label: string; value: string } =>
			Boolean(row.value),
		)
		.map((row) => ({
			...row,
			sourceLabel: "Ayuntamiento de Madrid - Catálogo de edificios protegidos",
			sourceUrl: MADRID_HERITAGE_SOURCE_URL,
			observedAt: new Date().toISOString(),
			kind: "planning_heritage",
		}));
};

export const fetchMadridPlanningHeritageEvidence = async (input: {
	result: ResolveIdealistaLocationResult;
	signals?: IdealistaSignals;
}): Promise<LocalizaOnlineEvidenceItem[]> => {
	if (
		input.result.status !== "exact_match" &&
		input.result.status !== "building_match"
	) {
		return [];
	}

	if (!isMadridResult(input)) {
		return [];
	}

	const latitude = input.signals?.approximateLat;
	const longitude = input.signals?.approximateLng;
	const precisionMeters = input.signals?.mapPrecisionMeters;

	if (
		latitude === undefined ||
		longitude === undefined ||
		precisionMeters === undefined ||
		!Number.isFinite(latitude) ||
		!Number.isFinite(longitude) ||
		!Number.isFinite(precisionMeters) ||
		precisionMeters > MAX_PLANNING_COORDINATE_PRECISION_METERS
	) {
		return [];
	}

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		MADRID_PLANNING_TIMEOUT_MS,
	);

	try {
		const [zoningFeatures, protectedBuildingFeatures] = await Promise.all([
			queryArcGisPointLayer<MadridZoningAttributes>({
				baseUrl: MADRID_NORMAS_ZONALES_QUERY_URL,
				latitude,
				longitude,
				outFields: "AMB_TX_ETIQ,AMB_TX_DENOM",
				signal: abortController.signal,
			}),
			queryArcGisPointLayer<MadridProtectedBuildingAttributes>({
				baseUrl: MADRID_PROTECTED_BUILDINGS_QUERY_URL,
				latitude,
				longitude,
				outFields:
					"CEP_TX_NUMCAT,CEP_TX_NOMBRE,CEP_TX_PROTECCION,CEP_TX_CJTO_HOMOGENEO,CEP_TX_EXPEDIENTE,CEP_TX_OBSERVACIONES",
				signal: abortController.signal,
			}),
		]);

		return [
			...buildZoningEvidence(zoningFeatures[0]),
			...buildProtectedBuildingEvidence(protectedBuildingFeatures[0]),
		];
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};
