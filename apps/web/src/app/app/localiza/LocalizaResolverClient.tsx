"use client";

import type {
	CaptacionBoundaryPoint,
	CaptacionRankedBuilding,
	CaptacionRankingResult,
	ListingLocation,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Textarea,
} from "@casedra/ui";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	CheckCircle2,
	Download,
	ExternalLink,
	History,
	LoaderCircle,
	MapPin,
	Search,
	Target,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
	type AvailableLocalizaStrategy,
	buildLocalizaStrategyOptions,
	getPreferredLocalizaStrategy,
} from "@/lib/localiza-strategies";
import { capturePosthogEvent } from "@/lib/posthog";
import { trpc } from "@/trpc/shared";
import { LocalizaPropertyReport } from "./LocalizaPropertyReport";

type LocalizaResolverClientProps = {
	availableLocalizaStrategies: AvailableLocalizaStrategy[];
	initialSourceUrl?: string;
};

type LocalizaSearchHistoryEntry = {
	sourceUrl: string;
	searchedAt: string;
	resolvedAddressLabel?: string;
	status?: ResolveIdealistaLocationResult["status"];
	officialSource?: string;
	cacheExpiresAt?: string;
	thumbnailUrl?: string;
};

type LocalizaCandidate = ResolveIdealistaLocationResult["candidates"][number];
type LocalizaWorkspaceTab = "resolver" | "prospecting";
type LocalizaAddressFeedbackVerdict = "correct" | "incorrect";

const LOCALIZA_SEARCH_HISTORY_STORAGE_KEY = "casedra.localiza.searchHistory.v1";
const MAX_LOCALIZA_SEARCH_HISTORY_ITEMS = 10;

const resultCopy: Record<
	ResolveIdealistaLocationResult["status"],
	{ label: string; description: string }
> = {
	exact_match: {
		label: "Dirección encontrada",
		description: "Localiza encontró una dirección oficial para este anuncio.",
	},
	building_match: {
		label: "Edificio encontrado",
		description:
			"Localiza encontró el edificio. Revisa el piso o completa lo que falte.",
	},
	needs_confirmation: {
		label: "Opciones encontradas",
		description:
			"Localiza encontró varias direcciones oficiales posibles para este anuncio.",
	},
	unresolved: {
		label: "No encontrada",
		description:
			"No hay suficiente señal oficial para rellenar la dirección con seguridad.",
	},
};

const temporaryReadFailureReasonCodes = new Set([
	"auto_no_configured_or_successful_adapter",
	"selected_strategy_failed",
	"firecrawl_failed",
	"browser_worker_failed",
	"resolver_deadline_exceeded",
	"state_catastro_missing_coordinates",
]);

const getResultCopy = (result: ResolveIdealistaLocationResult) => {
	if (
		result.status === "unresolved" &&
		result.evidence.reasonCodes.some((reasonCode) =>
			temporaryReadFailureReasonCodes.has(reasonCode),
		)
	) {
		return {
			label: "No se pudo leer",
			description:
				"El anuncio no dio suficientes señales de ubicación. Vuelve a intentarlo; no significa que Catastro haya descartado la dirección.",
		};
	}

	return resultCopy[result.status];
};

const loadingMessages = [
	{
		key: "reading",
		text: "Buscando señales públicas en el anuncio...",
	},
	{
		key: "official",
		text: "Contrastando la dirección con fuentes oficiales...",
	},
	{
		key: "result",
		text: "Preparando un resultado verificable...",
	},
] as const;

const LOADING_MESSAGE_INTERVAL_MS = 2100;

const formatAddress = (location?: ListingLocation) =>
	location
		? [
				location.street,
				location.city,
				location.stateOrProvince,
				location.postalCode,
				location.country,
			]
				.filter(Boolean)
				.join(", ")
		: null;

const buildOnboardingHref = (sourceUrl: string, candidateId?: string) => {
	const params = new URLSearchParams({
		step: "listings",
		sourceUrl,
	});

	if (candidateId) {
		params.set("localizaCandidateId", candidateId);
	}

	return `/app/onboarding?${params.toString()}`;
};

const getCandidateMeta = (candidate: LocalizaCandidate) =>
	[
		candidate.parcelRef14 ? `Parcela ${candidate.parcelRef14}` : null,
		candidate.unitRef20 ? `Unidad ${candidate.unitRef20}` : null,
		typeof candidate.distanceMeters === "number"
			? `${Math.round(candidate.distanceMeters)} m del anuncio`
			: null,
	].filter(Boolean);

const getFirstSelectableCandidateId = (candidates: LocalizaCandidate[]) =>
	candidates.find((candidate) => !candidate.selectionDisabled)?.id ?? null;

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

const getDirectOfficialPropertyUrl = (
	result: ResolveIdealistaLocationResult,
	selectedCandidateId?: string | null,
) => {
	if (result.status === "needs_confirmation") {
		const selectedCandidate = result.candidates.find(
			(candidate) => candidate.id === selectedCandidateId,
		);

		return isBrowserUrl(selectedCandidate?.officialUrl)
			? selectedCandidate.officialUrl
			: undefined;
	}

	if (result.status !== "exact_match" && result.status !== "building_match") {
		return undefined;
	}

	const candidate =
		result.candidates.find(
			(entry) =>
				Boolean(result.unitRef20) && entry.unitRef20 === result.unitRef20,
		) ??
		result.candidates.find(
			(entry) =>
				Boolean(result.parcelRef14) && entry.parcelRef14 === result.parcelRef14,
		) ??
		(result.candidates.length === 1 ? result.candidates[0] : undefined);

	return isBrowserUrl(candidate?.officialUrl)
		? candidate.officialUrl
		: undefined;
};

const formatSourceHost = (sourceUrl?: string) => {
	if (!sourceUrl) {
		return undefined;
	}

	try {
		return new URL(sourceUrl).hostname.replace(/^www\./i, "");
	} catch {
		return undefined;
	}
};

const getDuplicateAddressEvidence = (result: ResolveIdealistaLocationResult) =>
	result.propertyDossier?.onlineEvidence?.find(
		(item) => item.label === "Dirección exacta en duplicado público",
	);

const buildAddressRationale = (result: ResolveIdealistaLocationResult) => {
	if (result.status !== "exact_match" && result.status !== "building_match") {
		return undefined;
	}

	const duplicateEvidence = getDuplicateAddressEvidence(result);

	if (duplicateEvidence) {
		const sourceHost = formatSourceHost(duplicateEvidence.sourceUrl);
		return `El anuncio ocultaba el número. Localiza encontró un duplicado público${sourceHost ? ` en ${sourceHost}` : ""} con la misma calle y características, extrajo ese número y después lo contrastó con Catastro.`;
	}

	if (result.evidence.matchedSignals.includes("designator_match")) {
		return "La dirección no sale solo del mapa del portal: coincide la calle, el número publicado y la fuente oficial.";
	}

	return "La dirección se muestra como resultado defendible porque la fuente oficial confirma el edificio; si falta puerta o unidad, debe completarse manualmente.";
};

const getHistoryUrlKey = (sourceUrl: string) => {
	const trimmedSourceUrl = sourceUrl.trim();

	try {
		const parsedUrl = new URL(trimmedSourceUrl);
		parsedUrl.hash = "";
		parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
		parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

		return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
	} catch {
		return trimmedSourceUrl.replace(/\/+$/, "").toLowerCase();
	}
};

const formatHistorySourceUrl = (sourceUrl: string) =>
	sourceUrl
		.replace(/^https?:\/\/(www\.)?/i, "")
		.replace(/\/$/, "")
		.slice(0, 72);

const getHistoryTimestamp = (entry: LocalizaSearchHistoryEntry) => {
	const timestamp = Date.parse(entry.searchedAt);

	return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatHistoryDate = (entry: LocalizaSearchHistoryEntry) => {
	const timestamp = getHistoryTimestamp(entry);

	if (!timestamp) {
		return "Fecha no disponible";
	}

	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
	}).format(new Date(timestamp));
};

const mergeSearchHistoryEntry = (
	entries: LocalizaSearchHistoryEntry[],
	nextEntry: LocalizaSearchHistoryEntry,
) => {
	const nextEntryKey = getHistoryUrlKey(nextEntry.sourceUrl);
	const mergedEntries = [
		nextEntry,
		...entries.filter(
			(entry) => getHistoryUrlKey(entry.sourceUrl) !== nextEntryKey,
		),
	];
	const seenKeys = new Set<string>();

	return mergedEntries
		.sort(
			(left, right) => getHistoryTimestamp(right) - getHistoryTimestamp(left),
		)
		.filter((entry) => {
			const entryKey = getHistoryUrlKey(entry.sourceUrl);

			if (!entryKey || seenKeys.has(entryKey)) {
				return false;
			}

			seenKeys.add(entryKey);
			return true;
		})
		.slice(0, MAX_LOCALIZA_SEARCH_HISTORY_ITEMS);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const parseSearchHistoryEntry = (
	value: unknown,
): LocalizaSearchHistoryEntry | null => {
	if (!isRecord(value) || typeof value.sourceUrl !== "string") {
		return null;
	}

	const searchedAt =
		typeof value.searchedAt === "string" &&
		Number.isFinite(Date.parse(value.searchedAt))
			? value.searchedAt
			: null;

	if (!searchedAt) {
		return null;
	}

	const status =
		typeof value.status === "string" && Object.hasOwn(resultCopy, value.status)
			? (value.status as ResolveIdealistaLocationResult["status"])
			: undefined;
	const cacheExpiresAt =
		typeof value.cacheExpiresAt === "string" &&
		Number.isFinite(Date.parse(value.cacheExpiresAt))
			? value.cacheExpiresAt
			: undefined;

	return {
		sourceUrl: value.sourceUrl,
		searchedAt,
		status,
		cacheExpiresAt,
		officialSource:
			typeof value.officialSource === "string"
				? value.officialSource
				: undefined,
		resolvedAddressLabel:
			typeof value.resolvedAddressLabel === "string"
				? value.resolvedAddressLabel
				: undefined,
		thumbnailUrl:
			typeof value.thumbnailUrl === "string" && value.thumbnailUrl.length > 0
				? value.thumbnailUrl
				: undefined,
	};
};

const parseStoredSearchHistory = (storedValue: string | null) => {
	if (!storedValue) {
		return [];
	}

	try {
		const parsedValue: unknown = JSON.parse(storedValue);

		if (!Array.isArray(parsedValue)) {
			return [];
		}

		return parsedValue.reduce<LocalizaSearchHistoryEntry[]>(
			(entries, value) => {
				const entry = parseSearchHistoryEntry(value);

				return entry ? mergeSearchHistoryEntry(entries, entry) : entries;
			},
			[],
		);
	} catch {
		return [];
	}
};

const buildPendingHistoryEntry = (
	sourceUrl: string,
): LocalizaSearchHistoryEntry => ({
	sourceUrl,
	searchedAt: new Date().toISOString(),
});

const buildResolvedHistoryEntry = (
	result: ResolveIdealistaLocationResult,
	fallbackSourceUrl: string,
): LocalizaSearchHistoryEntry => ({
	sourceUrl: result.sourceMetadata.sourceUrl || fallbackSourceUrl,
	searchedAt: new Date().toISOString(),
	resolvedAddressLabel:
		result.resolvedAddressLabel ??
		formatAddress(result.prefillLocation) ??
		result.candidates[0]?.label,
	status: result.status,
	officialSource: result.officialSource,
	cacheExpiresAt: result.cacheExpiresAt,
	thumbnailUrl:
		result.propertyDossier?.listingSnapshot.leadImageUrl ??
		result.propertyDossier?.imageGallery[0]?.thumbnailUrl ??
		result.propertyDossier?.imageGallery[0]?.imageUrl,
});

function LocalizaLoadingComposer({
	activeMessageIndex,
}: {
	activeMessageIndex: number;
}) {
	const activeMessage =
		loadingMessages[activeMessageIndex % loadingMessages.length] ??
		loadingMessages[0];

	return (
		<div
			className="localiza-loading-panel mt-5 overflow-hidden rounded-[1.35rem] bg-[#FFF8EA]/90 p-4 shadow-[0_18px_52px_rgba(31,26,20,0.07),inset_0_0_0_1px_rgba(232,223,204,0.9)]"
			aria-live="polite"
		>
			<div className="flex items-start gap-3">
				<div
					className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-[#FFFBF2] text-[#9C6137] shadow-[0_8px_24px_rgba(31,26,20,0.06),inset_0_0_0_1px_rgba(156,97,55,0.14)]"
					aria-hidden="true"
				>
					<span className="localiza-loading-orb absolute h-2.5 w-2.5 rounded-full bg-[#9C6137]" />
					<span className="localiza-loading-ring absolute h-2.5 w-2.5 rounded-full border border-[#9C6137]/35" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9C6137]">
							Localiza está trabajando
						</p>
						<span
							className="localiza-loading-dots inline-flex items-center gap-1"
							aria-hidden="true"
						>
							<span />
							<span />
							<span />
						</span>
					</div>
					<p
						key={activeMessage.key}
						className="localiza-loading-text mt-1 min-h-6 text-[15px] font-medium leading-6 text-[#1F1A14] [text-wrap:pretty]"
					>
						{activeMessage.text}
					</p>
					<div className="mt-3 space-y-2" aria-hidden="true">
						<span className="localiza-loading-shimmer block h-2 rounded-full bg-[#E8DFCC]/70" />
						<span className="localiza-loading-shimmer block h-2 w-8/12 rounded-full bg-[#E8DFCC]/55" />
					</div>
				</div>
			</div>
		</div>
	);
}

const ensureLeafletCss = () => {
	if (document.querySelector('link[data-casedra-leaflet="true"]')) {
		return;
	}

	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
	link.dataset.casedraLeaflet = "true";
	document.head.appendChild(link);
};

const csvEscape = (value: unknown) => {
	if (value === undefined || value === null) {
		return "";
	}

	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const buildCaptacionCsv = (rows: CaptacionRankedBuilding[]) => {
	const headers = [
		"rank",
		"direccion_oficial",
		"referencia_catastral",
		"unidad_residencial_mayor_m2",
		"referencia_unidad_mayor",
		"superficie_edificio_m2",
		"viviendas",
		"unidades",
		"uso",
		"municipio",
		"provincia",
		"latitud",
		"longitud",
		"fuente_ranking",
		"confianza_ranking",
		"fuente_oficial",
		"url_oficial",
	];
	const body = rows.map((row) =>
		[
			row.rank,
			row.addressLabel,
			row.cadastralReference,
			row.largestResidentialUnitM2,
			row.largestResidentialUnitReference,
			row.officialBuildingAreaM2,
			row.residentialUnitCount,
			row.buildingUnitCount,
			row.currentUse,
			row.municipality,
			row.province,
			row.centroid.lat,
			row.centroid.lng,
			row.rankingSource,
			row.rankingConfidence,
			row.officialSource,
			row.officialUrl,
		]
			.map(csvEscape)
			.join(","),
	);

	return [headers.join(","), ...body].join("\n");
};

const downloadCaptacionCsv = (rows: CaptacionRankedBuilding[]) => {
	const blob = new Blob([buildCaptacionCsv(rows)], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");

	anchor.href = url;
	anchor.download = `captacion-catastro-${new Date().toISOString().slice(0, 10)}.csv`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
};

const formatCaptacionArea = (value?: number) =>
	value === undefined
		? "No disponible"
		: `${new Intl.NumberFormat("es-ES", {
				maximumFractionDigits: 0,
			}).format(value)} m²`;

const formatCaptacionPercent = (value: number) =>
	new Intl.NumberFormat("es-ES", {
		maximumFractionDigits: 0,
		style: "percent",
	}).format(value);

function LocalizaProspectingScaffold() {
	const titleId = useId();
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const leafletRef = useRef<typeof import("leaflet") | null>(null);
	const mapRef = useRef<import("leaflet").Map | null>(null);
	const polygonLayerRef = useRef<import("leaflet").Polygon | null>(null);
	const pointLayersRef = useRef<import("leaflet").Layer[]>([]);
	const rankCaptacionBuildings =
		trpc.listings.rankCaptacionBuildings.useMutation();
	const [boundary, setBoundary] = useState<CaptacionBoundaryPoint[]>([]);
	const [captacionResult, setCaptacionResult] =
		useState<CaptacionRankingResult | null>(null);
	const [addressQuery, setAddressQuery] = useState("");
	const [addressLookupPending, setAddressLookupPending] = useState(false);
	const [addressLookupError, setAddressLookupError] = useState<string | null>(
		null,
	);

	useEffect(() => {
		ensureLeafletCss();
		let isCancelled = false;

		void import("leaflet").then((leaflet) => {
			if (isCancelled || !mapContainerRef.current || mapRef.current) {
				return;
			}

			leafletRef.current = leaflet;
			const map = leaflet
				.map(mapContainerRef.current, {
					attributionControl: false,
					zoomControl: true,
				})
				.setView([40.4168, -3.7038], 13);

			leaflet
				.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					maxZoom: 19,
					attribution: "&copy; OpenStreetMap",
				})
				.addTo(map);
			map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
				setCaptacionResult(null);
				setBoundary((currentBoundary) =>
					currentBoundary.length >= 80
						? currentBoundary
						: [
								...currentBoundary,
								{ lat: event.latlng.lat, lng: event.latlng.lng },
							],
				);
			});
			mapRef.current = map;
		});

		return () => {
			isCancelled = true;
			mapRef.current?.remove();
			mapRef.current = null;
			leafletRef.current = null;
			polygonLayerRef.current = null;
			pointLayersRef.current = [];
		};
	}, []);

	useEffect(() => {
		const leaflet = leafletRef.current;
		const map = mapRef.current;

		if (!leaflet || !map) {
			return;
		}

		if (polygonLayerRef.current) {
			polygonLayerRef.current.remove();
			polygonLayerRef.current = null;
		}

		for (const layer of pointLayersRef.current) {
			layer.remove();
		}
		pointLayersRef.current = [];

		if (boundary.length >= 3) {
			polygonLayerRef.current = leaflet
				.polygon(
					boundary.map((point) => [point.lat, point.lng]),
					{
						color: "#9C6137",
						fillColor: "#9C6137",
						fillOpacity: 0.14,
						weight: 2,
					},
				)
				.addTo(map);
		}

		pointLayersRef.current = boundary.map((point, index) => {
			const marker = leaflet
				.circleMarker([point.lat, point.lng], {
					radius: 5,
					color: "#9C6137",
					fillColor: "#FFFBF2",
					fillOpacity: 1,
					weight: 2,
					bubblingMouseEvents: false,
				})
				.bindTooltip(String(index + 1), {
					direction: "top",
					opacity: 0.92,
					permanent: false,
				})
				.addTo(map);

			marker.on("click", () => {
				setCaptacionResult(null);
				setBoundary((current) => current.filter((_, i) => i !== index));
			});

			return marker;
		});
	}, [boundary]);

	const clearBoundary = () => {
		setBoundary([]);
		setCaptacionResult(null);
	};

	const lookupAddress = async () => {
		const map = mapRef.current;
		const leaflet = leafletRef.current;
		const trimmed = addressQuery.trim();
		if (!map || !leaflet || trimmed.length < 2) {
			return;
		}

		setAddressLookupPending(true);
		setAddressLookupError(null);
		try {
			const url = new URL("https://nominatim.openstreetmap.org/search");
			url.searchParams.set("q", trimmed);
			url.searchParams.set("format", "json");
			url.searchParams.set("limit", "1");
			url.searchParams.set("countrycodes", "es,pt,ad");
			const response = await fetch(url.toString(), {
				headers: { Accept: "application/json" },
			});
			if (!response.ok) {
				throw new Error("lookup_failed");
			}
			const matches = (await response.json()) as Array<{
				lat: string;
				lon: string;
				boundingbox?: [string, string, string, string];
			}>;
			const hit = matches[0];
			if (!hit) {
				setAddressLookupError("No se encontró esa dirección o barrio.");
				return;
			}
			if (hit.boundingbox) {
				const [south, north, west, east] = hit.boundingbox.map(
					Number.parseFloat,
				);
				if (
					Number.isFinite(south) &&
					Number.isFinite(north) &&
					Number.isFinite(west) &&
					Number.isFinite(east)
				) {
					map.fitBounds(
						leaflet.latLngBounds([south, west], [north, east]),
						{ padding: [24, 24], maxZoom: 17 },
					);
					return;
				}
			}
			const lat = Number.parseFloat(hit.lat);
			const lng = Number.parseFloat(hit.lon);
			if (Number.isFinite(lat) && Number.isFinite(lng)) {
				map.setView([lat, lng], 16);
			}
		} catch {
			setAddressLookupError("No se pudo consultar la búsqueda.");
		} finally {
			setAddressLookupPending(false);
		}
	};

	const exportCaptacionCsv = () => {
		if (!captacionResult?.exportEnabled) {
			return;
		}

		capturePosthogEvent("captacion_export_clicked", {
			row_count: captacionResult.rows.length,
			exact_coverage: captacionResult.exactCoverage,
			ranking_source: captacionResult.rankingSource,
			adapter: captacionResult.adapter,
		});
		downloadCaptacionCsv(captacionResult.rows);
	};

	const searchCaptacion = async () => {
		if (boundary.length < 3) {
			return;
		}

		const result = await rankCaptacionBuildings.mutateAsync({ boundary });
		setCaptacionResult(result);
	};

	return (
		<section
			className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.55fr)]"
			aria-labelledby={titleId}
		>
			<Card className="border-border/80 bg-background">
				<CardHeader>
					<CardTitle id={titleId} className="flex items-center gap-2 text-lg">
						<Target className="h-5 w-5 text-primary" aria-hidden="true" />
						Ranking residencial por zona
					</CardTitle>
					<CardDescription>
						Dibuja una zona, consulta Catastro y exporta solo rankings exactos.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<form
						className="flex flex-wrap items-center gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void lookupAddress();
						}}
					>
						<Input
							type="search"
							value={addressQuery}
							onChange={(event) => {
								setAddressQuery(event.target.value);
								if (addressLookupError) {
									setAddressLookupError(null);
								}
							}}
							placeholder="Dirección o barrio (ej. Salamanca, Madrid)"
							aria-label="Buscar dirección o barrio"
							className="min-w-0 flex-1"
						/>
						<Button
							type="submit"
							variant="outline"
							className="min-h-11 transition-[background-color,border-color,color,transform] active:scale-[0.96]"
							disabled={
								addressLookupPending || addressQuery.trim().length < 2
							}
						>
							{addressLookupPending ? (
								<LoaderCircle
									className="mr-2 h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
							) : (
								<MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
							)}
							Ir a la zona
						</Button>
					</form>

					{addressLookupError ? (
						<p className="text-sm text-destructive" role="alert">
							{addressLookupError}
						</p>
					) : null}

					<section
						ref={mapContainerRef}
						className="relative z-0 h-[28rem] overflow-hidden rounded-[1rem] bg-[#FFF8EA] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]"
						aria-label="Mapa para dibujar zona de captación"
					/>

					<div className="flex flex-wrap items-center gap-3">
						<Button
							type="button"
							className="min-h-11 transition-[background-color,color,transform] active:scale-[0.96]"
							disabled={boundary.length < 3 || rankCaptacionBuildings.isPending}
							onClick={() => void searchCaptacion()}
						>
							{rankCaptacionBuildings.isPending ? (
								<LoaderCircle
									className="mr-2 h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
							) : (
								<Search className="mr-2 h-4 w-4" aria-hidden="true" />
							)}
							Buscar en Catastro
						</Button>
						<Button
							type="button"
							variant="outline"
							className="min-h-11 transition-[background-color,border-color,color,transform] active:scale-[0.96]"
							disabled={
								boundary.length === 0 || rankCaptacionBuildings.isPending
							}
							onClick={clearBoundary}
						>
							<Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
							Borrar zona
						</Button>
						{captacionResult?.rows.length ? (
							<Button
								type="button"
								variant="outline"
								className="min-h-11 transition-[background-color,border-color,color,transform] active:scale-[0.96]"
								disabled={!captacionResult.exportEnabled}
								onClick={exportCaptacionCsv}
							>
								<Download className="mr-2 h-4 w-4" aria-hidden="true" />
								{captacionResult.exportEnabled
									? "Exportar CSV"
									: "Exportación bloqueada"}
							</Button>
						) : null}
						<p className="text-sm leading-6 text-muted-foreground">
							{boundary.length < 3
								? `Zona: ${boundary.length}/3 puntos mínimos.`
								: `${boundary.length} puntos marcados.`}
						</p>
					</div>

					{rankCaptacionBuildings.error ? (
						<div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							<AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
							<p>{rankCaptacionBuildings.error.message}</p>
						</div>
					) : null}

					{captacionResult ? (
						<div className="space-y-4 border-t border-border/80 pt-5">
							<div className="grid gap-3 sm:grid-cols-4">
								<div className="rounded-[0.9rem] bg-[#FFF8EA] p-3 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]">
									<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9C6137]">
										Edificios
									</p>
									<p className="mt-1 text-2xl font-medium text-[#1F1A14]">
										{captacionResult.rows.length}
									</p>
								</div>
								<div className="rounded-[0.9rem] bg-[#FFF8EA] p-3 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]">
									<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9C6137]">
										Zona
									</p>
									<p className="mt-1 text-2xl font-medium text-[#1F1A14]">
										{captacionResult.boundaryAreaKm2} km²
									</p>
								</div>
								<div className="rounded-[0.9rem] bg-[#FFF8EA] p-3 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]">
									<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9C6137]">
										Exactitud
									</p>
									<p className="mt-1 text-sm font-medium leading-6 text-[#1F1A14]">
										{captacionResult.exactRowCount}/
										{captacionResult.totalResidentialRowCount} filas exactas
									</p>
								</div>
								<div className="rounded-[0.9rem] bg-[#FFF8EA] p-3 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]">
									<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9C6137]">
										Cobertura
									</p>
									<p className="mt-1 text-2xl font-medium text-[#1F1A14]">
										{formatCaptacionPercent(captacionResult.exactCoverage)}
									</p>
								</div>
							</div>

							{captacionResult.warnings.length > 0 ? (
								<div className="rounded-md border border-border/70 p-3 text-sm leading-6 text-muted-foreground">
									{captacionResult.warnings.map((warning) => (
										<p key={warning}>{warning}</p>
									))}
								</div>
							) : null}

							<div className="overflow-hidden rounded-[1rem] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]">
								<div className="max-h-[34rem] overflow-auto">
									<table className="w-full min-w-[58rem] border-collapse text-left text-sm">
										<thead className="sticky top-0 bg-[#FFF8EA] text-[11px] uppercase tracking-[0.14em] text-[#6F5E4A]">
											<tr>
												<th className="px-4 py-3 font-semibold">#</th>
												<th className="px-4 py-3 font-semibold">Edificio</th>
												<th className="px-4 py-3 font-semibold">Superficie</th>
												<th className="px-4 py-3 font-semibold">Confianza</th>
												<th className="px-4 py-3 font-semibold">Viviendas</th>
												<th className="px-4 py-3 font-semibold">Uso</th>
												<th className="px-4 py-3 font-semibold">Fuente</th>
											</tr>
										</thead>
										<tbody>
											{captacionResult.rows.map((row) => (
												<tr
													key={row.cadastralReference}
													className="border-t border-border/70 bg-background"
												>
													<td className="px-4 py-3 font-medium text-[#1F1A14]">
														{row.rank}
													</td>
													<td className="px-4 py-3">
														<p className="font-medium text-[#1F1A14]">
															{row.addressLabel ?? row.cadastralReference}
														</p>
														<p className="mt-1 font-mono text-xs text-muted-foreground">
															{row.cadastralReference}
														</p>
													</td>
													<td className="px-4 py-3 text-[#1F1A14]">
														{row.largestResidentialUnitM2
															? formatCaptacionArea(
																	row.largestResidentialUnitM2,
																)
															: formatCaptacionArea(row.officialBuildingAreaM2)}
														{row.largestResidentialUnitReference ? (
															<p className="mt-1 font-mono text-xs text-muted-foreground">
																{row.largestResidentialUnitReference}
															</p>
														) : null}
													</td>
													<td className="px-4 py-3 text-muted-foreground">
														{row.rankingConfidence === "exact"
															? "Exacta"
															: "Diagnóstico"}
													</td>
													<td className="px-4 py-3 text-muted-foreground">
														{row.residentialUnitCount ?? "No disponible"}
													</td>
													<td className="px-4 py-3 text-muted-foreground">
														{row.currentUse ?? "Residencial"}
													</td>
													<td className="px-4 py-3">
														{row.officialUrl ? (
															<a
																href={row.officialUrl}
																target="_blank"
																rel="noreferrer"
																className="inline-flex items-center gap-1 text-primary"
															>
																Catastro
																<ExternalLink
																	className="h-3.5 w-3.5"
																	aria-hidden="true"
																/>
															</a>
														) : (
															<span className="text-muted-foreground">
																Catastro
															</span>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					) : null}
				</CardContent>
			</Card>

			<div className="space-y-4">
				<Card className="border-border/80 bg-background">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
							Contrato de búsqueda
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
						<p>
							Incluye pisos y chalets siempre que Catastro los marque como
							residenciales.
						</p>
						<p>
							La zona máxima es un barrio. Si dibujas demasiado, el servidor la
							rechaza.
						</p>
						<p>
							El CSV exporta todas las filas devueltas, ya ordenadas de mayor a
							menor.
						</p>
					</CardContent>
				</Card>

				<Card className="border-border/80 bg-background">
					<CardHeader>
						<CardTitle className="text-lg">Primer resultado esperado</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
						<p>
							El CSV comercial solo se activa cuando todas las filas tienen
							superficie residencial individual exacta desde el índice
							alfanumérico CAT.
						</p>
						<p>
							No se muestran titulares, teléfonos ni datos protegidos. Esto es
							solo captación por huella residencial oficial.
						</p>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}

export default function LocalizaResolverClient({
	availableLocalizaStrategies,
	initialSourceUrl = "",
}: LocalizaResolverClientProps) {
	const candidateFieldId = useId();
	const sourceUrlInputId = `${candidateFieldId}-source-url`;
	const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
	const [result, setResult] = useState<ResolveIdealistaLocationResult | null>(
		null,
	);
	const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const hasTrackedLocalizaUrlPasteRef = useRef(false);
	const requestSequenceRef = useRef(0);
	const historyContainerRef = useRef<HTMLDivElement>(null);
	const historyListRef = useRef<HTMLUListElement>(null);
	const resolveIdealistaLocation =
		trpc.listings.resolveIdealistaLocation.useMutation();
	const submitAddressFeedback =
		trpc.listings.submitLocalizaAddressFeedback.useMutation();
	const [searchHistory, setSearchHistory] = useState<
		LocalizaSearchHistoryEntry[]
	>([]);
	const [addressFeedbackVerdict, setAddressFeedbackVerdict] =
		useState<LocalizaAddressFeedbackVerdict | null>(null);
	const [correctedAddressLabel, setCorrectedAddressLabel] = useState("");
	const [addressFeedbackMessage, setAddressFeedbackMessage] = useState<
		string | null
	>(null);
	const [addressFeedbackError, setAddressFeedbackError] = useState<string | null>(
		null,
	);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [historyScrollEdges, setHistoryScrollEdges] = useState({
		canScrollUp: false,
		canScrollDown: false,
	});
	const [activeTab, setActiveTab] = useState<LocalizaWorkspaceTab>("resolver");
	const strategyOptions = useMemo(
		() => buildLocalizaStrategyOptions(availableLocalizaStrategies),
		[availableLocalizaStrategies],
	);
	const hasConfiguredStrategy = strategyOptions.length > 0;
	const resolvedAddress =
		result?.resolvedAddressLabel ?? formatAddress(result?.prefillLocation);
	const visibleResultCopy = result ? getResultCopy(result) : null;
	const currentSourceUrl = result?.sourceMetadata.sourceUrl ?? sourceUrl.trim();
	const directOfficialPropertyUrl = result
		? getDirectOfficialPropertyUrl(result, selectedCandidateId)
		: undefined;
	const addressRationale = result ? buildAddressRationale(result) : undefined;
	const selectedCandidate =
		result?.status === "needs_confirmation"
			? (result.candidates.find(
					(candidate) => candidate.id === selectedCandidateId,
				) ?? null)
			: null;
	const feedbackSelectedAddressLabel =
		selectedCandidate?.label ?? resolvedAddress ?? result?.resolvedAddressLabel;
	const createHref = result
		? buildOnboardingHref(currentSourceUrl, selectedCandidate?.id)
		: null;
	const [activeLoadingMessageIndex, setActiveLoadingMessageIndex] = useState(0);
	const effectiveStrategy =
		getPreferredLocalizaStrategy("auto", availableLocalizaStrategies) ?? "auto";

	const resetAddressFeedback = () => {
		setAddressFeedbackVerdict(null);
		setCorrectedAddressLabel("");
		setAddressFeedbackMessage(null);
		setAddressFeedbackError(null);
	};

	useEffect(() => {
		if (!resolveIdealistaLocation.isPending) {
			setActiveLoadingMessageIndex(0);
			return;
		}

		setActiveLoadingMessageIndex(0);
		const intervalId = window.setInterval(() => {
			setActiveLoadingMessageIndex(
				(currentIndex) => (currentIndex + 1) % loadingMessages.length,
			);
		}, LOADING_MESSAGE_INTERVAL_MS);

		return () => window.clearInterval(intervalId);
	}, [resolveIdealistaLocation.isPending]);

	useEffect(() => {
		try {
			setSearchHistory(
				parseStoredSearchHistory(
					window.localStorage.getItem(LOCALIZA_SEARCH_HISTORY_STORAGE_KEY),
				),
			);
		} catch {
			setSearchHistory([]);
		}
	}, []);

	useEffect(() => {
		if (!isHistoryOpen) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				!historyContainerRef.current?.contains(event.target)
			) {
				setIsHistoryOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsHistoryOpen(false);
			}
		};

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isHistoryOpen]);

	useEffect(() => {
		if (!isHistoryOpen) {
			setHistoryScrollEdges({ canScrollUp: false, canScrollDown: false });
			return;
		}

		const node = historyListRef.current;

		if (!node) {
			return;
		}

		const updateEdges = () => {
			const { scrollTop, clientHeight, scrollHeight } = node;
			setHistoryScrollEdges({
				canScrollUp: scrollTop > 1,
				canScrollDown: scrollTop + clientHeight < scrollHeight - 1,
			});
		};

		updateEdges();
		node.addEventListener("scroll", updateEdges, { passive: true });
		window.addEventListener("resize", updateEdges);

		return () => {
			node.removeEventListener("scroll", updateEdges);
			window.removeEventListener("resize", updateEdges);
		};
	}, [isHistoryOpen, searchHistory.length]);

	const rememberSearchHistoryEntry = (entry: LocalizaSearchHistoryEntry) => {
		setSearchHistory((currentEntries) => {
			const nextEntries = mergeSearchHistoryEntry(currentEntries, entry);

			try {
				window.localStorage.setItem(
					LOCALIZA_SEARCH_HISTORY_STORAGE_KEY,
					JSON.stringify(nextEntries),
				);
			} catch {
				// If browser storage is unavailable, keep the in-memory history for this session.
			}

			return nextEntries;
		});
	};

	const handleSourceUrlChange = (value: string) => {
		requestSequenceRef.current += 1;
		setSourceUrl(value);
		setResult(null);
		setSelectedCandidateId(null);
		setError(null);
		setIsHistoryOpen(false);
		resetAddressFeedback();

		const trimmedValue = value.trim();

		if (trimmedValue && !hasTrackedLocalizaUrlPasteRef.current) {
			hasTrackedLocalizaUrlPasteRef.current = true;
			capturePosthogEvent("localiza_url_pasted", {
				requestedStrategy: effectiveStrategy,
				surface: "localiza_resolver_page",
			});
		}

		if (!trimmedValue) {
			hasTrackedLocalizaUrlPasteRef.current = false;
		}
	};

	const resolveLocation = async (sourceUrlOverride?: string) => {
		const trimmedSourceUrl = (sourceUrlOverride ?? sourceUrl).trim();
		const requestedStrategy = effectiveStrategy;

		capturePosthogEvent("localiza_resolve_clicked", {
			requestedStrategy,
			surface: "localiza_resolver_page",
			hasConfiguredStrategy,
		});

		if (!trimmedSourceUrl) {
			setError("Pega una URL de Idealista primero.");
			setResult(null);
			return;
		}

		if (!hasConfiguredStrategy) {
			setError("La lectura de anuncios no está configurada en este entorno.");
			setResult(null);
			return;
		}

		const requestSequence = requestSequenceRef.current + 1;
		requestSequenceRef.current = requestSequence;

		try {
			setSourceUrl(trimmedSourceUrl);
			setError(null);
			setResult(null);
			setSelectedCandidateId(null);
			resetAddressFeedback();
			rememberSearchHistoryEntry(buildPendingHistoryEntry(trimmedSourceUrl));
			const resolved = await resolveIdealistaLocation.mutateAsync({
				url: trimmedSourceUrl,
				strategy: requestedStrategy,
			});

			if (requestSequenceRef.current !== requestSequence) {
				return;
			}

			setResult(resolved);
			setSelectedCandidateId(
				resolved.status === "needs_confirmation"
					? getFirstSelectableCandidateId(resolved.candidates)
					: null,
			);
			setSourceUrl(resolved.sourceMetadata.sourceUrl);
			rememberSearchHistoryEntry(
				buildResolvedHistoryEntry(resolved, trimmedSourceUrl),
			);
			capturePosthogEvent(
				resolved.status === "unresolved"
					? "localiza_resolve_unresolved"
					: "localiza_resolve_success",
				{
					requestedStrategy: resolved.requestedStrategy,
					actualAcquisitionMethod: resolved.evidence.actualAcquisitionMethod,
					territoryAdapter: resolved.territoryAdapter,
					status: resolved.status,
					confidenceScore: resolved.confidenceScore,
					candidateCount: resolved.candidates.length,
					surface: "localiza_resolver_page",
				},
			);
		} catch (unknownError) {
			if (requestSequenceRef.current !== requestSequence) {
				return;
			}

			capturePosthogEvent("localiza_resolve_failed", {
				requestedStrategy,
				surface: "localiza_resolver_page",
				errorMessage:
					unknownError instanceof Error
						? unknownError.message
						: "unknown_error",
			});
			setError(
				unknownError instanceof Error
					? unknownError.message
					: "No hemos podido leer este anuncio.",
			);
			setSelectedCandidateId(null);
		}
	};

	const retrieveHistoryEntry = (entry: LocalizaSearchHistoryEntry) => {
		setIsHistoryOpen(false);
		void resolveLocation(entry.sourceUrl);
	};

	const removeHistoryEntry = (entry: LocalizaSearchHistoryEntry) => {
		const targetKey = getHistoryUrlKey(entry.sourceUrl);
		setSearchHistory((currentEntries) => {
			const nextEntries = currentEntries.filter(
				(candidate) => getHistoryUrlKey(candidate.sourceUrl) !== targetKey,
			);

			try {
				if (nextEntries.length > 0) {
					window.localStorage.setItem(
						LOCALIZA_SEARCH_HISTORY_STORAGE_KEY,
						JSON.stringify(nextEntries),
					);
				} else {
					window.localStorage.removeItem(
						LOCALIZA_SEARCH_HISTORY_STORAGE_KEY,
					);
				}
			} catch {
				// If browser storage is unavailable, keep the in-memory change for this session.
			}

			return nextEntries;
		});
	};

	const submitLocalizaAddressFeedback = async (
		verdict: LocalizaAddressFeedbackVerdict,
	) => {
		if (!result) {
			return;
		}

		const normalizedCorrection = correctedAddressLabel.trim();

		if (verdict === "incorrect" && !normalizedCorrection) {
			setAddressFeedbackVerdict("incorrect");
			setAddressFeedbackError("Escribe la dirección correcta.");
			setAddressFeedbackMessage(null);
			return;
		}

		try {
			setAddressFeedbackError(null);
			await submitAddressFeedback.mutateAsync({
				sourceUrl: result.sourceMetadata.sourceUrl,
				externalListingId: result.sourceMetadata.externalListingId,
				verdict,
				resultStatus: result.status,
				resolverVersion: result.resolverVersion,
				territoryAdapter: result.territoryAdapter,
				resolvedAddressLabel: result.resolvedAddressLabel,
				selectedCandidateId: selectedCandidate?.id,
				selectedCandidateLabel: feedbackSelectedAddressLabel,
				correctedAddressLabel:
					verdict === "incorrect" ? normalizedCorrection : undefined,
				reasonCodes: result.evidence.reasonCodes,
			});
			setAddressFeedbackVerdict(verdict);
			setAddressFeedbackMessage(
				verdict === "correct"
					? "Guardado. Esta lectura entra en la regresión de Localiza."
					: "Corrección guardada. La revisaremos antes de validarla.",
			);
			capturePosthogEvent("localiza_address_feedback_submitted", {
				surface: "localiza_resolver_page",
				verdict,
				status: result.status,
				candidateCount: result.candidates.length,
				hasCorrectedAddress: verdict === "incorrect",
			});
		} catch (unknownError) {
			setAddressFeedbackError(
				unknownError instanceof Error
					? unknownError.message
					: "No se pudo guardar la corrección.",
			);
			setAddressFeedbackMessage(null);
		}
	};

	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
				<header className="flex flex-col gap-3">
					<span className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-background px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
						Localiza
					</span>
					<h1 className="font-serif text-[2.8rem] font-normal leading-tight sm:text-[4rem]">
						Localiza inmuebles con señal oficial.
					</h1>
					<p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
						Resuelve direcciones desde Idealista o prepara búsquedas de
						captación con Catastro sin inventar resultados.
					</p>
				</header>

				<div
					className="inline-flex self-start rounded-[1rem] bg-[#FFF8EA] p-1 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]"
					role="tablist"
					aria-label="Herramientas de Localiza"
				>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "resolver"}
						className={`inline-flex min-h-10 items-center gap-2 rounded-[0.75rem] px-4 text-sm font-medium transition-[background-color,color,box-shadow,transform] active:scale-[0.97] ${
							activeTab === "resolver"
								? "bg-[#FFFBF2] text-[#1F1A14] shadow-[0_8px_22px_rgba(31,26,20,0.07)]"
								: "text-[#6F5E4A] hover:text-[#1F1A14]"
						}`}
						onClick={() => setActiveTab("resolver")}
					>
						<MapPin className="h-4 w-4" aria-hidden="true" />
						Dirección
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "prospecting"}
						className={`inline-flex min-h-10 items-center gap-2 rounded-[0.75rem] px-4 text-sm font-medium transition-[background-color,color,box-shadow,transform] active:scale-[0.97] ${
							activeTab === "prospecting"
								? "bg-[#FFFBF2] text-[#1F1A14] shadow-[0_8px_22px_rgba(31,26,20,0.07)]"
								: "text-[#6F5E4A] hover:text-[#1F1A14]"
						}`}
						onClick={() => setActiveTab("prospecting")}
					>
						<Target className="h-4 w-4" aria-hidden="true" />
						Captación
					</button>
				</div>

				{activeTab === "resolver" ? (
					<>
						<Card className="border-border/80 bg-background">
							<CardHeader>
								<CardTitle className="text-lg">Buscar dirección</CardTitle>
								<CardDescription>
									Pega un enlace completo de Idealista.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<form
									className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
									onSubmit={(event) => {
										event.preventDefault();
										void resolveLocation();
									}}
								>
									<label className="sr-only" htmlFor={sourceUrlInputId}>
										URL del anuncio de Idealista
									</label>
									<Input
										id={sourceUrlInputId}
										type="url"
										value={sourceUrl}
										onChange={(event) =>
											handleSourceUrlChange(event.target.value)
										}
										placeholder="https://www.idealista.com/inmueble/108926410/"
										className="min-h-12 flex-1 text-base"
									/>
									<div className="flex gap-3">
										<div ref={historyContainerRef} className="relative">
											<Button
												type="button"
												variant="outline"
												aria-label="Ver búsquedas recientes"
												aria-expanded={isHistoryOpen}
												aria-haspopup="listbox"
												className="min-h-12 w-12 rounded-[0.85rem] px-0 transition-[background-color,border-color,color,transform] active:scale-[0.96]"
												onClick={() => setIsHistoryOpen((isOpen) => !isOpen)}
											>
												<History className="h-4 w-4" aria-hidden="true" />
											</Button>

											{isHistoryOpen ? (
												<div className="absolute right-0 top-[calc(100%+0.55rem)] z-30 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.1rem] bg-[#FFFBF2] shadow-[0_24px_80px_rgba(31,26,20,0.14),inset_0_0_0_1px_rgba(232,223,204,0.95)]">
													<div className="flex items-center justify-between gap-3 border-b border-[#E8DFCC] px-4 py-3">
														<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9C6137]">
															Historial
														</p>
														<p className="text-right text-xs leading-5 text-[#6F5E4A]">
															Últimas 10 búsquedas únicas.
														</p>
													</div>
													{searchHistory.length > 0 ? (
														<div className="relative">
														<ul
															ref={historyListRef}
															className="max-h-[18rem] overflow-y-auto px-2 pb-4 pt-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E8DFCC] [&::-webkit-scrollbar-track]:bg-transparent"
														>
															{searchHistory.map((entry) => {
																const entryLabel =
																	entry.resolvedAddressLabel ??
																	formatHistorySourceUrl(entry.sourceUrl);

																return (
																	<li
																		key={getHistoryUrlKey(entry.sourceUrl)}
																		className="group/row relative rounded-[0.9rem] transition-colors duration-200 hover:bg-[#FFF8EA] focus-within:bg-[#FFF8EA]"
																	>
																		<button
																			type="button"
																			className="group flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-2.5 text-left transition-transform duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-55"
																			disabled={
																				resolveIdealistaLocation.isPending
																			}
																			onClick={() =>
																				retrieveHistoryEntry(entry)
																			}
																		>
																			<span
																				className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] bg-[#F4E4CB] text-[#9C6137]"
																				aria-hidden="true"
																			>
																				{entry.thumbnailUrl ? (
																					// eslint-disable-next-line @next/next/no-img-element
																					<img
																						src={entry.thumbnailUrl}
																						alt=""
																						loading="lazy"
																						className="h-full w-full object-cover"
																					/>
																				) : (
																					<Building2
																						className="h-5 w-5"
																						aria-hidden="true"
																					/>
																				)}
																			</span>
																			<span className="min-w-0 flex-1">
																				<span className="block truncate text-sm font-medium text-[#1F1A14]">
																					{entryLabel}
																				</span>
																				<span className="mt-1 flex flex-wrap items-center gap-2 pr-9 text-[11px] leading-4 text-[#6F5E4A]">
																					<span>
																						{formatHistoryDate(entry)}
																					</span>
																				</span>
																			</span>
																		</button>
																		<button
																			type="button"
																			aria-label={`Eliminar ${entryLabel} del historial`}
																			className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-[0.6rem] text-[#9C6137] opacity-0 transition-[background-color,color,opacity,transform] duration-200 hover:bg-[#F4E4CB] hover:text-[#7A4524] focus-visible:opacity-100 active:scale-[0.92] disabled:pointer-events-none disabled:opacity-55 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
																			disabled={
																				resolveIdealistaLocation.isPending
																			}
																			onClick={(event) => {
																				event.stopPropagation();
																				removeHistoryEntry(entry);
																			}}
																		>
																			<Trash2
																				className="h-4 w-4"
																				aria-hidden="true"
																			/>
																		</button>
																	</li>
																);
															})}
														</ul>
														{historyScrollEdges.canScrollUp ? (
															<div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[#FFFBF2] via-[#FFFBF2]/80 to-transparent" />
														) : null}
														{historyScrollEdges.canScrollDown ? (
															<div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#FFFBF2] via-[#FFFBF2]/85 to-transparent" />
														) : null}
														</div>
													) : (
														<p className="p-4 text-sm leading-6 text-[#6F5E4A]">
															Todavía no hay búsquedas guardadas en este
															navegador.
														</p>
													)}
												</div>
											) : null}
										</div>

										<Button
											type="submit"
											className="min-h-12 flex-1 px-5 transition-[background-color,color,transform] active:scale-[0.96] sm:flex-none"
											disabled={
												resolveIdealistaLocation.isPending ||
												!sourceUrl.trim() ||
												!hasConfiguredStrategy
											}
										>
											{resolveIdealistaLocation.isPending ? (
												<LoaderCircle
													className="mr-2 h-4 w-4 animate-spin"
													aria-hidden="true"
												/>
											) : (
												<Search className="mr-2 h-4 w-4" aria-hidden="true" />
											)}
											Buscar
										</Button>
									</div>
								</form>

								{!hasConfiguredStrategy ? (
									<p className="mt-4 rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
										Localiza no está disponible ahora. Puedes crear el inmueble
										manualmente.
									</p>
								) : null}

								{error ? (
									<div className="mt-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										<AlertCircle
											className="mt-0.5 h-4 w-4"
											aria-hidden="true"
										/>
										<p>{error}</p>
									</div>
								) : null}

								{resolveIdealistaLocation.isPending && !result ? (
									<LocalizaLoadingComposer
										activeMessageIndex={activeLoadingMessageIndex}
									/>
								) : null}
							</CardContent>
						</Card>

						{result?.propertyDossier ? (
							<LocalizaPropertyReport
								dossier={result.propertyDossier}
								result={result}
							/>
						) : null}
					</>
				) : (
					<LocalizaProspectingScaffold />
				)}

				{activeTab === "resolver" && result ? (
					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								{result.status === "unresolved" ? (
									<AlertCircle
										className="h-5 w-5 text-muted-foreground"
										aria-hidden="true"
									/>
								) : (
									<CheckCircle2
										className="h-5 w-5 text-primary"
										aria-hidden="true"
									/>
								)}
								{visibleResultCopy?.label}
							</CardTitle>
							<CardDescription>
								{visibleResultCopy?.description}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{resolvedAddress && result.status !== "needs_confirmation" ? (
								<div className="flex items-start gap-3 rounded-md border border-border/70 p-3">
									<MapPin
										className="mt-0.5 h-4 w-4 text-primary"
										aria-hidden="true"
									/>
									<div>
										<p className="font-medium text-foreground">
											{resolvedAddress}
										</p>
										<p className="mt-1 text-sm text-muted-foreground">
											Fuente oficial: {result.officialSource}
										</p>
										{addressRationale ? (
											<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
												{addressRationale}
											</p>
										) : null}
									</div>
								</div>
							) : null}

							{result.status === "needs_confirmation" &&
							result.candidates.length > 0 ? (
								<div className="space-y-3">
									<p className="text-sm text-muted-foreground">
										Selecciona la dirección oficial que corresponde al anuncio.
									</p>
									<fieldset className="grid gap-2">
										<legend className="sr-only">
											Direcciones oficiales posibles
										</legend>
										{result.candidates.map((candidate, index) => {
											const isSelected = selectedCandidateId === candidate.id;
											const candidateMeta = getCandidateMeta(candidate);
											const isDisabled = Boolean(candidate.selectionDisabled);
											const rationale = candidate.rationale;

											return (
												<label
													key={candidate.id}
													htmlFor={`${candidateFieldId}-candidate-${index}`}
													className={`flex items-start gap-3 rounded-[0.95rem] p-3 text-sm transition-[background-color,box-shadow,transform] duration-200 ${
														isDisabled
															? "cursor-not-allowed bg-background opacity-75 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]"
															: `cursor-pointer active:scale-[0.985] ${
																	isSelected
																		? "bg-[#FFF8EA] shadow-[0_0_0_1px_rgba(156,97,55,0.35),0_14px_36px_rgba(31,26,20,0.07)]"
																		: "bg-background shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)] hover:bg-[#FFF8EA]/70"
																}`
													}`}
												>
													<input
														id={`${candidateFieldId}-candidate-${index}`}
														type="radio"
														name={`${candidateFieldId}-candidate`}
														value={candidate.id}
														checked={isSelected}
														disabled={isDisabled}
														onChange={() =>
															setSelectedCandidateId(candidate.id)
														}
														className="sr-only"
													/>
													<span
														className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
															isSelected
																? "bg-primary text-primary-foreground"
																: "shadow-[inset_0_0_0_1px_rgba(156,97,55,0.35)]"
														}`}
														aria-hidden="true"
													>
														{isSelected ? (
															<CheckCircle2 className="h-3.5 w-3.5" />
														) : null}
													</span>
													<span className="min-w-0 flex-1">
														<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
															<span className="font-medium text-foreground">
																{candidate.label}
															</span>
															{isDisabled ? (
																<span className="text-xs font-medium text-destructive">
																	Descartada
																</span>
															) : null}
														</span>
														{candidateMeta.length > 0 ? (
															<span className="mt-1 block text-xs leading-5 text-muted-foreground">
																{candidateMeta.join(" · ")}
															</span>
														) : null}
														{rationale ? (
															<span className="mt-2 block text-xs leading-5 text-muted-foreground">
																<span className="font-medium text-foreground">
																	{rationale.title}:{" "}
																</span>
																{rationale.description}
																{isBrowserUrl(rationale.sourceUrl) ? (
																	<>
																		{" "}
																		<a
																			href={rationale.sourceUrl}
																			target="_blank"
																			rel="noreferrer"
																			className="text-primary underline underline-offset-4"
																		>
																			{rationale.sourceLabel ?? "Fuente"}
																		</a>
																	</>
																) : null}
															</span>
														) : null}
													</span>
												</label>
											);
										})}
									</fieldset>
								</div>
							) : null}

							{result.status === "needs_confirmation" &&
							result.candidates.length === 0 ? (
								<div className="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
									No hay una opción oficial seleccionable. Crea el inmueble y
									completa la dirección manualmente.
								</div>
							) : null}

							<div className="border-t border-[#E8DFCC] pt-4">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<p className="text-sm font-medium text-foreground">
											¿Esta lectura es correcta?
										</p>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											Tu respuesta alimenta el conjunto de regresión de
											Localiza.
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant={
												addressFeedbackVerdict === "correct"
													? "default"
													: "outline"
											}
											disabled={
												!feedbackSelectedAddressLabel ||
												submitAddressFeedback.isPending
											}
											onClick={() => {
												void submitLocalizaAddressFeedback("correct");
											}}
										>
											Correcta
										</Button>
										<Button
											type="button"
											variant={
												addressFeedbackVerdict === "incorrect"
													? "default"
													: "outline"
											}
											disabled={submitAddressFeedback.isPending}
											onClick={() => {
												setAddressFeedbackVerdict("incorrect");
												setAddressFeedbackMessage(null);
												setAddressFeedbackError(null);
											}}
										>
											Corregir
										</Button>
									</div>
								</div>

								{addressFeedbackVerdict === "incorrect" ? (
									<form
										className="mt-3 grid gap-2"
										onSubmit={(event) => {
											event.preventDefault();
											void submitLocalizaAddressFeedback("incorrect");
										}}
									>
										<label
											className="text-xs font-medium text-foreground"
											htmlFor={`${candidateFieldId}-corrected-address`}
										>
											Dirección correcta
										</label>
										<Textarea
											id={`${candidateFieldId}-corrected-address`}
											value={correctedAddressLabel}
											onChange={(event) =>
												setCorrectedAddressLabel(event.target.value)
											}
											placeholder="Calle, número, planta, puerta, código postal y municipio."
											className="min-h-20"
										/>
										<div>
											<Button
												type="submit"
												variant="outline"
												disabled={submitAddressFeedback.isPending}
											>
												Guardar corrección
											</Button>
										</div>
									</form>
								) : null}

								{addressFeedbackMessage ? (
									<p className="mt-3 text-xs font-medium text-primary">
										{addressFeedbackMessage}
									</p>
								) : null}
								{addressFeedbackError ? (
									<p className="mt-3 text-xs font-medium text-destructive">
										{addressFeedbackError}
									</p>
								) : null}
							</div>

							<div className="flex flex-wrap gap-3">
								{createHref ? (
									<Button
										asChild
										className="transition-[background-color,color,transform] active:scale-[0.96]"
									>
										<Link href={createHref}>
											{result.status === "needs_confirmation"
												? "Crear inmueble con esta dirección"
												: "Crear inmueble"}
											<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
										</Link>
									</Button>
								) : null}
								{directOfficialPropertyUrl ? (
									<Button
										asChild
										variant="outline"
										className="transition-[background-color,border-color,color,transform] active:scale-[0.96]"
									>
										<a
											href={directOfficialPropertyUrl}
											target="_blank"
											rel="noreferrer"
										>
											Ficha oficial
											<ExternalLink
												className="ml-2 h-4 w-4"
												aria-hidden="true"
											/>
										</a>
									</Button>
								) : null}
							</div>
						</CardContent>
					</Card>
				) : null}
			</div>
		</main>
	);
}
