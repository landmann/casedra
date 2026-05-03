import type {
	LocalizaPropertyDossier,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import { Button, cn } from "@casedra/ui";
import type { LucideIcon } from "lucide-react";
import {
	ArrowLeft,
	Building2,
	Download,
	Euro,
	ExternalLink,
	FileSearch,
	ImageIcon,
	MapPinned,
	ShieldCheck,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";

type LocalizaPropertyReportProps = {
	dossier: LocalizaPropertyDossier;
	result?: ResolveIdealistaLocationResult;
	backHref?: string;
	showNavigation?: boolean;
	className?: string;
};

type MarketEvidenceLink = {
	title: string;
	href: string;
	Icon: LucideIcon;
};

type NegotiationSnapshot = {
	currentAsk?: number;
	pricePerM2?: number;
	previousAsk?: number;
	priceDelta?: number;
	priceDeltaPercent?: number;
};

type ValuationRead = {
	observationCount: number;
	lowestAsk?: number;
	highestAsk?: number;
	publicSpread?: number;
	publicSpreadPercent?: number;
	stance: string;
	detail: string;
};

type PublicAdvertiserRead = {
	label: string;
	sourceLabel: string;
	sourceUrl?: string;
	isIdentified: boolean;
};

type ProspectingRead = {
	score: number;
	stance: string;
	detail: string;
	publicAdvertiser: PublicAdvertiserRead;
	reasons: string[];
	pitch: string;
	crmNote: string;
	complianceNote: string;
};

type OnlineEvidenceItem = NonNullable<
	LocalizaPropertyDossier["onlineEvidence"]
>[number];

type OnlineEvidenceKind = OnlineEvidenceItem["kind"];

type EvidenceUseCase = {
	key: string;
	title: string;
	label: string;
	action: string;
	Icon: LucideIcon;
	kinds: OnlineEvidenceKind[];
};

const ONLINE_EVIDENCE_USE_CASES: EvidenceUseCase[] = [
	{
		key: "price",
		title: "Negociar precio",
		label: "Archivo y mercado",
		action: "Defender margen o reposicionar.",
		Icon: TrendingUp,
		kinds: ["listing_archive", "market_benchmark"],
	},
	{
		key: "facts",
		title: "Completar ficha",
		label: "Edificio",
		action: "Pasar datos defendibles a la ficha.",
		Icon: Building2,
		kinds: ["building_cadastre", "official_cadastre", "licensed_feed"],
	},
	{
		key: "appeal",
		title: "Vender entorno",
		label: "Zona y potencial",
		action: "Convertir zona y potencial en copy.",
		Icon: Sparkles,
		kinds: ["local_amenity", "solar_potential"],
	},
	{
		key: "objections",
		title: "Resolver objeciones",
		label: "Riesgo, energía y urbanismo",
		action: "Preparar respuestas para comprador o tasador.",
		Icon: ShieldCheck,
		kinds: [
			"risk_overlay",
			"energy_certificate",
			"building_condition",
			"planning_heritage",
		],
	},
];

const formatDate = (value?: string) => {
	if (!value) {
		return "Fecha no disponible";
	}

	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
};

const formatEuro = (value?: number) =>
	value === undefined
		? "Precio no disponible"
		: `${new Intl.NumberFormat("es-ES", {
				maximumFractionDigits: 0,
			}).format(value)} €`;

const formatSignedEuro = (value?: number) => {
	if (value === undefined) {
		return "Pendiente";
	}

	const formatted = formatEuro(Math.abs(value));
	return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
};

const formatPercent = (value?: number) =>
	value === undefined
		? "Pendiente"
		: `${value > 0 ? "+" : ""}${new Intl.NumberFormat("es-ES", {
				maximumFractionDigits: 1,
			}).format(value)}%`;

const formatEuroPerM2 = (value?: number) =>
	value === undefined
		? "Pendiente"
		: `${new Intl.NumberFormat("es-ES", {
				maximumFractionDigits: 0,
			}).format(value)} €/m²`;

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const getCadastralReference = (dossier: LocalizaPropertyDossier) =>
	dossier.officialIdentity.unitRef20 ?? dossier.officialIdentity.parcelRef14;

const isBrowserUrl = (value?: string): value is string => {
	if (!value) {
		return false;
	}

	try {
		const parsed = new URL(value);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
};

const getBrowserUrl = (value?: string) =>
	isBrowserUrl(value) ? value : undefined;

const getConfirmedOfficialCandidate = (
	result?: ResolveIdealistaLocationResult,
) => {
	if (
		!result ||
		(result.status !== "exact_match" && result.status !== "building_match")
	) {
		return undefined;
	}

	return (
		result.candidates.find(
			(candidate) =>
				Boolean(result.unitRef20) && candidate.unitRef20 === result.unitRef20,
		) ??
		result.candidates.find(
			(candidate) =>
				Boolean(result.parcelRef14) &&
				candidate.parcelRef14 === result.parcelRef14,
		) ??
		(result.candidates.length === 1 ? result.candidates[0] : undefined)
	);
};

const buildMarketEvidenceLinks = (input: {
	dossier: LocalizaPropertyDossier;
	result?: ResolveIdealistaLocationResult;
}): MarketEvidenceLink[] => {
	const confirmedCandidate = getConfirmedOfficialCandidate(input.result);
	const officialUrl = confirmedCandidate?.officialUrl;

	if (!isBrowserUrl(officialUrl)) {
		return [];
	}

	return [
		{
			title: "Ficha oficial",
			href: officialUrl,
			Icon: MapPinned,
		},
	];
};

const buildReportDownloadHref = (
	dossier: LocalizaPropertyDossier,
	result?: ResolveIdealistaLocationResult,
) => {
	const identity = dossier.officialIdentity;
	const snapshot = dossier.listingSnapshot;
	const sortedHistory = sortHistory(dossier.publicHistory);
	const negotiation = buildNegotiationSnapshot(dossier, sortedHistory);
	const valuationRead = buildValuationRead(negotiation, sortedHistory);
	const prospectingRead = buildProspectingRead(
		dossier,
		sortedHistory,
		negotiation,
		valuationRead,
		dossier.onlineEvidence ?? [],
	);
	const historyRows = dossier.publicHistory
		.map(
			(row) =>
				`<li>${escapeHtml(formatDate(row.observedAt))} - ${escapeHtml(
					formatEuro(row.askingPrice),
				)} - ${escapeHtml(row.portal)}${
					row.agencyName ? ` - ${escapeHtml(row.agencyName)}` : ""
				}</li>`,
		)
		.join("");
	const evidenceRows = buildMarketEvidenceLinks({ dossier, result })
		.map(
			(link) =>
				`<li><a href="${escapeHtml(link.href)}">${escapeHtml(
					link.title,
				)}</a></li>`,
		)
		.join("");
	const onlineEvidenceRows = (dossier.onlineEvidence ?? [])
		.map(
			(item) =>
				`<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(
					item.value,
				)} <small>${escapeHtml(item.sourceLabel)}</small></li>`,
		)
		.join("");
	const multiPortalRows = getMultiPortalRecords(dossier)
		.map((record) => {
			const sourceUrl = getBrowserUrl(record.sourceUrl);
			return `<li><strong>${escapeHtml(formatPortalLabel(record.portal))}:</strong> ${escapeHtml(
				formatEuro(record.askingPrice),
			)} - ${escapeHtml(getDuplicateRecordPartyLabel(record))} - ${escapeHtml(
				formatDuplicateRecordWindow(record),
			)}${
				sourceUrl
					? ` - <a href="${escapeHtml(sourceUrl)}">${escapeHtml(
							formatSourceHost(sourceUrl) ?? "Fuente",
						)}</a>`
					: ""
			}</li>`;
		})
		.join("");
	const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe Localiza</title><body style="font-family:Arial,sans-serif;color:#1F1A14;background:#FFFBF2;padding:32px"><h1>${escapeHtml(
		snapshot.title ?? "Informe de propiedad",
	)}</h1><p><strong>${escapeHtml(formatEuro(snapshot.askingPrice))}</strong></p><p>Dirección propuesta: ${escapeHtml(
		identity.proposedAddressLabel ?? "No disponible",
	)}</p><p>Referencia catastral: ${escapeHtml(
		identity.unitRef20 ?? identity.parcelRef14 ?? "No disponible",
	)}</p><p>Fuente: ${escapeHtml(identity.officialSource)}</p><h2>Resumen del inmueble</h2><ul><li>Precio actual: ${escapeHtml(
		formatEuro(negotiation.currentAsk),
	)}</li><li>Precio por metro: ${escapeHtml(
		formatEuroPerM2(negotiation.pricePerM2),
	)}</li><li>Movimiento público: ${escapeHtml(
		negotiation.priceDelta !== undefined
			? `${formatSignedEuro(negotiation.priceDelta)} (${formatPercent(
					negotiation.priceDeltaPercent,
				)}) desde ${formatEuro(negotiation.previousAsk)}`
			: "Sin bajada pública verificable",
	)}</li><li>Lectura de valoración: ${escapeHtml(
		`${valuationRead.stance}. ${valuationRead.detail}`,
	)}</li></ul><h2>Captura comercial</h2><ul><li>Puntuación: ${escapeHtml(
		`${prospectingRead.score}/100 - ${prospectingRead.stance}`,
	)}</li><li>Anunciante público: ${escapeHtml(
		prospectingRead.publicAdvertiser.label,
	)} (${escapeHtml(
		prospectingRead.publicAdvertiser.sourceLabel,
	)})</li><li>Ángulo de contacto: ${escapeHtml(
		prospectingRead.pitch,
	)}</li><li>Nota CRM: ${escapeHtml(
		prospectingRead.crmNote,
	)}</li><li>Titular y teléfono: ${escapeHtml(
		prospectingRead.complianceNote,
	)}</li></ul>${
		onlineEvidenceRows
			? `<h2>Información online adicional</h2><ul>${onlineEvidenceRows}</ul>`
			: ""
	}${
		multiPortalRows
			? `<h2>Presencia multiportal</h2><ul>${multiPortalRows}</ul>`
			: ""
	}<h2>Histórico público</h2><ul>${historyRows}</ul>${
		evidenceRows ? `<h2>Fuentes externas</h2><ul>${evidenceRows}</ul>` : ""
	}</body></html>`;

	return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

const buildDownloadName = (dossier: LocalizaPropertyDossier) => {
	const source = dossier.listingSnapshot.sourceUrl
		.replace(/^https?:\/\/(www\.)?/i, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/(^-|-$)/g, "")
		.slice(0, 48);

	return `informe-localiza-${source || "propiedad"}.html`;
};

const getPropertyOverviewRows = (
	dossier: LocalizaPropertyDossier,
	negotiation: NegotiationSnapshot,
	publicMovementLabel: string,
) => {
	const snapshot = dossier.listingSnapshot;
	const rows = [
		{ label: "Precio actual", value: formatEuro(negotiation.currentAsk) },
		{ label: "Precio por m²", value: formatEuroPerM2(negotiation.pricePerM2) },
		{ label: "Movimiento", value: publicMovementLabel },
		{
			label: "Superficie",
			value: snapshot.areaM2 ? `${snapshot.areaM2} m²` : undefined,
		},
		{
			label: "Dormitorios",
			value:
				snapshot.bedrooms !== undefined
					? `${snapshot.bedrooms} hab.`
					: undefined,
		},
		{
			label: "Baños",
			value:
				snapshot.bathrooms !== undefined
					? `${snapshot.bathrooms} baños`
					: undefined,
		},
		{ label: "Planta", value: snapshot.floorText },
		{ label: "Luz", value: snapshot.isExterior ? "Exterior" : undefined },
		{ label: "Ascensor", value: snapshot.hasElevator ? "Sí" : undefined },
		{
			label: "Garaje",
			value: snapshot.priceIncludesParking ? "Incluido" : undefined,
		},
		{
			label: "Portal",
			value:
				snapshot.sourcePortal === "idealista"
					? "Idealista"
					: snapshot.sourcePortal,
		},
	];

	return rows.filter((row): row is { label: string; value: string } =>
		Boolean(row.value),
	);
};

const getOnlineEvidenceKindLabel = (kind: OnlineEvidenceKind) => {
	const labels: Record<OnlineEvidenceKind, string> = {
		building_cadastre: "Edificio",
		building_condition: "Estado",
		energy_certificate: "Energía",
		licensed_feed: "Feed",
		local_amenity: "Entorno",
		listing_archive: "Archivo",
		market_benchmark: "Mercado",
		official_cadastre: "Oficial",
		planning_heritage: "Urbanismo",
		risk_overlay: "Riesgo",
		solar_potential: "Solar",
	};

	return labels[kind];
};

const getOnlineEvidenceGroups = (items: OnlineEvidenceItem[]) =>
	ONLINE_EVIDENCE_USE_CASES.map((useCase) => ({
		...useCase,
		items: items.filter((item) => useCase.kinds.includes(item.kind)),
	})).filter((group) => group.items.length > 0);

const shouldShowOnlineEvidenceItem = (item: OnlineEvidenceItem) =>
	![
		"Publicado desde",
		"Última captura",
		"Precio archivado",
		"Precio por m²",
		"Características archivadas",
	].includes(item.label);

const getEvidenceSourceLine = (item: OnlineEvidenceItem) =>
	item.observedAt
		? `${item.sourceLabel} · ${formatDate(item.observedAt)}`
		: item.sourceLabel;

const getHistoryPartyLabel = (
	row: LocalizaPropertyDossier["publicHistory"][number],
) => row.agencyName ?? row.advertiserName ?? "Anuncio público";

const formatSourceHost = (sourceUrl?: string) => {
	if (!sourceUrl) {
		return undefined;
	}

	try {
		return new URL(sourceUrl).hostname.replace(/^www\./i, "");
	} catch {
		return sourceUrl.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/.*$/, "");
	}
};

const getDuplicateAddressEvidence = (dossier: LocalizaPropertyDossier) =>
	dossier.onlineEvidence?.find(
		(item) => item.label === "Dirección exacta en duplicado público",
	);

const buildAddressRationale = (
	dossier: LocalizaPropertyDossier,
	result?: ResolveIdealistaLocationResult,
) => {
	if (
		!result ||
		(result.status !== "exact_match" && result.status !== "building_match")
	) {
		return undefined;
	}

	const duplicateEvidence = getDuplicateAddressEvidence(dossier);

	if (duplicateEvidence) {
		const sourceHost = formatSourceHost(duplicateEvidence.sourceUrl);
		return `El anuncio ocultaba el número. Localiza encontró un duplicado público${sourceHost ? ` en ${sourceHost}` : ""} con la misma calle y características, extrajo ese número y después lo contrastó con Catastro.`;
	}

	if (result.evidence.matchedSignals.includes("designator_match")) {
		return "La dirección no sale solo del mapa del portal: coincide la calle, el número publicado y la fuente oficial.";
	}

	return "La fuente oficial confirma el edificio; si falta puerta o unidad, debe completarse manualmente.";
};

const PORTAL_LABEL_ALIASES: Record<string, string> = {
	"FOTOCASA.ES": "FOTOCASA",
	"WWW.FOTOCASA.ES": "FOTOCASA",
	"HABITACLIA.COM": "HABITACLIA",
	"WWW.HABITACLIA.COM": "HABITACLIA",
	"IDEALISTA.COM": "IDEALISTA",
	"WWW.IDEALISTA.COM": "IDEALISTA",
};

const formatPortalLabel = (portal: string) => {
	const normalized = portal
		.trim()
		.toUpperCase()
		.replace(/^HTTPS?:\/\//, "")
		.replace(/\/.*$/, "");

	return PORTAL_LABEL_ALIASES[normalized] ?? normalized;
};

const getDuplicateRecordPartyLabel = (
	record: LocalizaPropertyDossier["duplicateGroup"]["records"][number],
) => record.agencyName ?? record.advertiserName ?? "Anuncio público";

const getDuplicateRecordTimestamp = (
	record: LocalizaPropertyDossier["duplicateGroup"]["records"][number],
) => record.lastSeenAt ?? record.firstSeenAt;

const formatDuplicateRecordWindow = (
	record: LocalizaPropertyDossier["duplicateGroup"]["records"][number],
) => {
	if (record.firstSeenAt && record.lastSeenAt) {
		const firstSeen = formatDate(record.firstSeenAt);
		const lastSeen = formatDate(record.lastSeenAt);
		return firstSeen === lastSeen ? lastSeen : `${firstSeen} - ${lastSeen}`;
	}

	return formatDate(getDuplicateRecordTimestamp(record));
};

const getMultiPortalRecords = (dossier: LocalizaPropertyDossier) =>
	[...dossier.duplicateGroup.records]
		.filter((record) => formatPortalLabel(record.portal) !== "IDEALISTA")
		.sort(
			(left, right) =>
				new Date(getDuplicateRecordTimestamp(right) ?? 0).getTime() -
				new Date(getDuplicateRecordTimestamp(left) ?? 0).getTime(),
		)
		.slice(0, 8);

const sortHistory = (history: LocalizaPropertyDossier["publicHistory"]) =>
	[...history].sort(
		(left, right) =>
			new Date(right.observedAt).getTime() -
			new Date(left.observedAt).getTime(),
	);

const buildNegotiationSnapshot = (
	dossier: LocalizaPropertyDossier,
	history: LocalizaPropertyDossier["publicHistory"],
): NegotiationSnapshot => {
	const snapshot = dossier.listingSnapshot;
	const currentAsk =
		snapshot.askingPrice ??
		history.find((row) => row.askingPrice !== undefined)?.askingPrice;
	const pricePerM2 =
		currentAsk !== undefined && snapshot.areaM2
			? Math.round(currentAsk / snapshot.areaM2)
			: undefined;
	const previousAsk = history.find(
		(row) =>
			row.askingPrice !== undefined &&
			currentAsk !== undefined &&
			row.askingPrice !== currentAsk,
	)?.askingPrice;
	const priceDelta =
		currentAsk !== undefined && previousAsk !== undefined
			? currentAsk - previousAsk
			: undefined;
	const priceDeltaPercent =
		priceDelta !== undefined && previousAsk
			? (priceDelta / previousAsk) * 100
			: undefined;
	return {
		currentAsk,
		pricePerM2,
		previousAsk,
		priceDelta,
		priceDeltaPercent,
	};
};

const buildValuationRead = (
	negotiation: NegotiationSnapshot,
	history: LocalizaPropertyDossier["publicHistory"],
): ValuationRead => {
	const prices = history
		.map((row) => row.askingPrice)
		.filter((price): price is number => price !== undefined);
	const lowestAsk = prices.length > 0 ? Math.min(...prices) : undefined;
	const highestAsk = prices.length > 0 ? Math.max(...prices) : undefined;
	const publicSpread =
		lowestAsk !== undefined && highestAsk !== undefined
			? highestAsk - lowestAsk
			: undefined;
	const publicSpreadPercent =
		publicSpread !== undefined && lowestAsk
			? (publicSpread / lowestAsk) * 100
			: undefined;

	if (
		negotiation.priceDelta !== undefined &&
		negotiation.priceDelta < 0 &&
		Math.abs(negotiation.priceDeltaPercent ?? 0) >= 3
	) {
		return {
			observationCount: prices.length,
			lowestAsk,
			highestAsk,
			publicSpread,
			publicSpreadPercent,
			stance: "Precio en ajuste",
			detail:
				"Hay una rebaja pública suficiente para negociar desde evidencia, no desde intuición.",
		};
	}

	if (
		publicSpreadPercent !== undefined &&
		publicSpreadPercent >= 8 &&
		prices.length >= 3
	) {
		return {
			observationCount: prices.length,
			lowestAsk,
			highestAsk,
			publicSpread,
			publicSpreadPercent,
			stance: "Histórico volátil",
			detail:
				"El rango observado es amplio. Conviene revisar comparables antes de fijar precio final.",
		};
	}

	if (
		negotiation.currentAsk !== undefined &&
		negotiation.pricePerM2 !== undefined
	) {
		return {
			observationCount: prices.length,
			lowestAsk,
			highestAsk,
			publicSpread,
			publicSpreadPercent,
			stance: "Base defendible",
			detail:
				"Hay precio y superficie suficientes para preparar una valoración comparativa.",
		};
	}

	return {
		observationCount: prices.length,
		lowestAsk,
		highestAsk,
		publicSpread,
		publicSpreadPercent,
		stance: "Valoración pendiente",
		detail:
			"Faltan precio, superficie o historial para emitir una lectura comercial útil.",
	};
};

const getPublicAdvertiserRead = (
	dossier: LocalizaPropertyDossier,
	history: LocalizaPropertyDossier["publicHistory"],
): PublicAdvertiserRead => {
	const historyRow = history.find(
		(row) => row.agencyName ?? row.advertiserName,
	);
	if (historyRow) {
		return {
			label: getHistoryPartyLabel(historyRow),
			sourceLabel: historyRow.portal,
			sourceUrl: historyRow.sourceUrl ?? dossier.listingSnapshot.sourceUrl,
			isIdentified: true,
		};
	}

	const duplicateRecord = dossier.duplicateGroup.records.find(
		(row) => row.agencyName ?? row.advertiserName,
	);
	if (duplicateRecord) {
		return {
			label:
				duplicateRecord.agencyName ??
				duplicateRecord.advertiserName ??
				"Anunciante público",
			sourceLabel: duplicateRecord.portal,
			sourceUrl: duplicateRecord.sourceUrl ?? dossier.listingSnapshot.sourceUrl,
			isIdentified: true,
		};
	}

	return {
		label: "Anunciante público no identificado",
		sourceLabel:
			dossier.listingSnapshot.sourcePortal === "idealista"
				? "Idealista"
				: dossier.listingSnapshot.sourcePortal,
		sourceUrl: dossier.listingSnapshot.sourceUrl,
		isIdentified: false,
	};
};

const hasOnlineEvidenceKind = (
	items: OnlineEvidenceItem[],
	kinds: OnlineEvidenceKind[],
) => items.some((item) => kinds.includes(item.kind));

const clampScore = (value: number) => Math.min(92, Math.max(24, value));

const buildProspectingRead = (
	dossier: LocalizaPropertyDossier,
	history: LocalizaPropertyDossier["publicHistory"],
	negotiation: NegotiationSnapshot,
	valuationRead: ValuationRead,
	onlineEvidence: OnlineEvidenceItem[],
): ProspectingRead => {
	const snapshot = dossier.listingSnapshot;
	const identity = dossier.officialIdentity;
	const publicAdvertiser = getPublicAdvertiserRead(dossier, history);
	const hasOfficialIdentity = Boolean(
		identity.proposedAddressLabel && getCadastralReference(dossier),
	);
	const hasPresentationGap =
		!snapshot.leadImageUrl && dossier.imageGallery.length === 0;
	const reasons: string[] = [];
	let score = 38;

	if (publicAdvertiser.isIdentified) {
		score += 14;
		reasons.push(`Anunciante público visible: ${publicAdvertiser.label}.`);
	} else {
		reasons.push("Contacto público limitado al canal del portal.");
	}

	if (hasOfficialIdentity) {
		score += 16;
		reasons.push("Dirección oficial y referencia catastral defendibles.");
	}

	if (
		negotiation.priceDelta !== undefined &&
		negotiation.priceDelta < 0 &&
		Math.abs(negotiation.priceDeltaPercent ?? 0) >= 3
	) {
		score += 14;
		reasons.push(
			`Rebaja pública de ${formatSignedEuro(
				negotiation.priceDelta,
			)} que abre conversación de reposicionamiento.`,
		);
	} else if (valuationRead.observationCount > 1) {
		score += 6;
		reasons.push(
			"Hay histórico suficiente para preguntar por estrategia de precio.",
		);
	}

	if (
		hasOnlineEvidenceKind(onlineEvidence, [
			"listing_archive",
			"market_benchmark",
			"licensed_feed",
		])
	) {
		score += 10;
		reasons.push(
			"Archivo o mercado aportan contexto fuera del anuncio actual.",
		);
	}

	if (
		hasOnlineEvidenceKind(onlineEvidence, [
			"building_cadastre",
			"building_condition",
			"energy_certificate",
			"local_amenity",
			"official_cadastre",
			"planning_heritage",
			"risk_overlay",
			"solar_potential",
		])
	) {
		score += 8;
		reasons.push("Existen datos para resolver objeciones de comprador.");
	}

	if (history.length >= 2) {
		score += 6;
	}

	if (hasPresentationGap) {
		score -= 5;
		reasons.push(
			"La presentación pública parece incompleta o poco verificable.",
		);
	} else {
		score += 4;
		reasons.push(
			"Hay material visual suficiente para abrir una auditoría de ficha.",
		);
	}

	const boundedScore = clampScore(score);
	const stance =
		boundedScore >= 78
			? "Oportunidad prioritaria"
			: boundedScore >= 60
				? "Buen candidato"
				: "Captura prudente";
	const detail =
		boundedScore >= 78
			? "La ficha combina contacto público, identidad oficial y argumentos comerciales accionables."
			: boundedScore >= 60
				? "Hay señales suficientes para iniciar una conversación breve y basada en evidencia."
				: "Conviene contactar solo desde el canal público y pedir permiso antes de ampliar datos.";
	const title =
		snapshot.title ?? identity.proposedAddressLabel ?? "este inmueble";
	const priceFragment = negotiation.currentAsk
		? ` con precio publicado de ${formatEuro(negotiation.currentAsk)}`
		: "";
	const addressFragment = identity.proposedAddressLabel
		? ` en ${identity.proposedAddressLabel}`
		: "";
	const pitch = `He revisado ${title}${priceFragment}${addressFragment}. Localiza ya tiene dirección oficial, lectura de precio y señales públicas para preparar una mejora de captación sin pedirle documentación adicional de entrada.`;
	const crmNote = `Origen: ${
		formatSourceHost(publicAdvertiser.sourceUrl) ?? publicAdvertiser.sourceLabel
	}. Contacto permitido: anunciante o agencia visible en la publicación.`;

	return {
		score: boundedScore,
		stance,
		detail,
		publicAdvertiser,
		reasons: reasons.slice(0, 5),
		pitch,
		crmNote,
		complianceNote:
			"No se infiere titular ni teléfono privado. Añadirlos solo si el propietario los facilita, existe autorización expresa, o un documento oficial habilita ese uso.",
	};
};

const getOfficialFactRows = (dossier: LocalizaPropertyDossier) => {
	const identity = dossier.officialIdentity;
	const streetAddress = [identity.street, identity.number]
		.filter(Boolean)
		.join(" ");
	const rows = [
		{ label: "Referencia", value: getCadastralReference(dossier) },
		{ label: "Calle", value: streetAddress || undefined },
		{ label: "Escalera", value: identity.staircase },
		{ label: "Planta", value: identity.floor },
		{ label: "Puerta", value: identity.door },
		{ label: "Código postal", value: identity.postalCode },
		{ label: "Municipio", value: identity.municipality },
		{ label: "Provincia", value: identity.province },
	];

	return rows.filter((row): row is { label: string; value: string } =>
		Boolean(row.value),
	);
};

export function LocalizaPropertyReport({
	dossier,
	result,
	backHref = "/app/onboarding?step=listings",
	showNavigation = true,
	className,
}: LocalizaPropertyReportProps) {
	const snapshot = dossier.listingSnapshot;
	const identity = dossier.officialIdentity;
	const leadImage = snapshot.leadImageUrl ?? dossier.imageGallery[0]?.imageUrl;
	const history = sortHistory(dossier.publicHistory);
	const reportHref =
		dossier.actions.reportDownloadUrl ??
		buildReportDownloadHref(dossier, result);
	const downloadName = dossier.actions.reportDownloadUrl
		? undefined
		: buildDownloadName(dossier);
	const valuationHref = dossier.actions.valuationUrl ?? "/app/studio";
	const officialFactRows = getOfficialFactRows(dossier);
	const marketEvidenceLinks = buildMarketEvidenceLinks({ dossier, result });
	const hasMarketEvidenceLinks = marketEvidenceLinks.length > 0;
	const negotiationSnapshot = buildNegotiationSnapshot(dossier, history);
	const valuationRead = buildValuationRead(negotiationSnapshot, history);
	const publicMovementLabel =
		negotiationSnapshot.priceDelta !== undefined
			? `${formatSignedEuro(negotiationSnapshot.priceDelta)} · ${formatPercent(
					negotiationSnapshot.priceDeltaPercent,
				)}`
			: "Pendiente";
	const publicMovementDetail =
		negotiationSnapshot.previousAsk !== undefined
			? `Desde ${formatEuro(negotiationSnapshot.previousAsk)} observado públicamente.`
			: "No hay una bajada pública atribuible todavía.";
	const addressRationale = buildAddressRationale(dossier, result);
	const propertyOverviewRows = getPropertyOverviewRows(
		dossier,
		negotiationSnapshot,
		publicMovementLabel,
	);
	const onlineEvidence = dossier.onlineEvidence ?? [];
	const prospectingRead = buildProspectingRead(
		dossier,
		history,
		negotiationSnapshot,
		valuationRead,
		onlineEvidence,
	);
	const publicAdvertiserHref = isBrowserUrl(
		prospectingRead.publicAdvertiser.sourceUrl,
	)
		? prospectingRead.publicAdvertiser.sourceUrl
		: undefined;
	const visibleOnlineEvidence = onlineEvidence.filter(
		shouldShowOnlineEvidenceItem,
	);
	const onlineEvidenceGroups = getOnlineEvidenceGroups(visibleOnlineEvidence);
	const multiPortalRecords = getMultiPortalRecords(dossier);
	const hasMultiPortalEvidence = multiPortalRecords.length > 0;
	const hasObservedValuationHistory = valuationRead.observationCount > 0;

	return (
		<section
			className={cn(
				"localiza-property-report rounded-[1.75rem] bg-[#FFFBF2] p-3 text-[#1F1A14] shadow-[0_28px_90px_rgba(31,26,20,0.1)]",
				className,
			)}
			aria-label="Informe de propiedad Localiza"
		>
			{showNavigation ? (
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
					<Button
						asChild
						variant="ghost"
						className="min-h-10 rounded-full px-3 text-[#6F5E4A] transition-[background-color,color,transform] duration-200 hover:bg-[#FFF8EA] hover:text-[#9C6137] active:scale-[0.96]"
					>
						<Link href={backHref}>
							<ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
							Volver al listado
						</Link>
					</Button>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							asChild
							className="min-h-10 rounded-full bg-[#9C6137] px-4 text-[#FFFBF2] shadow-[0_10px_24px_rgba(156,97,55,0.2)] transition-[background-color,color,box-shadow,transform] duration-200 hover:bg-[#87522D] active:scale-[0.96]"
						>
							<a href={reportHref} download={downloadName}>
								<Download className="mr-2 h-4 w-4" aria-hidden="true" />
								Descargar informe de propiedad
							</a>
						</Button>
						<Button
							asChild
							variant="outline"
							className="min-h-10 rounded-full border-0 bg-[#FFF8EA] px-4 text-[#9C6137] shadow-[0_8px_20px_rgba(31,26,20,0.055)] transition-[background-color,color,box-shadow,transform] duration-200 hover:bg-[#FFFBF2] hover:text-[#87522D] hover:shadow-[0_12px_26px_rgba(31,26,20,0.075)] active:scale-[0.96]"
						>
							<Link href={valuationHref}>
								<Euro className="mr-2 h-4 w-4" aria-hidden="true" />
								Valoraciones
							</Link>
						</Button>
					</div>
				</div>
			) : null}

			<div className="grid items-center gap-4 rounded-[1.35rem] bg-[#FFF8EA] p-3 shadow-[0_14px_42px_rgba(31,26,20,0.07)] sm:grid-cols-[340px_minmax(0,1fr)]">
				<div className="relative w-full self-center justify-self-center overflow-hidden rounded-[0.95rem] bg-[#E8DFCC] shadow-[0_10px_28px_rgba(31,26,20,0.08)]">
					{leadImage ? (
						<img
							src={leadImage}
							alt={snapshot.title ?? "Imagen del inmueble"}
							className="block w-full outline outline-1 outline-black/10"
						/>
					) : (
						<div className="flex min-h-[220px] w-full items-center justify-center text-[#6F5E4A]">
							<ImageIcon className="h-8 w-8" aria-hidden="true" />
						</div>
					)}
				</div>

				<div className="relative px-1 py-1 sm:px-2">
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
						Resumen del inmueble
					</p>
					<h1 className="mt-2 font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
						{snapshot.title ?? "Inmueble de Idealista"}
					</h1>
					{identity.proposedAddressLabel ? (
						<p className="mt-2 text-sm leading-6 text-[#6F5E4A] text-pretty">
							{identity.proposedAddressLabel}
						</p>
					) : null}
					{addressRationale ? (
						<p className="mt-2 text-sm leading-6 text-[#1F1A14] text-pretty">
							{addressRationale}
						</p>
					) : null}
					<dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
						{propertyOverviewRows.map((row) => (
							<div key={`${row.label}-${row.value}`} className="min-w-0">
								<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
									{row.label}
								</dt>
								<dd className="mt-1 truncate text-sm font-semibold leading-5 text-[#1F1A14]">
									{row.value}
								</dd>
							</div>
						))}
					</dl>
					<p className="mt-3 text-xs leading-5 text-[#6F5E4A] text-pretty">
						{publicMovementDetail}
					</p>
				</div>
			</div>

				<div className="mt-3 rounded-[1.35rem] bg-[#FFF8EA] p-5 shadow-[0_16px_46px_rgba(31,26,20,0.05)]">
					<div
						className={cn(
							"grid gap-6 lg:items-start",
							hasMarketEvidenceLinks
								? "lg:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]"
								: "lg:grid-cols-1",
						)}
					>
							<section className="min-w-0">
								<div className="flex items-start gap-3">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-[#9C6137] text-[#FFFBF2] shadow-[0_9px_20px_rgba(156,97,55,0.18)]">
										<FileSearch className="h-5 w-5" aria-hidden="true" />
							</span>
							<div className="min-w-0">
								<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
									Identidad oficial
								</p>
								<h2 className="mt-1 font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
									Base defendible
								</h2>
							</div>
							</div>
							{officialFactRows.length > 0 ? (
								<dl
									className={cn(
										"mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2",
										hasMarketEvidenceLinks
											? "xl:grid-cols-2"
											: "lg:grid-cols-3 xl:grid-cols-4",
									)}
								>
								{officialFactRows.map((row) => (
									<div key={`${row.label}-${row.value}`} className="min-w-0">
										<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
											{row.label}
										</dt>
										<dd className="mt-1 break-words text-sm font-medium leading-5 text-[#1F1A14]">
											{row.value}
										</dd>
									</div>
								))}
							</dl>
							) : (
								<p className="mt-5 max-w-prose text-sm leading-6 text-[#6F5E4A] text-pretty">
									Localiza todavía no tiene suficientes componentes oficiales para
									desglosar la unidad.
								</p>
							)}

								{hasObservedValuationHistory ? (
									<div className="mt-5 border-t border-[#E8DFCC] pt-4">
										<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
											Lectura de valoración
										</p>
										<p className="mt-1 max-w-3xl text-sm leading-6 text-[#1F1A14] text-pretty">
											{valuationRead.detail}
										</p>
										<dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
											<div>
												<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
													Rango observado
												</dt>
												<dd className="mt-1 text-sm font-semibold tabular-nums text-[#1F1A14]">
													{valuationRead.lowestAsk !== undefined &&
													valuationRead.highestAsk !== undefined
														? `${formatEuro(valuationRead.lowestAsk)} - ${formatEuro(
																valuationRead.highestAsk,
															)}`
														: "Pendiente"}
												</dd>
											</div>
											<div>
												<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
													Amplitud
												</dt>
												<dd className="mt-1 text-sm font-semibold tabular-nums text-[#1F1A14]">
													{valuationRead.publicSpread !== undefined
														? `${formatEuro(valuationRead.publicSpread)} · ${formatPercent(
																valuationRead.publicSpreadPercent,
															)}`
														: "Pendiente"}
												</dd>
											</div>
											<div>
												<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
													Observaciones
												</dt>
												<dd className="mt-1 text-sm font-semibold tabular-nums text-[#1F1A14]">
													{valuationRead.observationCount}
												</dd>
											</div>
										</dl>
									</div>
								) : null}
						</section>

							{hasMarketEvidenceLinks ? (
							<section>
								<div className="flex items-end justify-between gap-3 lg:justify-end">
									<div className="lg:text-right">
										<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
											Fuentes externas
										</p>
									<p className="mt-1 text-sm font-medium leading-5 text-[#6F5E4A]">
										Fuentes donde consta este inmueble
									</p>
								</div>
							</div>
							<div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
								{marketEvidenceLinks.map(({ Icon, ...link }) => (
									<a
										key={`${link.title}-${link.href}`}
										href={link.href}
										target="_blank"
										rel="noreferrer"
										className="group inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FFFBF2] px-3 text-sm font-medium text-[#1F1A14] shadow-[0_8px_18px_rgba(31,26,20,0.05)] transition-[color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:text-[#9C6137] hover:shadow-[0_12px_26px_rgba(31,26,20,0.075)] active:scale-[0.96]"
									>
										<Icon
											className="h-4 w-4 text-[#9C6137]"
											aria-hidden="true"
										/>
										{link.title}
										<ExternalLink
											className="h-3.5 w-3.5 text-[#9C6137] opacity-55 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
											aria-hidden="true"
										/>
									</a>
								))}
							</div>
						</section>
					) : null}
				</div>
			</div>

			{onlineEvidenceGroups.length > 0 ? (
				<div className="mt-3 rounded-[1.35rem] bg-[#FFF8EA] p-4 shadow-[0_16px_46px_rgba(31,26,20,0.05)]">
					<div className="flex flex-col gap-1">
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
							Señales comerciales
						</p>
						<h2 className="font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
							Archivo, señales y metadatos públicos
						</h2>
					</div>

					<div className="mt-3 overflow-hidden rounded-[1rem] bg-[#FFFBF2] shadow-[0_10px_24px_rgba(31,26,20,0.045)]">
						<div className="grid gap-2 bg-[#FFF8EA] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6F5E4A] md:grid-cols-[180px_minmax(0,1fr)_minmax(160px,0.42fr)]">
							<span>Para qué sirve</span>
							<span>Dato</span>
							<span>Procedencia</span>
						</div>
						<div className="divide-y divide-[#E8DFCC]/75">
							{onlineEvidenceGroups.map(({ Icon, items, ...group }) => (
								<section
									key={`evidence-${group.key}`}
									className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]"
								>
									<header className="bg-[#FFF8EA]/45 px-3 py-3 md:bg-transparent">
										<div className="flex items-start gap-2">
											<Icon
												className="mt-0.5 h-4 w-4 shrink-0 text-[#9C6137]"
												aria-hidden="true"
											/>
											<div className="min-w-0">
												<h3 className="text-sm font-semibold leading-5 text-[#1F1A14]">
													{group.title}
												</h3>
												<p className="mt-0.5 text-xs leading-4 text-[#6F5E4A] text-pretty">
													{group.action}
												</p>
											</div>
										</div>
									</header>
									<dl className="divide-y divide-[#E8DFCC]/65">
										{items.map((item) => (
											<div
												key={`${item.kind}-${item.label}-${item.value}`}
												className="grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(160px,0.42fr)] md:items-start"
											>
												<div className="min-w-0">
													<dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9C6137]">
														{item.label}
													</dt>
													<dd>
														<p className="text-sm font-semibold leading-5 text-[#1F1A14] text-pretty">
															{item.value}
														</p>
													</dd>
													<p className="mt-0.5 text-[11px] leading-4 text-[#6F5E4A]">
														{getOnlineEvidenceKindLabel(item.kind)}
													</p>
												</div>
												<dd className="text-[11px] leading-5 text-[#6F5E4A] md:text-right">
													{getEvidenceSourceLine(item)}
												</dd>
											</div>
										))}
									</dl>
								</section>
							))}
						</div>
					</div>
				</div>
			) : null}

				<div className="mt-3 rounded-[1.35rem] bg-[#FFF8EA] p-5 shadow-[0_16px_46px_rgba(31,26,20,0.05)]">
				<div className="grid gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
					<section className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
							Captura comercial
						</p>
						<h2 className="mt-1 font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
							{prospectingRead.stance}
						</h2>
						<p className="mt-2 max-w-prose text-sm leading-6 text-[#6F5E4A] text-pretty">
							{prospectingRead.detail}
						</p>
						<div className="mt-5 flex items-end gap-3">
							<p className="font-serif text-6xl font-normal leading-none text-[#1F1A14] tabular-nums">
								{prospectingRead.score}
							</p>
							<p className="pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6F5E4A]">
								/ 100
							</p>
						</div>
					</section>

					<section className="min-w-0">
						<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
							<div className="min-w-0">
								<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
									Anunciante público
								</dt>
								<dd className="mt-1 break-words text-sm font-semibold leading-5 text-[#1F1A14]">
									{prospectingRead.publicAdvertiser.label}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
									Procedencia
								</dt>
								<dd className="mt-1 text-sm font-semibold leading-5 text-[#1F1A14]">
									{publicAdvertiserHref ? (
										<a
											href={publicAdvertiserHref}
											target="_blank"
											rel="noreferrer"
											className="text-[#9C6137] underline decoration-[#9C6137]/40 underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-[#87522D] hover:decoration-[#87522D]"
										>
											{formatSourceHost(publicAdvertiserHref) ??
												prospectingRead.publicAdvertiser.sourceLabel}
										</a>
									) : (
										prospectingRead.publicAdvertiser.sourceLabel
									)}
								</dd>
							</div>
						</dl>

						<div className="mt-5 border-t border-[#E8DFCC] pt-4">
							<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
								Ángulo de contacto
							</p>
							<p className="mt-1 text-sm leading-6 text-[#1F1A14] text-pretty">
								{prospectingRead.pitch}
							</p>
						</div>

						<div className="mt-5 grid gap-2">
							{prospectingRead.reasons.map((reason) => (
								<p
									key={reason}
									className="text-sm leading-6 text-[#6F5E4A] text-pretty"
								>
									<span className="font-semibold text-[#9C6137]">- </span>
									{reason}
								</p>
							))}
						</div>

						<div className="mt-5 border-t border-[#E8DFCC] pt-4">
							<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F5E4A]">
								Titular y teléfono
							</p>
							<p className="mt-1 text-sm leading-6 text-[#6F5E4A] text-pretty">
								{prospectingRead.complianceNote}
							</p>
							<p className="mt-2 text-xs leading-5 text-[#6F5E4A] text-pretty">
								{prospectingRead.crmNote}
							</p>
						</div>
					</section>
				</div>
			</div>

				{hasMultiPortalEvidence ? (
					<div className="mt-3 rounded-[1.35rem] bg-[#FFF8EA] p-5 shadow-[0_16px_46px_rgba(31,26,20,0.05)]">
						<div className="flex flex-col gap-1">
							<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
								Presencia multiportal
							</p>
							<h2 className="font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
								Duplicados públicos confirmados
							</h2>
						</div>

						<div className="mt-4 divide-y divide-[#E8DFCC]">
							{multiPortalRecords.map((record, index) => {
								const sourceUrl = getBrowserUrl(record.sourceUrl);
								const sourceHost = formatSourceHost(sourceUrl);

								return (
									<div
										key={`${record.portal}-${record.sourceUrl ?? index}`}
										className="grid gap-3 py-3 md:grid-cols-[120px_128px_minmax(0,1fr)_auto] md:items-start"
									>
										<p className="text-sm font-semibold uppercase leading-6 text-[#9C6137]">
											{formatPortalLabel(record.portal)}
										</p>
										<p className="text-sm font-semibold leading-6 tabular-nums text-[#1F1A14]">
											{formatEuro(record.askingPrice)}
										</p>
										<div className="min-w-0">
											<p className="text-sm leading-6 text-[#1F1A14] text-pretty">
												{getDuplicateRecordPartyLabel(record)}
											</p>
											<p className="text-xs leading-5 text-[#6F5E4A]">
											{formatDuplicateRecordWindow(record)}
										</p>
									</div>
									{sourceUrl ? (
										<a
											href={sourceUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex min-h-10 items-center rounded-full px-2.5 text-xs font-medium text-[#9C6137] underline decoration-[#9C6137]/40 underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-[#87522D] hover:decoration-[#87522D] md:justify-self-end"
										>
											{sourceHost ?? "Fuente"}
										</a>
										) : null}
									</div>
								);
							})}
						</div>
					</div>
				) : null}

			<div className="mt-3 rounded-[1.35rem] bg-[#FFF8EA] p-5 shadow-[0_16px_46px_rgba(31,26,20,0.05)]">
				<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
							Actividad pública
						</p>
						<h2 className="mt-1 font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
							Histórico de precios, agencias y portales
						</h2>
					</div>
				</div>

					{history.length > 0 ? (
						<ol className="mt-5 grid gap-1">
							{history.map((row, index) => {
								const sourceUrl = getBrowserUrl(row.sourceUrl);
								const sourceHost = formatSourceHost(sourceUrl);

								return (
								<li
									key={`${row.portal}-${row.observedAt}-${index}`}
									className="group rounded-[1rem] px-1 py-3 transition-[background-color,transform] duration-200 ease-out hover:bg-[#FFFBF2]/70 active:scale-[0.99]"
								>
									<div className="grid gap-3 md:grid-cols-[108px_124px_minmax(0,1fr)_auto] md:items-start">
										<time className="text-xs font-medium tabular-nums text-[#6F5E4A] md:pt-1">
											{formatDate(row.observedAt)}
										</time>
										<p className="text-base font-semibold tabular-nums text-[#1F1A14] md:pt-0.5">
											{formatEuro(row.askingPrice)}
										</p>
										<div className="min-w-0">
											<p className="text-sm leading-6 text-[#1F1A14] text-pretty">
												<span className="font-semibold uppercase text-[#9C6137]">
													{row.portal}
												</span>
												<span className="text-[#6F5E4A]"> · </span>
												<span>{getHistoryPartyLabel(row)}</span>
											</p>
										</div>
										{sourceUrl ? (
											<a
												href={sourceUrl}
												target="_blank"
												rel="noreferrer"
												className="inline-flex min-h-10 items-center rounded-full px-2.5 text-xs font-medium text-[#9C6137] underline decoration-[#9C6137]/40 underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-[#87522D] hover:decoration-[#87522D] md:justify-self-end"
												title={sourceHost}
											>
												Fuente
											</a>
										) : null}
									</div>
								</li>
							);
						})}
					</ol>
				) : (
					<p className="mt-5 rounded-[1rem] bg-[#FFFBF2]/78 p-4 text-sm leading-6 text-[#6F5E4A] text-pretty">
						Todavía no hay datos públicos suficientes para construir un
						histórico.
					</p>
				)}
			</div>
		</section>
	);
}
