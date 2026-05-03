import type {
	IdealistaSignals,
	LocalizaPropertyDossier,
	ResolveIdealistaLocationResult,
} from "@casedra/types";

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const AMENITY_SOURCE_URL = "https://www.openstreetmap.org/";
const AMENITY_TIMEOUT_MS = 5_000;
const AMENITY_RADIUS_METERS = 800;

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

type OverpassElement = {
	id: number;
	type: "node" | "way" | "relation";
	lat?: number;
	lon?: number;
	center?: {
		lat?: number;
		lon?: number;
	};
	tags?: Record<string, string>;
};

type AmenityCategory =
	| "transit"
	| "schools"
	| "health"
	| "food"
	| "green";

type CategorizedAmenity = {
	category: AmenityCategory;
	name: string;
	distanceMeters: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
	const earthRadiusMeters = 6_371_000;
	const dLat = toRadians(to.lat - from.lat);
	const dLng = toRadians(to.lng - from.lng);
	const lat1 = toRadians(from.lat);
	const lat2 = toRadians(to.lat);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return earthRadiusMeters * c;
};

const getElementPoint = (element: OverpassElement) => {
	const lat = element.lat ?? element.center?.lat;
	const lng = element.lon ?? element.center?.lon;

	return lat !== undefined &&
		lng !== undefined &&
		Number.isFinite(lat) &&
		Number.isFinite(lng)
		? { lat, lng }
		: undefined;
};

const getName = (tags?: Record<string, string>) =>
	tags?.name ?? tags?.brand ?? tags?.operator ?? "punto cercano";

const truncateLabel = (value: string) =>
	value.length > 72 ? `${value.slice(0, 69).trim()}...` : value;

const categorizeElement = (
	element: OverpassElement,
): AmenityCategory | undefined => {
	const tags = element.tags ?? {};

	if (
		tags.railway === "station" ||
		tags.railway === "halt" ||
		tags.railway === "tram_stop" ||
		tags.railway === "subway_entrance" ||
		tags.highway === "bus_stop" ||
		tags.public_transport === "platform" ||
		tags.public_transport === "station"
	) {
		return "transit";
	}

	if (tags.amenity === "school" || tags.amenity === "kindergarten") {
		return "schools";
	}

	if (
		tags.amenity === "hospital" ||
		tags.amenity === "clinic" ||
		tags.amenity === "doctors" ||
		tags.amenity === "pharmacy"
	) {
		return "health";
	}

	if (tags.shop === "supermarket" || tags.shop === "convenience") {
		return "food";
	}

	if (
		tags.leisure === "park" ||
		tags.leisure === "garden" ||
		tags.landuse === "recreation_ground"
	) {
		return "green";
	}

	return undefined;
};

const buildOverpassQuery = (lat: number, lng: number) => `
[out:json][timeout:5];
(
  node(around:${AMENITY_RADIUS_METERS},${lat},${lng})["railway"~"station|halt|tram_stop|subway_entrance"];
  node(around:${AMENITY_RADIUS_METERS},${lat},${lng})["highway"="bus_stop"];
  node(around:${AMENITY_RADIUS_METERS},${lat},${lng})["public_transport"~"platform|station"];
  node(around:${AMENITY_RADIUS_METERS},${lat},${lng})["amenity"~"school|kindergarten|hospital|clinic|doctors|pharmacy"];
  node(around:${AMENITY_RADIUS_METERS},${lat},${lng})["shop"~"supermarket|convenience"];
  way(around:${AMENITY_RADIUS_METERS},${lat},${lng})["amenity"~"school|kindergarten|hospital|clinic"];
  way(around:${AMENITY_RADIUS_METERS},${lat},${lng})["leisure"~"park|garden"];
  way(around:${AMENITY_RADIUS_METERS},${lat},${lng})["landuse"="recreation_ground"];
);
out center tags 80;
`;

const summarizeCategory = (
	category: AmenityCategory,
	items: CategorizedAmenity[],
): LocalizaOnlineEvidenceItem | undefined => {
	const sortedItems = items
		.filter((item) => item.category === category)
		.sort((left, right) => left.distanceMeters - right.distanceMeters);
	const nearest = sortedItems[0];

	if (!nearest) {
		return undefined;
	}

	const categoryLabel: Record<AmenityCategory, string> = {
		transit: "Transporte cercano",
		schools: "Centros educativos cerca",
		health: "Salud y farmacia cerca",
		food: "Compra diaria cerca",
		green: "Zonas verdes cerca",
	};
	const countLabel =
		sortedItems.length === 1
			? "1 punto"
			: `${new Intl.NumberFormat("es-ES").format(sortedItems.length)} puntos`;
	const distanceLabel = new Intl.NumberFormat("es-ES", {
		maximumFractionDigits: 0,
	}).format(nearest.distanceMeters);

	return {
		label: categoryLabel[category],
		value: `${countLabel} en ${AMENITY_RADIUS_METERS} m; más cercano: ${nearest.name} a ${distanceLabel} m`,
		sourceLabel: "OpenStreetMap / Overpass",
		sourceUrl: AMENITY_SOURCE_URL,
		kind: "local_amenity",
	};
};

export const fetchLocationAmenityEvidence = async (input: {
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
	const timeoutId = setTimeout(() => abortController.abort(), AMENITY_TIMEOUT_MS);

	try {
		const response = await fetch(OVERPASS_API_URL, {
			method: "POST",
			signal: abortController.signal,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
				"User-Agent": "curl/8.7.1 Casedra-Localiza/1.0",
			},
			body: new URLSearchParams({
				data: buildOverpassQuery(latitude, longitude),
			}),
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as { elements?: OverpassElement[] };
		const seen = new Set<string>();
		const categorized = (payload.elements ?? [])
			.map((element): CategorizedAmenity | undefined => {
				const point = getElementPoint(element);
				const category = categorizeElement(element);

				if (!point || !category) {
					return undefined;
				}

				const name = getName(element.tags);
				const key = `${category}:${name}:${element.type}:${element.id}`;

				if (seen.has(key)) {
					return undefined;
				}
				seen.add(key);

				return {
					category,
					name: truncateLabel(name),
					distanceMeters: distanceMeters(
						{ lat: latitude, lng: longitude },
						point,
					),
				};
			})
			.filter((item): item is CategorizedAmenity => Boolean(item));

		return (
			["transit", "food", "schools", "health", "green"] as AmenityCategory[]
		)
			.map((category) => summarizeCategory(category, categorized))
			.filter((item): item is LocalizaOnlineEvidenceItem => Boolean(item));
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};
