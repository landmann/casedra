import type { LocalizaPropertyDossier } from "@casedra/types";

const EUSKOREGITE_API_BASE_URL = "https://api.euskadi.eus";
const EUSKOREGITE_CATALOG_URL =
	"https://opendata.euskadi.eus/catalogo/-/inspeccion-tecnica-de-edificios-de-euskadi-euskoregite/";
const EUSKOREGITE_SOURCE_LABEL = "Euskoregite - Gobierno Vasco";
const EUSKOREGITE_TIMEOUT_MS = 8_000;

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

type NoraItem = {
	id?: string;
	name?: string;
};

type EuskoregiteControl = {
	presentationDate?: string;
	receptionDate?: string;
	signatureDate?: string;
	publicationDate?: string;
	state?: {
		id?: string;
		name?: string;
	};
	coverValue?: number;
	foundationValue?: number;
	structureValue?: number;
	enclosureValue?: number;
	waterSupplyValue?: number;
	waterEvacuationValue?: number;
	pendingCorrection?: boolean;
	correction?: {
		signatureDate?: string;
		publicationDate?: string;
		coverValue?: number;
		foundationValue?: number;
		structureValue?: number;
		enclosureValue?: number;
		waterSupplyValue?: number;
		waterEvacuationValue?: number;
	};
	usageAndMaintenancePlan?: boolean;
	satisfiesCondition?: boolean;
	accessibility?: string;
	ACCSusceptibleToImprovements?: boolean;
	overallValueEfficiency?: string;
	globalEmissionsEfficiency?: number;
	globalConsumptionEfficiency?: number;
};

type EuskoregiteFeature = {
	properties?: {
		id?: string;
		name?: string;
		cadastralReference?: string;
		constructionYear?: number;
		rehabilitationLastYear?: number;
		exempt?: boolean;
		nextTechnicalBuildingControlDate?: string;
		protected?: boolean;
		location?: {
			street?: string;
			portal?: string;
			postalCode?: string;
			locality?: string;
			municipality?: string;
			county?: string;
		};
		technicalBuildingControls?: EuskoregiteControl[];
		_links?: {
			self?: {
				href?: string;
			};
		};
	};
};

type EuskoregiteFeatureCollection = {
	features?: EuskoregiteFeature[];
};

const normalizeText = (value?: string) =>
	value
		?.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(
			/\b(kalea|calle|cl|av|avenida|etorbidea|etorbide|plaza|paseo|pasealekua)\b/g,
			" ",
		)
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const normalizeReference = (value?: string) =>
	value
		?.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");

const normalizePortal = (value?: string) => {
	const normalized = value?.trim().toUpperCase();
	if (!normalized) {
		return undefined;
	}

	const match = normalized.match(/^0*([0-9]+)([A-Z]+)?/);
	return match ? `${Number(match[1])}${match[2] ?? ""}` : normalized;
};

const formatDate = (value?: string) =>
	value && Number.isFinite(Date.parse(value))
		? new Intl.DateTimeFormat("es-ES", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			}).format(new Date(value))
		: undefined;

const formatBoolean = (value?: boolean) =>
	value === undefined ? undefined : value ? "Sí" : "No";

const getCountyId = (dossier: LocalizaPropertyDossier) => {
	const normalized = normalizeText(
		[dossier.officialIdentity.province, dossier.officialIdentity.officialSource]
			.filter(Boolean)
			.join(" "),
	);

	if (!normalized) {
		return undefined;
	}

	if (/\b(alava|araba)\b/.test(normalized)) {
		return "01";
	}

	if (/\bbizkaia\b|\bvizcaya\b/.test(normalized)) {
		return "48";
	}

	if (/\bgipuzkoa\b|\bguipuzcoa\b/.test(normalized)) {
		return "20";
	}

	return undefined;
};

const requestJson = async <T>(
	path: string,
	signal: AbortSignal,
): Promise<T> => {
	const response = await fetch(`${EUSKOREGITE_API_BASE_URL}${path}`, {
		signal,
		cache: "no-store",
		headers: {
			Accept: "application/geo+json, application/json",
			"User-Agent": "Mozilla/5.0 (compatible; Casedra Localiza/1.0)",
		},
	});

	if (!response.ok) {
		throw new Error(`euskoregite_http_${response.status}`);
	}

	return (await response.json()) as T;
};

const findNamedItem = (items: NoraItem[], name?: string) => {
	const normalizedName = normalizeText(name);
	if (!normalizedName) {
		return undefined;
	}

	return items.find((item) => normalizeText(item.name) === normalizedName);
};

const findStreetItem = (items: NoraItem[], street?: string) => {
	const normalizedStreet = normalizeText(street);
	if (!normalizedStreet) {
		return undefined;
	}

	return (
		items.find((item) => normalizeText(item.name) === normalizedStreet) ??
		items.find((item) => {
			const candidate = normalizeText(item.name);
			if (!candidate) {
				return false;
			}
			return (
				candidate === normalizedStreet ||
				normalizedStreet.endsWith(candidate) ||
				candidate.endsWith(normalizedStreet)
			);
		})
	);
};

const findPortalItem = (items: NoraItem[], number?: string) => {
	const normalizedNumber = normalizePortal(number);
	if (!normalizedNumber) {
		return undefined;
	}

	return items.find((item) => normalizePortal(item.name) === normalizedNumber);
};

const getLatestControl = (controls?: EuskoregiteControl[]) =>
	[...(controls ?? [])].sort(
		(left, right) =>
			Date.parse(
				right.publicationDate ??
					right.presentationDate ??
					right.signatureDate ??
					"1970-01-01",
			) -
			Date.parse(
				left.publicationDate ??
					left.presentationDate ??
					left.signatureDate ??
					"1970-01-01",
			),
	)[0];

const getControlGrades = (control?: EuskoregiteControl) => {
	if (!control) {
		return undefined;
	}

	const rows = [
		["Cubierta", control.coverValue],
		["Cimentación", control.foundationValue],
		["Estructura", control.structureValue],
		["Cerramientos", control.enclosureValue],
		["Agua", control.waterSupplyValue],
		["Evacuación", control.waterEvacuationValue],
	].filter((row): row is [string, number] => typeof row[1] === "number");

	return rows.length > 0
		? rows.map(([label, value]) => `${label} ${value}`).join(" · ")
		: undefined;
};

const buildEvidence = (
	feature: EuskoregiteFeature,
): LocalizaOnlineEvidenceItem[] => {
	const properties = feature.properties;
	if (!properties) {
		return [];
	}

	const latestControl = getLatestControl(properties.technicalBuildingControls);
	const sourceUrl = EUSKOREGITE_CATALOG_URL;
	const controlDate = formatDate(
		latestControl?.publicationDate ??
			latestControl?.presentationDate ??
			latestControl?.signatureDate,
	);
	const nextControlDate = formatDate(
		properties.nextTechnicalBuildingControlDate,
	);
	const correctionDate = formatDate(
		latestControl?.correction?.publicationDate ??
			latestControl?.correction?.signatureDate,
	);
	const efficiency = [
		latestControl?.overallValueEfficiency
			? `Etiqueta ${latestControl.overallValueEfficiency}`
			: undefined,
		latestControl?.globalConsumptionEfficiency !== undefined
			? `${latestControl.globalConsumptionEfficiency} kWh/m² año`
			: undefined,
		latestControl?.globalEmissionsEfficiency !== undefined
			? `${latestControl.globalEmissionsEfficiency} kg CO₂/m² año`
			: undefined,
	]
		.filter(Boolean)
		.join(" · ");
	const rows = [
		{
			label: "Estado ITE/IEE",
			value:
				latestControl?.state?.name ??
				(properties.exempt ? "Edificio exento" : undefined),
		},
		{ label: "Próxima ITE/IEE", value: nextControlDate },
		{
			label: "Última ITE/IEE publicada",
			value: controlDate,
		},
		{
			label: "Grados de conservación ITE",
			value: getControlGrades(latestControl),
		},
		{
			label: "Subsanación ITE",
			value: correctionDate
				? `Subsanada el ${correctionDate}`
				: latestControl?.pendingCorrection
					? "Pendiente de subsanación"
					: undefined,
		},
		{
			label: "Accesibilidad ITE",
			value:
				latestControl?.ACCSusceptibleToImprovements === true
					? "Susceptible de mejoras"
					: latestControl?.accessibility,
		},
		{
			label: "Eficiencia ITE",
			value: efficiency || undefined,
		},
		{
			label: "Año de construcción Euskoregite",
			value: properties.constructionYear?.toString(),
		},
		{
			label: "Última rehabilitación Euskoregite",
			value: properties.rehabilitationLastYear?.toString(),
		},
		{
			label: "Edificio protegido Euskoregite",
			value: formatBoolean(properties.protected),
		},
	];

	return rows
		.filter((row): row is { label: string; value: string } =>
			Boolean(row.value),
		)
		.map((row) => ({
			...row,
			sourceLabel: EUSKOREGITE_SOURCE_LABEL,
			sourceUrl,
			kind: "building_condition",
		}));
};

const findMatchingFeature = (
	features: EuskoregiteFeature[],
	dossier: LocalizaPropertyDossier,
) => {
	const requestedRefs = [
		normalizeReference(dossier.officialIdentity.unitRef20),
		normalizeReference(dossier.officialIdentity.parcelRef14),
	].filter((value): value is string => Boolean(value));
	const requestedPortal = normalizePortal(dossier.officialIdentity.number);
	const requestedStreet = normalizeText(dossier.officialIdentity.street);

	return (
		features.find((feature) => {
			const reference = normalizeReference(
				feature.properties?.cadastralReference,
			);
			if (!reference) {
				return false;
			}
			return requestedRefs.some((requestedRef) => {
				if (reference === requestedRef) {
					return true;
				}
				if (reference.length < 14 || requestedRef.length < 14) {
					return false;
				}
				return reference.slice(0, 14) === requestedRef.slice(0, 14);
			});
		}) ??
		features.find((feature) => {
			const location = feature.properties?.location;
			return (
				normalizePortal(location?.portal) === requestedPortal &&
				normalizeText(location?.street) === requestedStreet
			);
		})
	);
};

export const fetchEuskoregiteBuildingConditionEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const countyId = getCountyId(dossier);
	const identity = dossier.officialIdentity;

	if (
		!countyId ||
		!identity.municipality ||
		!identity.street ||
		!identity.number
	) {
		return [];
	}

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		EUSKOREGITE_TIMEOUT_MS,
	);

	try {
		const municipalities = await requestJson<NoraItem[]>(
			`/nora/states/16/counties/${countyId}/municipalities?summarized=true`,
			abortController.signal,
		);
		const municipality = findNamedItem(municipalities, identity.municipality);
		if (!municipality?.id) {
			return [];
		}

		const localities = await requestJson<NoraItem[]>(
			`/nora/states/16/counties/${countyId}/municipalities/${municipality.id}/localities?summarized=true`,
			abortController.signal,
		);
		const candidateLocalities = [
			findNamedItem(localities, identity.municipality),
			...localities,
		]
			.filter((item): item is NoraItem => Boolean(item?.id))
			.filter(
				(item, index, items) =>
					items.findIndex((candidate) => candidate.id === item.id) === index,
			)
			.slice(0, 3);

		for (const locality of candidateLocalities) {
			const streets = await requestJson<NoraItem[]>(
				`/nora/states/16/counties/${countyId}/municipalities/${municipality.id}/localities/${locality.id}/streets?summarized=true`,
				abortController.signal,
			);
			const street = findStreetItem(streets, identity.street);
			if (!street?.id) {
				continue;
			}

			const portals = await requestJson<NoraItem[]>(
				`/nora/states/16/counties/${countyId}/municipalities/${municipality.id}/localities/${locality.id}/streets/${street.id}/portals?summarized=true`,
				abortController.signal,
			);
			const portal = findPortalItem(portals, identity.number);
			if (!portal?.id) {
				continue;
			}

			const payload = await requestJson<EuskoregiteFeatureCollection>(
				`/euskoregite/buildings/${portal.id}?lang=SPANISH`,
				abortController.signal,
			);
			const feature = findMatchingFeature(payload.features ?? [], dossier);
			if (feature) {
				return buildEvidence(feature);
			}
		}

		return [];
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};
