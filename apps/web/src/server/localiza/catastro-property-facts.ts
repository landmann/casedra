import type { LocalizaPropertyDossier } from "@casedra/types";

const CATASTRO_DESCRIPTIVE_URL =
	"https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC";
const CATASTRO_FACTS_TIMEOUT_MS = 2_500;
const CATASTRO_OFFICIAL_SOURCE = "Dirección General del Catastro";

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

type CatastroRc = {
	pc1?: string;
	pc2?: string;
	car?: string;
	cc1?: string;
	cc2?: string;
};

type CatastroConstruction = {
	lcd?: string;
	dfcons?: {
		stl?: string | number;
	};
	dvcons?: {
		dtip?: string;
	};
};

type CatastroDescriptivePayload = {
	consulta_dnprcResult?: {
		bico?: {
			bi?: {
				idbi?: {
					rc?: CatastroRc;
				};
				debi?: {
					luso?: string;
					sfc?: string | number;
					ant?: string | number;
					cpt?: string | number;
				};
			};
			finca?: {
				ldt?: string;
				ltp?: string;
				dff?: {
					ss?: string | number;
				};
				infgraf?: {
					igraf?: string;
				};
			};
			lcons?: CatastroConstruction[];
		};
	};
};

const normalizeReference = (value?: string) =>
	value
		?.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9]/g, "");

const safeString = (value: unknown) => {
	if (typeof value !== "string" && typeof value !== "number") {
		return undefined;
	}

	const trimmed = String(value).trim();
	return trimmed ? trimmed : undefined;
};

const parseNumber = (value: unknown) => {
	const normalized = safeString(value)?.replace(/\./g, "").replace(",", ".");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const formatInteger = (value?: number) =>
	value === undefined
		? undefined
		: new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);

const formatArea = (value: unknown) => {
	const parsed = parseNumber(value);
	const formatted = formatInteger(parsed);
	return formatted ? `${formatted} m²` : undefined;
};

const formatPercent = (value: unknown) => {
	const parsed = parseNumber(value);

	return parsed === undefined
		? undefined
		: `${new Intl.NumberFormat("es-ES", {
				maximumFractionDigits: 2,
			}).format(parsed)} %`;
};

const buildReference = (rc?: CatastroRc) =>
	normalizeReference([rc?.pc1, rc?.pc2, rc?.car, rc?.cc1, rc?.cc2].join(""));

const isBrowserUrl = (value?: string) => {
	if (!value) {
		return false;
	}

	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
};

const buildConstructionBreakdown = (constructions?: CatastroConstruction[]) => {
	const rows = (constructions ?? [])
		.map((construction) => {
			const label = construction.lcd ?? construction.dvcons?.dtip;
			const area = formatArea(construction.dfcons?.stl);
			return label && area ? `${label}: ${area}` : undefined;
		})
		.filter(Boolean)
		.slice(0, 4);

	if (rows.length === 0) {
		return undefined;
	}

	const overflow =
		constructions && constructions.length > rows.length
			? ` · +${constructions.length - rows.length} más`
			: "";
	return `${rows.join(" · ")}${overflow}`;
};

const buildCatastroFactsEvidence = (
	payload: CatastroDescriptivePayload,
	sourceUrl?: string,
): LocalizaOnlineEvidenceItem[] => {
	const result = payload.consulta_dnprcResult?.bico;
	const building = result?.bi?.debi;
	const parcel = result?.finca;
	const constructionBreakdown = buildConstructionBreakdown(result?.lcons);
	const evidence = [
		{
			label: "Año de construcción catastral",
			value: safeString(building?.ant),
		},
		{
			label: "Uso catastral",
			value: building?.luso,
		},
		{
			label: "Superficie construida catastral",
			value: formatArea(building?.sfc),
		},
		{
			label: "Tipo de finca",
			value: parcel?.ltp,
		},
		{
			label: "Superficie de parcela",
			value: formatArea(parcel?.dff?.ss),
		},
		{
			label: "Coeficiente de participación",
			value: formatPercent(building?.cpt),
		},
		{
			label: "Desglose constructivo",
			value: constructionBreakdown,
		},
	];

	return evidence
		.filter(
			(item): item is { label: string; value: string } => Boolean(item.value),
		)
		.map((item) => ({
			...item,
			sourceLabel: CATASTRO_OFFICIAL_SOURCE,
			sourceUrl,
			kind: "building_cadastre",
		}));
};

export const fetchCatastroPropertyFactsEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const identity = dossier.officialIdentity;
	const reference = identity.unitRef20 ?? identity.parcelRef14;

	if (identity.officialSource !== CATASTRO_OFFICIAL_SOURCE || !reference) {
		return [];
	}

	const url = new URL(CATASTRO_DESCRIPTIVE_URL);
	url.searchParams.set("RefCat", reference);

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		CATASTRO_FACTS_TIMEOUT_MS,
	);

	try {
		const response = await fetch(url, {
			method: "GET",
			signal: abortController.signal,
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (compatible; Casedra Localiza/1.0)",
			},
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as CatastroDescriptivePayload;
		const returnedReference = buildReference(
			payload.consulta_dnprcResult?.bico?.bi?.idbi?.rc,
		);
		const requestedReference = normalizeReference(reference);

		if (
			!returnedReference ||
			!requestedReference ||
			!returnedReference.startsWith(requestedReference.slice(0, 14))
		) {
			return [];
		}

		const mapUrl =
			payload.consulta_dnprcResult?.bico?.finca?.infgraf?.igraf ?? undefined;

		return buildCatastroFactsEvidence(
			payload,
			isBrowserUrl(mapUrl) ? mapUrl : undefined,
		);
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};
