import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
	CaptacionBoundaryPoint,
	CaptacionRankedBuilding,
	CaptacionRankingConfidence,
	CaptacionRankingResult,
	CaptacionRankingSource,
} from "@casedra/types";

import {
	detectRegionalTerritory,
	formatPostalCode,
	getProvinceNameFromCode,
	humanizePlaceName,
	humanizeStreetName,
} from "./score";

const CATASTRO_COMMON_TERRITORY_ADAPTER = "catastro_common_territory";
const CATASTRO_BUILDINGS_WFS_URL =
	"https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx";
const CATASTRO_ADDRESSES_WFS_URL =
	"https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx";
const CATASTRO_OFFICIAL_SOURCE = "Dirección General del Catastro";
const CATASTRO_WFS_TIMEOUT_MS = 12_000;
const MAX_FEATURES_PER_REQUEST = 1200;
const MAX_BOUNDARY_AREA_KM2 = 12;
const RESIDENTIAL_UNIT_INDEX_PATH = path.join(
	process.cwd(),
	"data/captacion/catastro-residential-units.jsonl",
);

type WebMercatorPoint = {
	x: number;
	y: number;
};

type AddressSummary = {
	label: string;
	municipality?: string;
	province?: string;
};

type ParsedBuilding = {
	cadastralReference: string;
	centroid: WebMercatorPoint;
	geometryPoints: WebMercatorPoint[];
	currentUse?: string;
	numberOfDwellings?: number;
	numberOfBuildingUnits?: number;
	officialAreaM2?: number;
	officialUrl?: string;
};

type ResidentialUnitIndexRow = {
	cadastralReference?: string;
	buildingReference?: string;
	unitReference?: string;
	surfaceM2?: number;
	use?: string;
	addressLabel?: string;
	municipality?: string;
	province?: string;
	sourceVersion?: string;
	observedAt?: string;
};
type ResidentialUnitIndexRecord = ResidentialUnitIndexRow & {
	surfaceM2: number;
};

type ResidentialUnitAggregate = {
	largestResidentialUnitM2: number;
	unitReference?: string;
	addressLabel?: string;
	municipality?: string;
	province?: string;
};

type CaptacionTerritoryAdapter = {
	id: string;
	label: string;
	rankBuildings: (input: {
		boundary: CaptacionBoundaryPoint[];
		userId?: string;
	}) => Promise<CaptacionRankingResult>;
};

const logCaptacionEvent = (event: string, payload: Record<string, unknown>) => {
	console.info(
		JSON.stringify({
			scope: "localiza",
			event,
			timestamp: new Date().toISOString(),
			...payload,
		}),
	);
};

const decodeXmlEntities = (value?: string) => {
	if (!value) {
		return undefined;
	}

	return value
		.replace(/^<!\[CDATA\[/, "")
		.replace(/\]\]>$/, "")
		.replace(/&amp;/g, "&")
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#(\d+);/g, (_, code: string) =>
			String.fromCharCode(Number(code)),
		)
		.replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
			String.fromCharCode(parseInt(code, 16)),
		);
};

const readSingleTag = (body: string, tagName: string) => {
	const match = body.match(
		new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`),
	);
	return decodeXmlEntities(match?.[1]?.trim());
};

const readAllTags = (body: string, tagName: string) =>
	Array.from(
		body.matchAll(
			new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "g"),
		),
		(match) => decodeXmlEntities(match[1]?.trim()),
	).filter((value): value is string => Boolean(value));

const readNumber = (value?: string) => {
	const parsed = Number(value?.replace(/\./g, "").replace(",", "."));

	return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeReference = (value?: string) =>
	value
		?.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9]/g, "");

const getBuildingReference = (value?: string) =>
	normalizeReference(value)?.slice(0, 14);

const collectFeatureBlocks = (xml: string, tagName: string) =>
	Array.from(
		xml.matchAll(
			new RegExp(
				`<${tagName}\\b[^>]*gml:id="([^"]+)"[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
				"g",
			),
		),
		(match) => ({
			id: match[1],
			body: match[2],
		}),
	);

const wgs84ToWebMercator = (
	point: CaptacionBoundaryPoint,
): WebMercatorPoint => {
	const clampedLat = Math.min(Math.max(point.lat, -85.05112878), 85.05112878);
	const x = (point.lng * 20037508.34) / 180;
	const y =
		(Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) /
			(Math.PI / 180)) *
		(20037508.34 / 180);

	return { x, y };
};

const webMercatorToWgs84 = (
	point: WebMercatorPoint,
): CaptacionBoundaryPoint => ({
	lng: (point.x / 20037508.34) * 180,
	lat:
		(180 / Math.PI) *
		(2 * Math.atan(Math.exp((point.y / 20037508.34) * Math.PI)) - Math.PI / 2),
});

const getBoundingBox = (points: WebMercatorPoint[]) => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}

	return { minX, minY, maxX, maxY };
};

const getPolygonAreaM2 = (points: WebMercatorPoint[]) => {
	let area = 0;

	for (const [index, point] of points.entries()) {
		const next = points[(index + 1) % points.length];
		if (next) {
			area += point.x * next.y - next.x * point.y;
		}
	}

	return Math.abs(area) / 2;
};

const getBoundaryAreaKm2 = (boundary: CaptacionBoundaryPoint[]) =>
	getPolygonAreaM2(boundary.map(wgs84ToWebMercator)) / 1_000_000;

const isPointInPolygon = (
	point: WebMercatorPoint,
	polygon: WebMercatorPoint[],
) => {
	let inside = false;

	for (
		let index = 0, previous = polygon.length - 1;
		index < polygon.length;
		previous = index++
	) {
		const currentPoint = polygon[index];
		const previousPoint = polygon[previous];
		if (!currentPoint || !previousPoint) {
			continue;
		}

		const intersects =
			currentPoint.y > point.y !== previousPoint.y > point.y &&
			point.x <
				((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
					(previousPoint.y - currentPoint.y) +
					currentPoint.x;

		if (intersects) {
			inside = !inside;
		}
	}

	return inside;
};

const geometryTouchesPolygon = (
	points: WebMercatorPoint[],
	centroid: WebMercatorPoint,
	polygon: WebMercatorPoint[],
) =>
	isPointInPolygon(centroid, polygon) ||
	points.some((point) => isPointInPolygon(point, polygon));

const readPosListPoints = (body: string): WebMercatorPoint[] =>
	readAllTags(body, "gml:posList")
		.flatMap((posList) => {
			const values = posList
				.split(/\s+/)
				.map((value) => Number(value))
				.filter((value) => Number.isFinite(value));
			const points: WebMercatorPoint[] = [];

			for (let index = 0; index < values.length; index += 2) {
				const x = values[index];
				const y = values[index + 1];

				if (x !== undefined && y !== undefined) {
					points.push({ x, y });
				}
			}

			return points;
		})
		.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

const getGeometryCenter = (points: WebMercatorPoint[]) => {
	const bbox = getBoundingBox(points);

	return {
		x: (bbox.minX + bbox.maxX) / 2,
		y: (bbox.minY + bbox.maxY) / 2,
	};
};

const buildWfsUrl = (input: {
	url: string;
	typeNames: string;
	bbox: ReturnType<typeof getBoundingBox>;
}) => {
	const params = new URLSearchParams({
		service: "WFS",
		version: "2.0.0",
		request: "GetFeature",
		typeNames: input.typeNames,
		count: String(MAX_FEATURES_PER_REQUEST),
		bbox: [
			input.bbox.minX,
			input.bbox.minY,
			input.bbox.maxX,
			input.bbox.maxY,
			"urn:ogc:def:crs:EPSG::3857",
		].join(","),
		srsname: "urn:ogc:def:crs:EPSG::3857",
	});

	return `${input.url}?${params.toString()}`;
};

const fetchWfsXml = async (url: string) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		CATASTRO_WFS_TIMEOUT_MS,
	);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			cache: "no-store",
			headers: {
				Accept: "application/xml, text/xml;q=0.9, */*;q=0.8",
				"User-Agent": "Mozilla/5.0 (compatible; Casedra Captacion/1.0)",
			},
		});

		if (!response.ok) {
			throw new Error(`catastro_wfs_http_${response.status}`);
		}

		const xml = await response.text();

		if (xml.includes("<Exception")) {
			throw new Error("catastro_wfs_exception");
		}

		return xml;
	} finally {
		clearTimeout(timeoutId);
	}
};

const parseBuildings = (xml: string): ParsedBuilding[] =>
	collectFeatureBlocks(xml, "bu-ext2d:Building")
		.map((feature): ParsedBuilding | null => {
			const cadastralReference =
				readSingleTag(feature.body, "bu-core2d:reference") ??
				readSingleTag(feature.body, "base:localId") ??
				feature.id.split(".").at(-1);
			const geometryPoints = readPosListPoints(feature.body);

			if (!cadastralReference || geometryPoints.length === 0) {
				return null;
			}

			const officialUrl = readSingleTag(
				feature.body,
				"bu-core2d:informationSystem",
			);

			return {
				cadastralReference,
				centroid: getGeometryCenter(geometryPoints),
				geometryPoints,
				currentUse: readSingleTag(feature.body, "bu-ext2d:currentUse"),
				numberOfDwellings: readNumber(
					readSingleTag(feature.body, "bu-ext2d:numberOfDwellings"),
				),
				numberOfBuildingUnits: readNumber(
					readSingleTag(feature.body, "bu-ext2d:numberOfBuildingUnits"),
				),
				officialAreaM2: readNumber(
					readSingleTag(feature.body, "bu-ext2d:value"),
				),
				officialUrl,
			};
		})
		.filter((building): building is ParsedBuilding => Boolean(building));

const parseAddressFeatures = (xml: string) => {
	const thoroughfares = new Map<string, string>();
	const postalCodes = new Map<string, string>();
	const adminUnits = new Map<
		string,
		{ municipality?: string; province?: string }
	>();

	for (const feature of collectFeatureBlocks(xml, "ad:ThoroughfareName")) {
		const streetName = readSingleTag(feature.body, "gn:text");

		if (streetName) {
			thoroughfares.set(feature.id, streetName);
		}
	}

	for (const feature of collectFeatureBlocks(xml, "ad:PostalDescriptor")) {
		const postalCode = formatPostalCode(
			readSingleTag(feature.body, "ad:postCode"),
		);

		if (postalCode) {
			postalCodes.set(feature.id, postalCode);
		}
	}

	for (const feature of collectFeatureBlocks(xml, "ad:AdminUnitName")) {
		const localId = readSingleTag(feature.body, "base:localId");
		const provinceCode = localId?.split(".")[0];

		adminUnits.set(feature.id, {
			municipality: humanizePlaceName(readSingleTag(feature.body, "gn:text")),
			province: getProvinceNameFromCode(provinceCode),
		});
	}

	const addressByParcel = new Map<string, AddressSummary>();

	for (const feature of collectFeatureBlocks(xml, "ad:Address")) {
		const localId = readSingleTag(feature.body, "base:localId") ?? feature.id;
		const parcelRef = localId.split(".").at(-1);
		const designator = readSingleTag(feature.body, "ad:designator");
		const componentRefs = Array.from(
			feature.body.matchAll(/<ad:component xlink:href="#([^"]+)"\s*\/>/g),
			(match) => match[1],
		);
		const streetName = componentRefs
			.map((ref) => thoroughfares.get(ref))
			.find(Boolean);
		const postalCode = componentRefs
			.map((ref) => postalCodes.get(ref))
			.find(Boolean);
		const adminUnit = componentRefs
			.map((ref) => adminUnits.get(ref))
			.find(Boolean);
		const street = [humanizeStreetName(streetName), designator]
			.filter(Boolean)
			.join(" ");
		const locality = [postalCode, adminUnit?.municipality]
			.filter(Boolean)
			.join(" ");
		const label = [street, locality].filter(Boolean).join(", ");

		if (parcelRef && label && !addressByParcel.has(parcelRef)) {
			addressByParcel.set(parcelRef, {
				label,
				municipality: adminUnit?.municipality,
				province: adminUnit?.province,
			});
		}
	}

	return addressByParcel;
};

const isResidentialBuilding = (building: ParsedBuilding) =>
	(building.currentUse?.toLowerCase().includes("residential") ?? false) ||
	(building.numberOfDwellings ?? 0) > 0;

const isResidentialUnitIndexRow = (
	value: unknown,
): value is ResidentialUnitIndexRecord => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;

	return (
		(typeof record.cadastralReference === "string" ||
			typeof record.buildingReference === "string") &&
		typeof record.surfaceM2 === "number" &&
		Number.isFinite(record.surfaceM2)
	);
};

const readResidentialUnitIndex = async () => {
	let contents: string;

	try {
		contents = await readFile(RESIDENTIAL_UNIT_INDEX_PATH, "utf8");
	} catch {
		return new Map<string, ResidentialUnitAggregate>();
	}

	const aggregates = new Map<string, ResidentialUnitAggregate>();

	for (const line of contents.split(/\n+/)) {
		if (!line.trim()) {
			continue;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(line) as unknown;
		} catch {
			continue;
		}

		if (!isResidentialUnitIndexRow(parsed)) {
			continue;
		}

		if (
			parsed.use &&
			!/residencial|vivienda/i.test(parsed.use.normalize("NFD"))
		) {
			continue;
		}

		const buildingReference =
			getBuildingReference(parsed.buildingReference) ??
			getBuildingReference(parsed.cadastralReference);

		if (!buildingReference) {
			continue;
		}

		const current = aggregates.get(buildingReference);

		if (!current || parsed.surfaceM2 > current.largestResidentialUnitM2) {
			aggregates.set(buildingReference, {
				largestResidentialUnitM2: parsed.surfaceM2,
				unitReference: normalizeReference(parsed.unitReference),
				addressLabel: parsed.addressLabel,
				municipality: parsed.municipality,
				province: parsed.province,
			});
		}
	}

	return aggregates;
};

const getExactCoverage = (rows: CaptacionRankedBuilding[]) => {
	if (rows.length === 0) {
		return 0;
	}

	const exactRowCount = rows.filter(
		(row) => row.rankingConfidence === "exact",
	).length;

	return Math.round((exactRowCount / rows.length) * 10_000) / 10_000;
};

const toRankedRows = (input: {
	buildings: ParsedBuilding[];
	addressesByParcel: Map<string, AddressSummary>;
	unitIndex: Map<string, ResidentialUnitAggregate>;
	polygon: WebMercatorPoint[];
}): CaptacionRankedBuilding[] => {
	const rows = input.buildings
		.filter((building) => isResidentialBuilding(building))
		.filter((building) =>
			geometryTouchesPolygon(
				building.geometryPoints,
				building.centroid,
				input.polygon,
			),
		)
		.map((building) => {
			const address = input.addressesByParcel.get(building.cadastralReference);
			const unitAggregate = input.unitIndex.get(
				getBuildingReference(building.cadastralReference) ?? "",
			);
			const rankingSource: CaptacionRankingSource = unitAggregate
				? "catastro_alphanumeric_unit_surface"
				: "catastro_inspire_building_area";
			const rankingConfidence: CaptacionRankingConfidence = unitAggregate
				? "exact"
				: "diagnostic_proxy";
			const rankingSurfaceM2 =
				unitAggregate?.largestResidentialUnitM2 ?? building.officialAreaM2 ?? 0;

			return {
				rank: 0,
				cadastralReference: building.cadastralReference,
				addressLabel: unitAggregate?.addressLabel ?? address?.label,
				municipality: unitAggregate?.municipality ?? address?.municipality,
				province: unitAggregate?.province ?? address?.province,
				centroid: webMercatorToWgs84(building.centroid),
				largestResidentialUnitM2: unitAggregate?.largestResidentialUnitM2,
				largestResidentialUnitReference: unitAggregate?.unitReference,
				officialBuildingAreaM2: building.officialAreaM2,
				residentialUnitCount: building.numberOfDwellings,
				buildingUnitCount: building.numberOfBuildingUnits,
				currentUse: building.currentUse,
				rankingSurfaceM2,
				rankingSource,
				rankingConfidence,
				officialSource: CATASTRO_OFFICIAL_SOURCE,
				officialUrl: building.officialUrl,
			} satisfies CaptacionRankedBuilding;
		})
		.filter((row) => row.rankingSurfaceM2 > 0)
		.sort((left, right) => right.rankingSurfaceM2 - left.rankingSurfaceM2);

	return rows.map((row, index) => ({
		...row,
		rank: index + 1,
	}));
};

const rankCaptacionBuildingsWithCommonCatastro = async (input: {
	boundary: CaptacionBoundaryPoint[];
	userId?: string;
}): Promise<CaptacionRankingResult> => {
	const startedAt = Date.now();
	const polygon = input.boundary.map(wgs84ToWebMercator);
	const boundaryAreaKm2 = getPolygonAreaM2(polygon) / 1_000_000;

	logCaptacionEvent("captacion_search_started", {
		userId: input.userId,
		adapter: CATASTRO_COMMON_TERRITORY_ADAPTER,
		boundaryAreaKm2: Number(boundaryAreaKm2.toFixed(2)),
		pointCount: input.boundary.length,
	});

	if (boundaryAreaKm2 > MAX_BOUNDARY_AREA_KM2) {
		logCaptacionEvent("captacion_search_failed", {
			userId: input.userId,
			adapter: CATASTRO_COMMON_TERRITORY_ADAPTER,
			failureCode: "boundary_too_large",
			durationMs: Date.now() - startedAt,
		});
		throw new Error(
			`La zona ocupa ${boundaryAreaKm2.toFixed(1)} km². Dibuja como máximo un barrio.`,
		);
	}

	const bbox = getBoundingBox(polygon);
	const [buildingXml, addressXml] = await Promise.all([
		fetchWfsXml(
			buildWfsUrl({
				url: CATASTRO_BUILDINGS_WFS_URL,
				typeNames: "bu:Building",
				bbox,
			}),
		),
		fetchWfsXml(
			buildWfsUrl({
				url: CATASTRO_ADDRESSES_WFS_URL,
				typeNames: "ad:Address",
				bbox,
			}),
		),
	]);
	const buildings = parseBuildings(buildingXml);
	if (buildings.length >= MAX_FEATURES_PER_REQUEST) {
		logCaptacionEvent("captacion_search_failed", {
			userId: input.userId,
			adapter: CATASTRO_COMMON_TERRITORY_ADAPTER,
			failureCode: "feature_cap_reached",
			durationMs: Date.now() - startedAt,
		});
		throw new Error(
			"La zona devuelve demasiados edificios oficiales. Dibuja una zona más pequeña.",
		);
	}

	const addressesByParcel = parseAddressFeatures(addressXml);
	const unitIndex = await readResidentialUnitIndex();
	const rows = toRankedRows({
		buildings,
		addressesByParcel,
		unitIndex,
		polygon,
	});
	const exactRows = rows.filter((row) => row.rankingConfidence === "exact");
	const exactCoverage = getExactCoverage(rows);
	const exportEnabled = rows.length > 0 && exactRows.length === rows.length;
	const rankingConfidence: CaptacionRankingConfidence = exportEnabled
		? "exact"
		: "diagnostic_proxy";

	logCaptacionEvent("captacion_search_completed", {
		userId: input.userId,
		adapter: CATASTRO_COMMON_TERRITORY_ADAPTER,
		durationMs: Date.now() - startedAt,
		rowCount: rows.length,
		exactRowCount: exactRows.length,
		exactCoverage,
		warningCount: exportEnabled ? 1 : 2,
	});

	return {
		generatedAt: new Date().toISOString(),
		boundaryAreaKm2: Number(boundaryAreaKm2.toFixed(2)),
		adapter: CATASTRO_COMMON_TERRITORY_ADAPTER,
		rankingSource: exportEnabled
			? "catastro_alphanumeric_unit_surface"
			: "catastro_inspire_building_area",
		rankingConfidence,
		exactRowCount: exactRows.length,
		totalResidentialRowCount: rows.length,
		exactCoverage,
		exportEnabled,
		rows,
		warnings: [
			exportEnabled
				? "Ranking exacto: todas las filas se ordenan por la vivienda residencial individual más grande."
				: "Vista diagnóstica: falta cobertura CAT exacta para una o más filas, por eso la exportación comercial queda bloqueada.",
			exactRows.length === 0
				? "No se encontró el índice alfanumérico CAT de viviendas residenciales; se muestra superficie oficial de edificio solo como proxy visible."
				: `${exactRows.length} de ${rows.length} filas tienen superficie individual residencial exacta.`,
		],
	};
};

const commonCatastroAdapter: CaptacionTerritoryAdapter = {
	id: CATASTRO_COMMON_TERRITORY_ADAPTER,
	label: CATASTRO_OFFICIAL_SOURCE,
	rankBuildings: rankCaptacionBuildingsWithCommonCatastro,
};

const unsupportedRegionalAdapterLabels: Record<string, string> = {
	alava_catastro: "Álava/Araba",
	bizkaia_catastro: "Bizkaia",
	gipuzkoa_catastro: "Gipuzkoa",
	navarra_rtn: "Navarra",
};

const getBoundaryCentroid = (
	boundary: CaptacionBoundaryPoint[],
): CaptacionBoundaryPoint => ({
	lat:
		boundary.reduce((total, point) => total + point.lat, 0) / boundary.length,
	lng:
		boundary.reduce((total, point) => total + point.lng, 0) / boundary.length,
});

const selectCaptacionTerritoryAdapter = async (input: {
	boundary: CaptacionBoundaryPoint[];
	userId?: string;
}) => {
	const centroid = getBoundaryCentroid(input.boundary);
	const regionalTerritory = await detectRegionalTerritory({
		approximateLat: centroid.lat,
		approximateLng: centroid.lng,
	});

	if (regionalTerritory) {
		const label =
			unsupportedRegionalAdapterLabels[regionalTerritory.adapter] ??
			regionalTerritory.adapter;

		logCaptacionEvent("captacion_search_failed", {
			userId: input.userId,
			adapter: regionalTerritory.adapter,
			failureCode: "unsupported_territory",
			source: regionalTerritory.source,
		});

		throw new Error(
			`Captación todavía no tiene adaptador activo para ${label}. Dibuja una zona dentro del Catastro común o activa ese adaptador antes de exportar.`,
		);
	}

	return commonCatastroAdapter;
};

export const rankCaptacionBuildings = async (input: {
	boundary: CaptacionBoundaryPoint[];
	userId?: string;
}): Promise<CaptacionRankingResult> => {
	const boundaryAreaKm2 = getBoundaryAreaKm2(input.boundary);

	if (boundaryAreaKm2 > MAX_BOUNDARY_AREA_KM2) {
		logCaptacionEvent("captacion_search_failed", {
			userId: input.userId,
			failureCode: "boundary_too_large",
			boundaryAreaKm2: Number(boundaryAreaKm2.toFixed(2)),
			pointCount: input.boundary.length,
		});
		throw new Error(
			`La zona ocupa ${boundaryAreaKm2.toFixed(1)} km². Dibuja como máximo un barrio.`,
		);
	}

	const adapter = await selectCaptacionTerritoryAdapter(input);

	return await adapter.rankBuildings(input);
};
