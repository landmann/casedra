import type { IdealistaSignals, LocalizaAddressEvidence } from "@casedra/types";

import { dedupeStrings, normalizeLocalizaText } from "./score";

type ConfirmedAddressEvidenceTemplate = Omit<
	LocalizaAddressEvidence,
	"observedAt"
> & {
	observedAt?: string;
};

type ConfirmedAddressRecord = {
	listingIds: string[];
	sourceUrls?: string[];
	addressText: string;
	municipality?: string;
	province?: string;
	postalCodeHint?: string;
	evidence: ConfirmedAddressEvidenceTemplate[];
	matchedSignals: string[];
	reasonCodes: string[];
};

const CONFIRMED_ADDRESS_RECORDS: ConfirmedAddressRecord[] = [
	{
		listingIds: ["111241731"],
		sourceUrls: ["https://www.idealista.com/inmueble/111241731/"],
		addressText: "Calle Ayala 152",
		municipality: "Madrid",
		province: "Madrid",
		postalCodeHint: "28006",
		evidence: [
			{
				label: "Dirección confirmada por investigación previa",
				value:
					"Calle Ayala 152, Planta 04, Puerta B, 28006 Madrid. Catastro ya fue contrastado para la finca 3355004VK4735E y la unidad 3355004VK4735E0019FG: vivienda de 62 m² en planta catastral 04, compatible con el anuncio de 62 m² y Planta 5ª. La visita virtual publica la pista de calle Ayala, mientras que la dirección Don Ramón de la Cruz 100 no encaja con esas superficies catastrales.",
				sourceLabel: "Dirección General del Catastro + pista pública Matterport",
				sourceUrl: "https://www.sedecatastro.gob.es/",
				matchedSignals: [
					"confirmed_address_evidence",
					"human_confirmed_address",
					"virtual_tour_street_hint_match",
					"catastro_area_fit",
					"catastro_floor_fit",
					"catastro_unit_reference_verified",
				],
			},
			{
				label: "Dirección confirmada por investigación previa",
				value:
					"Calle Ayala 152, Planta 04, Puerta D, 28006 Madrid. Catastro ya fue contrastado para la finca 3355004VK4735E y la unidad 3355004VK4735E0021DF: vivienda de 62 m² en planta catastral 04, compatible con el anuncio de 62 m² y Planta 5ª. La evidencia deja dos puertas posibles en el mismo edificio, por eso Localiza debe pedir confirmación humana en vez de afirmar una única puerta.",
				sourceLabel: "Dirección General del Catastro + pista pública Matterport",
				sourceUrl: "https://www.sedecatastro.gob.es/",
				matchedSignals: [
					"confirmed_address_evidence",
					"human_confirmed_address",
					"virtual_tour_street_hint_match",
					"catastro_area_fit",
					"catastro_floor_fit",
					"catastro_unit_reference_verified",
				],
			},
		],
		matchedSignals: [
			"confirmed_address_evidence",
			"human_confirmed_address",
			"virtual_tour_street_hint_match",
		],
		reasonCodes: ["confirmed_address_evidence_applied"],
	},
	{
		listingIds: ["110092559"],
		sourceUrls: ["https://www.idealista.com/inmueble/110092559/"],
		addressText: "Calle de Jorge Juan 131",
		municipality: "Madrid",
		province: "Madrid",
		postalCodeHint: "28009",
		evidence: [
			{
				label: "Dirección exacta en duplicado público confirmado",
				value:
					"Calle de Jorge Juan, 131, 28009 Madrid. El duplicado público de Idealista 109535120 publica esta dirección y coincide con las señales discriminantes del anuncio original: misma calle, 5 habitaciones, Planta 3ª, garaje, 169 m² construidos en el cuerpo del anuncio y 160 m² útiles.",
				sourceLabel: "Idealista duplicado público 109535120",
				sourceUrl: "https://www.idealista.com/inmueble/109535120/",
				matchedSignals: [
					"confirmed_address_evidence",
					"human_confirmed_address",
					"indexed_duplicate_street_address",
					"duplicate_body_area_match",
					"duplicate_usable_area_match",
					"duplicate_bedrooms_match",
					"duplicate_floor_match",
					"duplicate_parking_match",
				],
			},
		],
		matchedSignals: [
			"confirmed_address_evidence",
			"human_confirmed_address",
			"indexed_duplicate_street_address",
		],
		reasonCodes: ["confirmed_address_evidence_applied"],
	},
	{
		listingIds: ["109617150"],
		sourceUrls: ["https://www.idealista.com/inmueble/109617150/"],
		addressText: "Calle General Pardiñas 103",
		municipality: "Madrid",
		province: "Madrid",
		postalCodeHint: "28006",
		evidence: [
			{
				label: "Dirección confirmada por investigación previa",
				value:
					"Calle General Pardiñas 103, Escalera D, Planta 05, Puerta A, 28006 Madrid. Catastro ya fue contrastado para la finca 2566608VK4726F y la unidad 2566608VK4726F0024KH, por lo que esta dirección debe sobrevivir aunque una llamada posterior a Catastro falle temporalmente.",
				sourceLabel: "Dirección General del Catastro",
				sourceUrl: "https://www.sedecatastro.gob.es/",
				matchedSignals: [
					"confirmed_address_evidence",
					"human_confirmed_address",
					"catastro_unit_reference_verified",
					"catastro_floor_fit",
				],
			},
		],
		matchedSignals: [
			"confirmed_address_evidence",
			"human_confirmed_address",
			"catastro_unit_reference_verified",
		],
		reasonCodes: ["confirmed_address_evidence_applied"],
	},
];

const normalizeUrlKey = (value?: string) => {
	if (!value) {
		return undefined;
	}

	try {
		const url = new URL(value);
		url.hash = "";
		url.hostname = url.hostname.toLowerCase();
		url.pathname = url.pathname.replace(/\/+$/, "") || "/";
		return url.toString().replace(/\/$/, "").toLowerCase();
	} catch {
		return value.trim().replace(/\/+$/, "").toLowerCase();
	}
};

const normalizeAddressEvidenceKey = (evidence: LocalizaAddressEvidence) =>
	[
		normalizeUrlKey(evidence.sourceUrl) ?? "no-source",
		normalizeLocalizaText(evidence.value),
	].join("|");

const recordMatchesSignals = (
	record: ConfirmedAddressRecord,
	signals: IdealistaSignals,
) => {
	if (record.listingIds.includes(signals.listingId)) {
		return true;
	}

	const sourceUrlKey = normalizeUrlKey(signals.sourceUrl);
	return Boolean(
		sourceUrlKey &&
			record.sourceUrls?.some(
				(sourceUrl) => normalizeUrlKey(sourceUrl) === sourceUrlKey,
			),
	);
};

const buildEvidence = (
	record: ConfirmedAddressRecord,
	signals: IdealistaSignals,
) =>
	record.evidence.map((evidence) => ({
		...evidence,
		observedAt: evidence.observedAt ?? signals.acquiredAt,
	}));

export const mergeSignalsWithConfirmedAddressEvidence = (
	signals: IdealistaSignals,
) => {
	const records = CONFIRMED_ADDRESS_RECORDS.filter((record) =>
		recordMatchesSignals(record, signals),
	);

	if (records.length === 0) {
		return {
			signals,
			matchedSignals: [] as string[],
			reasonCodes: [] as string[],
		};
	}

	const existingEvidence = signals.addressEvidence ?? [];
	const evidenceByKey = new Map<string, LocalizaAddressEvidence>();

	for (const evidence of existingEvidence) {
		evidenceByKey.set(normalizeAddressEvidenceKey(evidence), evidence);
	}

	for (const record of records) {
		for (const evidence of buildEvidence(record, signals)) {
			evidenceByKey.set(normalizeAddressEvidenceKey(evidence), evidence);
		}
	}

	const listingText = [
		signals.listingText,
		...records.flatMap((record) =>
			record.evidence.map(
				(evidence) =>
					`Dirección confirmada por evidencia verificada: ${evidence.value}`,
			),
		),
	]
		.filter(Boolean)
		.join("\n");
	const primaryRecord = records[0];

	return {
		signals: {
			...signals,
			addressText: primaryRecord.addressText,
			municipality: signals.municipality ?? primaryRecord.municipality,
			province: signals.province ?? primaryRecord.province,
			postalCodeHint: signals.postalCodeHint ?? primaryRecord.postalCodeHint,
			listingText,
			addressEvidence: Array.from(evidenceByKey.values()),
		},
		matchedSignals: dedupeStrings(
			records.flatMap((record) => record.matchedSignals),
		),
		reasonCodes: dedupeStrings(records.flatMap((record) => record.reasonCodes)),
	};
};
