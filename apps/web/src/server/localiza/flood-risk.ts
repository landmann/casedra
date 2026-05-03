import type {
	IdealistaSignals,
	LocalizaPropertyDossier,
	ResolveIdealistaLocationResult,
} from "@casedra/types";

const FLOOD_WMS_URL =
	"https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones";
const FLOOD_SOURCE_URL =
	"https://www.miteco.gob.es/es/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html";
const FLOOD_RISK_TIMEOUT_MS = 2_500;

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

const floodLayers = [
	{
		layer: "NZ.Flood.FluvialT10",
		label: "Inundación fluvial",
		value: "Alta probabilidad (T=10 años)",
	},
	{
		layer: "NZ.Flood.FluvialT100",
		label: "Inundación fluvial",
		value: "Probabilidad media u ocasional (T=100 años)",
	},
	{
		layer: "NZ.Flood.FluvialT500",
		label: "Inundación fluvial",
		value: "Probabilidad baja o excepcional (T=500 años)",
	},
	{
		layer: "NZ.Flood.MarinaT100",
		label: "Inundación marina",
		value: "Probabilidad media u ocasional (T=100 años)",
	},
	{
		layer: "NZ.Flood.MarinaT500",
		label: "Inundación marina",
		value: "Probabilidad baja o excepcional (T=500 años)",
	},
] as const;

const hasFeatureInfoHit = (body: string) =>
	/Results for FeatureType/i.test(body) &&
	!/no features|no results|returned no results/i.test(body);

const buildFloodFeatureInfoUrl = (input: {
	layer: string;
	latitude: number;
	longitude: number;
}) => {
	const delta = 0.001;
	const url = new URL(FLOOD_WMS_URL);
	url.searchParams.set("SERVICE", "WMS");
	url.searchParams.set("VERSION", "1.3.0");
	url.searchParams.set("REQUEST", "GetFeatureInfo");
	url.searchParams.set("LAYERS", input.layer);
	url.searchParams.set("QUERY_LAYERS", input.layer);
	url.searchParams.set("CRS", "EPSG:4326");
	url.searchParams.set(
		"BBOX",
		[
			input.latitude - delta,
			input.longitude - delta,
			input.latitude + delta,
			input.longitude + delta,
		].join(","),
	);
	url.searchParams.set("WIDTH", "101");
	url.searchParams.set("HEIGHT", "101");
	url.searchParams.set("I", "50");
	url.searchParams.set("J", "50");
	url.searchParams.set("INFO_FORMAT", "text/plain");
	url.searchParams.set("FEATURE_COUNT", "5");
	return url;
};

const queryFloodLayer = async (input: {
	layer: string;
	latitude: number;
	longitude: number;
	signal: AbortSignal;
}) => {
	const response = await fetch(buildFloodFeatureInfoUrl(input), {
		method: "GET",
		signal: input.signal,
	});

	if (!response.ok) {
		return false;
	}

	return hasFeatureInfoHit(await response.text());
};

export const fetchFloodRiskEvidence = async (input: {
	result: ResolveIdealistaLocationResult;
	signals?: IdealistaSignals;
}): Promise<LocalizaOnlineEvidenceItem[]> => {
	if (
		input.result.status !== "exact_match" &&
		input.result.status !== "building_match"
	) {
		return [];
	}

	const latitude = input.signals?.approximateLat;
	const longitude = input.signals?.approximateLng;

	if (
		latitude === undefined ||
		longitude === undefined ||
		!Number.isFinite(latitude) ||
		!Number.isFinite(longitude)
	) {
		return [];
	}

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		FLOOD_RISK_TIMEOUT_MS,
	);

	try {
		const results = await Promise.all(
			floodLayers.map(async (layer) => ({
				...layer,
				hasHit: await queryFloodLayer({
					layer: layer.layer,
					latitude,
					longitude,
					signal: abortController.signal,
				}),
			})),
		);

		return results
			.filter((result) => result.hasHit)
			.map((result) => ({
				label: result.label,
				value: result.value,
				sourceLabel: "SNCZI / MITECO",
				sourceUrl: FLOOD_SOURCE_URL,
				observedAt: new Date().toISOString(),
				kind: "risk_overlay",
			}));
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};
