import type { LocalizaPropertyDossier } from "@casedra/types";

const MADRID_CEEE_RESOURCE_ID = "4e42b49c-bb6b-485a-a7b7-8f760f356855";
const MADRID_CEEE_DATASTORE_URL =
	"https://datos.comunidad.madrid/catalogo/api/3/action/datastore_search";
const MADRID_CEEE_SOURCE_URL =
	"https://datos.comunidad.madrid/catalogo/dataset/registro_certificados_eficiencia_energetica";
const VALENCIANA_CEEE_WFS_URL = "https://terramapas.icv.gva.es/26_GCEE";
const CATALUNYA_CEEE_API_URL =
	"https://analisi.transparenciacatalunya.cat/resource/j6ii-t3w2.json";
const ENERGY_CERTIFICATE_TIMEOUT_MS = 2_500;

type LocalizaOnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

const normalizeSearchText = (value?: string) =>
	value
		?.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");

const safeString = (value: unknown) => {
	if (typeof value !== "string" && typeof value !== "number") {
		return undefined;
	}

	const trimmed = String(value).trim();
	return trimmed ? trimmed : undefined;
};

const parseDateValue = (value?: string) => {
	const trimmed = safeString(value);

	if (!trimmed) {
		return undefined;
	}

	const dayFirstMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

	if (dayFirstMatch) {
		const [, day, month, year] = dayFirstMatch;
		const timestamp = Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
		);
		return Number.isFinite(timestamp) ? timestamp : undefined;
	}

	const timestamp = Date.parse(trimmed);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const formatDate = (value?: string) => {
	const timestamp = parseDateValue(value);

	return timestamp !== undefined
		? new Intl.DateTimeFormat("es-ES", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			}).format(new Date(timestamp))
		: undefined;
};

const toIsoDate = (value?: string) => {
	const timestamp = parseDateValue(value);
	return timestamp !== undefined ? new Date(timestamp).toISOString() : undefined;
};

const isMadridProvince = (value?: string) =>
	normalizeSearchText(value)?.includes("madrid") ?? false;

const isValencianaProvince = (value?: string) => {
	const normalized = normalizeSearchText(value);

	return normalized
		? [
				"alicante",
				"alacant",
				"castellon",
				"castello",
				"valencia",
			].some((province) => normalized.includes(province))
		: false;
};

const isCatalunyaProvince = (value?: string) => {
	const normalized = normalizeSearchText(value);

	return normalized
		? ["barcelona", "girona", "gerona", "lleida", "lerida", "tarragona"].some(
				(province) => normalized.includes(province),
			)
		: false;
};

const getRecordValueByName = (
	record: Record<string, unknown>,
	pattern: RegExp,
) => {
	for (const [key, value] of Object.entries(record)) {
		if (pattern.test(key)) {
			return safeString(value);
		}
	}

	return undefined;
};

const findMatchingRecord = (
	records: Record<string, unknown>[],
	cadastralReference: string,
) => {
	const normalizedReference = normalizeSearchText(cadastralReference);

	return records.find((record) =>
		Object.values(record).some(
			(value) => normalizeSearchText(safeString(value)) === normalizedReference,
		),
	);
};

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

const escapeXml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

const buildValencianaEqualsFilter = (fieldName: string, value: string) =>
	[
		'<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">',
		"<fes:PropertyIsEqualTo>",
		`<fes:ValueReference>${escapeXml(fieldName)}</fes:ValueReference>`,
		`<fes:Literal>${escapeXml(value)}</fes:Literal>`,
		"</fes:PropertyIsEqualTo>",
		"</fes:Filter>",
	].join("");

const escapeSoqlString = (value: string) => value.replace(/'/g, "''");

const buildMadridEnergyEvidence = (
	record: Record<string, unknown>,
): LocalizaOnlineEvidenceItem[] => {
	const rating =
		getRecordValueByName(record, /calificaci[oó]n.*energ|letra.*energ/i) ??
		getRecordValueByName(record, /^calificaci[oó]n$/i);
	const emissions =
		getRecordValueByName(record, /emisiones|co2/i) ??
		getRecordValueByName(record, /calificaci[oó]n.*emision/i);
	const consumption =
		getRecordValueByName(record, /consumo/i) ??
		getRecordValueByName(record, /calificaci[oó]n.*energia/i);
	const registeredAt =
		getRecordValueByName(record, /fecha.*registro|fec.*registro/i) ??
		getRecordValueByName(record, /fecha.*alta|fec.*alta/i);
	const certificateReference =
		getRecordValueByName(record, /referencia.*cert|expediente|n.? registro/i) ??
		getRecordValueByName(record, /^id$/i);
	const observedAt = toIsoDate(registeredAt);
	const evidence = [
		{
			label: "Certificado energético",
			value: rating ? `Calificación ${rating}` : undefined,
		},
		{
			label: "Emisiones energéticas",
			value: emissions,
		},
		{
			label: "Consumo energético",
			value: consumption,
		},
		{
			label: "Fecha del certificado",
			value: formatDate(registeredAt),
		},
		{
			label: "Referencia del certificado",
			value: certificateReference,
		},
	];

	return evidence
		.filter(
			(item): item is { label: string; value: string } => Boolean(item.value),
		)
		.map((item) => ({
			...item,
			sourceLabel: "Registro CEEE Comunidad de Madrid",
			sourceUrl: MADRID_CEEE_SOURCE_URL,
			observedAt,
			kind: "energy_certificate",
		}));
};

type ValencianaEnergyFeature = {
	properties?: Record<string, unknown>;
};

const formatDecimal = (value?: string) => value?.replace(".", ",");

const formatMetricValue = (value?: string, unit?: string) => {
	const formatted = formatDecimal(value);
	return formatted ? [formatted, unit].filter(Boolean).join(" ") : undefined;
};

const getValencianaCertificateCount = (record: Record<string, unknown>) => {
	const rawCount = safeString(record.n_certificados);
	const parsedCount = Number(rawCount);

	return Number.isFinite(parsedCount) && parsedCount > 0
		? parsedCount
		: undefined;
};

const buildValencianaEnergyEvidence = (
	record: Record<string, unknown>,
	matchMode: "unit" | "parcel",
): LocalizaOnlineEvidenceItem[] => {
	const consumptionRating = safeString(record.cer_concalificacion);
	const emissionsRating = safeString(record.cer_emicalificacion);
	const consumptionTotal = formatDecimal(safeString(record.cer_contotal));
	const emissionsTotal = formatDecimal(safeString(record.cer_emitotal));
	const validUntil = safeString(record.validohasta);
	const certificateReference =
		safeString(record.codigo) ??
		safeString(record.idcertificado) ??
		safeString(record.cer_idexpediente);
	const certificateCount = getValencianaCertificateCount(record);
	const sourceUrl = safeString(record.url_castellano);
	const effectiveSourceUrl = isBrowserUrl(sourceUrl) ? sourceUrl : undefined;

	if (matchMode === "parcel" && certificateCount !== 1) {
		return [
			{
				label: "Certificados energéticos en parcela",
				value: certificateCount
					? `${certificateCount} registros`
					: "Registro localizado",
				sourceLabel: "Registro CEEE Comunitat Valenciana",
				sourceUrl: undefined,
				kind: "energy_certificate",
			},
		];
	}

	const energySummary = [
		consumptionRating ? `Consumo ${consumptionRating}` : undefined,
		emissionsRating ? `Emisiones ${emissionsRating}` : undefined,
	].filter(Boolean);
	const evidence = [
		{
			label: "Certificado energético",
			value: energySummary.join(" · ") || undefined,
		},
		{
			label: "Consumo energético registrado",
			value: consumptionTotal,
		},
		{
			label: "Emisiones energéticas registradas",
			value: emissionsTotal,
		},
		{
			label: "Válido hasta",
			value: formatDate(validUntil),
		},
		{
			label: "Referencia del certificado",
			value: certificateReference,
		},
		{
			label: "Dirección registrada en CEEE",
			value: safeString(record.exp_direccion),
		},
	];

	return evidence
		.filter(
			(item): item is { label: string; value: string } => Boolean(item.value),
		)
		.map((item) => ({
			...item,
			sourceLabel: "Registro CEEE Comunitat Valenciana",
			sourceUrl: effectiveSourceUrl,
			kind: "energy_certificate",
		}));
};

const getCatalunyaCertificateCount = async (input: {
	reference: string;
	signal: AbortSignal;
}) => {
	const url = new URL(CATALUNYA_CEEE_API_URL);
	url.searchParams.set("$select", "count(*) AS count");
	url.searchParams.set(
		"$where",
		`starts_with(referencia_cadastral,'${escapeSoqlString(input.reference)}')`,
	);

	const response = await fetch(url, {
		method: "GET",
		signal: input.signal,
	});

	if (!response.ok) {
		return undefined;
	}

	const [row] = (await response.json()) as Array<{ count?: string }>;
	const parsedCount = Number(row?.count);

	return Number.isFinite(parsedCount) && parsedCount >= 0
		? parsedCount
		: undefined;
};

const fetchCatalunyaRecords = async (input: {
	where: string;
	limit: number;
	signal: AbortSignal;
}) => {
	const url = new URL(CATALUNYA_CEEE_API_URL);
	url.searchParams.set("$limit", String(input.limit));
	url.searchParams.set("$where", input.where);
	url.searchParams.set("$order", "data_entrada DESC");

	const response = await fetch(url, {
		method: "GET",
		signal: input.signal,
	});

	if (!response.ok) {
		return [];
	}

	return (await response.json()) as Record<string, unknown>[];
};

const buildCatalunyaParcelCountEvidence = (
	certificateCount?: number,
): LocalizaOnlineEvidenceItem[] =>
	certificateCount && certificateCount > 0
		? [
				{
					label: "Certificados energéticos en parcela",
					value:
						certificateCount === 1
							? "1 registro"
							: `${certificateCount} registros`,
					sourceLabel: "Registro CEEE Catalunya / ICAEN",
					kind: "energy_certificate",
				},
			]
		: [];

const buildCatalunyaEnergyEvidence = (
	record: Record<string, unknown>,
): LocalizaOnlineEvidenceItem[] => {
	const consumptionRating = safeString(record.qualificaci_de_consum_d);
	const emissionsRating = safeString(record.qualificacio_d_emissions);
	const energySummary = [
		consumptionRating ? `Consumo ${consumptionRating}` : undefined,
		emissionsRating ? `Emisiones ${emissionsRating}` : undefined,
	].filter(Boolean);
	const address = [
		safeString(record.adre_a),
		safeString(record.numero),
		safeString(record.codi_postal),
		safeString(record.poblacio),
	].filter(Boolean);
	const evidence = [
		{
			label: "Certificado energético",
			value: energySummary.join(" · ") || undefined,
		},
		{
			label: "Energía primaria no renovable",
			value: formatMetricValue(
				safeString(record.energia_prim_ria_no_renovable),
				"kWh/m² año",
			),
		},
		{
			label: "Emisiones de CO2",
			value: formatMetricValue(
				safeString(record.emissions_de_co2),
				"kg CO2/m² año",
			),
		},
		{
			label: "Consumo de energía final",
			value: formatMetricValue(
				safeString(record.consum_d_energia_final),
				"kWh/m² año",
			),
		},
		{
			label: "Fecha de inscripción CEEE",
			value: formatDate(safeString(record.data_entrada)),
		},
		{
			label: "Referencia del certificado",
			value: safeString(record.num_cas),
		},
		{
			label: "Uso registrado",
			value: safeString(record.us_edifici),
		},
		{
			label: "Motivo del certificado",
			value: safeString(record.motiu_de_la_certificacio),
		},
		{
			label: "Dirección registrada en CEEE",
			value: address.join(" · ") || undefined,
		},
	];
	const observedAt = toIsoDate(safeString(record.data_entrada));

	return evidence
		.filter(
			(item): item is { label: string; value: string } => Boolean(item.value),
		)
		.map((item) => ({
			...item,
			sourceLabel: "Registro CEEE Catalunya / ICAEN",
			observedAt,
			kind: "energy_certificate",
		}));
};

const fetchMadridEnergyEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const identity = dossier.officialIdentity;
	const cadastralReference = identity.unitRef20 ?? identity.parcelRef14;

	if (!cadastralReference || !isMadridProvince(identity.province)) {
		return [];
	}

	const url = new URL(MADRID_CEEE_DATASTORE_URL);
	url.searchParams.set("resource_id", MADRID_CEEE_RESOURCE_ID);
	url.searchParams.set("q", cadastralReference);
	url.searchParams.set("limit", "5");

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		ENERGY_CERTIFICATE_TIMEOUT_MS,
	);

	try {
		const response = await fetch(url, {
			method: "GET",
			signal: abortController.signal,
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as {
			result?: { records?: Record<string, unknown>[] };
		};
		const matchingRecord = findMatchingRecord(
			payload.result?.records ?? [],
			cadastralReference,
		);

		return matchingRecord ? buildMadridEnergyEvidence(matchingRecord) : [];
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};

const fetchValencianaEnergyEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const identity = dossier.officialIdentity;

	if (!isValencianaProvince(identity.province)) {
		return [];
	}

	const reference = identity.unitRef20 ?? identity.parcelRef14;

	if (!reference) {
		return [];
	}

	const matchMode = identity.unitRef20 ? "unit" : "parcel";
	const fieldName = matchMode === "unit" ? "ref_referencia" : "ref_parcela";
	const url = new URL(VALENCIANA_CEEE_WFS_URL);
	url.searchParams.set("service", "WFS");
	url.searchParams.set("version", "2.0.0");
	url.searchParams.set("request", "GetFeature");
	url.searchParams.set("typeNames", "ms:CEEEdificios");
	url.searchParams.set("count", matchMode === "unit" ? "3" : "8");
	url.searchParams.set("outputFormat", "application/json; subtype=geojson");
	url.searchParams.set("FILTER", buildValencianaEqualsFilter(fieldName, reference));

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		ENERGY_CERTIFICATE_TIMEOUT_MS,
	);

	try {
		const response = await fetch(url, {
			method: "GET",
			signal: abortController.signal,
		});

		if (!response.ok) {
			return [];
		}

		const payload = (await response.json()) as {
			features?: ValencianaEnergyFeature[];
		};
		const normalizedReference = normalizeSearchText(reference);
		const matchingFeature = (payload.features ?? []).find((feature) => {
			const properties = feature.properties;
			return (
				properties &&
				normalizeSearchText(safeString(properties[fieldName])) ===
					normalizedReference
			);
		});

		return matchingFeature?.properties
			? buildValencianaEnergyEvidence(matchingFeature.properties, matchMode)
			: [];
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};

const fetchCatalunyaEnergyEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const identity = dossier.officialIdentity;

	if (!isCatalunyaProvince(identity.province)) {
		return [];
	}

	const reference = identity.unitRef20 ?? identity.parcelRef14;

	if (!reference) {
		return [];
	}

	const abortController = new AbortController();
	const timeoutId = setTimeout(
		() => abortController.abort(),
		ENERGY_CERTIFICATE_TIMEOUT_MS,
	);

	try {
		if (identity.unitRef20) {
			const normalizedReference = normalizeSearchText(identity.unitRef20);
			const records = await fetchCatalunyaRecords({
				where: `referencia_cadastral='${escapeSoqlString(identity.unitRef20)}'`,
				limit: 3,
				signal: abortController.signal,
			});
			const matchingRecord = records.find(
				(record) =>
					normalizeSearchText(safeString(record.referencia_cadastral)) ===
					normalizedReference,
			);

			return matchingRecord ? buildCatalunyaEnergyEvidence(matchingRecord) : [];
		}

		const certificateCount = await getCatalunyaCertificateCount({
			reference,
			signal: abortController.signal,
		});

		if (certificateCount !== 1) {
			return buildCatalunyaParcelCountEvidence(certificateCount);
		}

		const records = await fetchCatalunyaRecords({
			where: `starts_with(referencia_cadastral,'${escapeSoqlString(reference)}')`,
			limit: 1,
			signal: abortController.signal,
		});

		return records[0] ? buildCatalunyaEnergyEvidence(records[0]) : [];
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
};

export const fetchEnergyCertificateEvidence = async (
	dossier: LocalizaPropertyDossier,
): Promise<LocalizaOnlineEvidenceItem[]> => {
	const [madridEvidence, valencianaEvidence, catalunyaEvidence] =
		await Promise.all([
			fetchMadridEnergyEvidence(dossier),
			fetchValencianaEnergyEvidence(dossier),
			fetchCatalunyaEnergyEvidence(dossier),
		]);

	return [...madridEvidence, ...valencianaEvidence, ...catalunyaEvidence];
};
