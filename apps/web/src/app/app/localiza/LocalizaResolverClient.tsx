"use client";

import type {
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
} from "@casedra/ui";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	CheckCircle2,
	Database,
	ExternalLink,
	FileSearch,
	ListChecks,
	LoaderCircle,
	MapPin,
	Radar,
	Search,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
		label: "Elige una opción",
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

const resolverStages = [
	{
		key: "parse",
		label: "Normalizando enlace",
		description:
			"Localiza extrae la referencia del anuncio y trabaja con una URL canónica.",
		icon: FileSearch,
	},
		{
			key: "cache",
			label: "Revisando trabajo reciente",
			description:
				"Comprueba si este anuncio ya se resolvió hace poco para evitar repetir trabajo.",
			icon: Database,
		},
		{
			key: "acquire",
			label: "Leyendo señales del anuncio",
			description:
				"Lee el anuncio para recuperar coordenadas, municipio y pistas postales.",
			icon: Radar,
		},
	{
		key: "catastro",
		label: "Consultando fuente oficial",
		description:
			"Contrasta esas señales con Catastro o el registro territorial correspondiente.",
		icon: Building2,
	},
	{
		key: "verify",
		label: "Midiendo confianza",
		description:
			"Compara candidatos oficiales y separa coincidencia exacta, edificio o confirmación manual.",
		icon: ShieldCheck,
	},
		{
			key: "persist",
			label: "Preparando resultado",
			description:
				"Guarda el resultado para crear el inmueble sin perder el trabajo.",
			icon: ListChecks,
		},
] as const;

const RESOLVER_STAGE_INTERVAL_MS = 1800;

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

const buildOnboardingHref = (sourceUrl: string) =>
	`/app/onboarding?step=listings&sourceUrl=${encodeURIComponent(sourceUrl)}`;

const formatSourceUrlPreview = (url: string) =>
	url
		.replace(/^https?:\/\/(www\.)?/i, "")
		.replace(/\/$/, "")
		.slice(0, 56);

function LocalizaProgressPanel({
	activeStageIndex,
	sourceUrl,
}: {
	activeStageIndex: number;
	sourceUrl: string;
}) {
	const normalizedStageIndex = activeStageIndex % resolverStages.length;
	const activeStage = resolverStages[normalizedStageIndex] ?? resolverStages[0];
	const ActiveStageIcon = activeStage.icon;
	const progressWidth = `${((normalizedStageIndex + 1) / resolverStages.length) * 100}%`;
	const sourceUrlPreview = formatSourceUrlPreview(sourceUrl);

	return (
		<Card className="overflow-hidden rounded-[1.5rem] border-border/80 bg-background shadow-[0_22px_70px_rgba(31,26,20,0.08)]">
			<CardContent className="p-0">
				<div className="relative overflow-hidden p-5 sm:p-6">
					<div
						className="localiza-scan-line absolute inset-x-0 top-0 h-px bg-primary/70"
						aria-hidden="true"
					/>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
						<div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-primary/10 text-primary shadow-[0_10px_30px_rgba(156,97,55,0.14)]">
							<span
								className="absolute inset-0 rounded-[1rem] ring-1 ring-primary/20"
								aria-hidden="true"
							/>
							<ActiveStageIcon
								key={activeStage.key}
								className="localiza-icon-swap h-5 w-5"
								aria-hidden="true"
							/>
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
									Resolviendo dirección
								</p>
								<span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
									<span className="tabular-nums">
										{normalizedStageIndex + 1}
									</span>
									/{resolverStages.length}
								</span>
							</div>
							<h2 className="mt-2 text-xl font-semibold text-foreground [text-wrap:balance]">
								{activeStage.label}
							</h2>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground [text-wrap:pretty]">
								{activeStage.description}
							</p>
							<div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
								<span className="rounded-full bg-secondary/80 px-3 py-1.5">
									{sourceUrlPreview || "Idealista"}
								</span>
							</div>
						</div>
					</div>

					<div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
							style={{ width: progressWidth }}
						/>
					</div>

					<ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{resolverStages.map((stage, index) => {
							const StageIcon = stage.icon;
							const isActive = index === normalizedStageIndex;
							const isComplete = index < normalizedStageIndex;

							return (
								<li
									key={stage.key}
									className={[
										"rounded-[0.95rem] px-3 py-3 text-sm transition-[background-color,box-shadow,opacity,transform] duration-300",
										isActive
											? "bg-primary/10 text-foreground shadow-[0_12px_32px_rgba(156,97,55,0.12)]"
											: "bg-secondary/60 text-muted-foreground",
										isComplete ? "opacity-85" : "opacity-100",
									].join(" ")}
								>
									<div className="flex items-center gap-2">
										<span
											className={[
												"flex h-7 w-7 items-center justify-center rounded-[0.6rem]",
												isActive || isComplete
													? "bg-primary/10 text-primary"
													: "bg-background text-muted-foreground",
											].join(" ")}
										>
											{isComplete ? (
												<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
											) : (
												<StageIcon className="h-3.5 w-3.5" aria-hidden="true" />
											)}
										</span>
										<span className="font-medium">{stage.label}</span>
									</div>
								</li>
							);
						})}
					</ol>

				</div>
			</CardContent>
		</Card>
	);
}

export default function LocalizaResolverClient({
	availableLocalizaStrategies,
	initialSourceUrl = "",
}: LocalizaResolverClientProps) {
	const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
	const [result, setResult] = useState<ResolveIdealistaLocationResult | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const hasTrackedLocalizaUrlPasteRef = useRef(false);
	const requestSequenceRef = useRef(0);
	const resolveIdealistaLocation =
		trpc.listings.resolveIdealistaLocation.useMutation();
	const strategyOptions = useMemo(
		() => buildLocalizaStrategyOptions(availableLocalizaStrategies),
		[availableLocalizaStrategies],
	);
	const hasConfiguredStrategy = strategyOptions.length > 0;
	const resolvedAddress =
		result?.resolvedAddressLabel ?? formatAddress(result?.prefillLocation);
	const visibleResultCopy = result ? getResultCopy(result) : null;
	const currentSourceUrl = result?.sourceMetadata.sourceUrl ?? sourceUrl.trim();
	const [activeStageIndex, setActiveStageIndex] = useState(0);
	const effectiveStrategy =
		getPreferredLocalizaStrategy("auto", availableLocalizaStrategies) ?? "auto";

	useEffect(() => {
		if (!resolveIdealistaLocation.isPending) {
			setActiveStageIndex(0);
			return;
		}

		setActiveStageIndex(0);
		const intervalId = window.setInterval(() => {
			setActiveStageIndex(
				(currentIndex) => (currentIndex + 1) % resolverStages.length,
			);
		}, RESOLVER_STAGE_INTERVAL_MS);

		return () => window.clearInterval(intervalId);
	}, [resolveIdealistaLocation.isPending]);

	const handleSourceUrlChange = (value: string) => {
		requestSequenceRef.current += 1;
		setSourceUrl(value);
		setResult(null);
		setError(null);

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

	const resolveLocation = async () => {
		const trimmedSourceUrl = sourceUrl.trim();
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
			setError(null);
			setResult(null);
			const resolved = await resolveIdealistaLocation.mutateAsync({
				url: trimmedSourceUrl,
				strategy: requestedStrategy,
			});

			if (requestSequenceRef.current !== requestSequence) {
				return;
			}

			setResult(resolved);
			setSourceUrl(resolved.sourceMetadata.sourceUrl);
			capturePosthogEvent(
				resolved.status === "unresolved"
					? "localiza_resolve_unresolved"
					: "localiza_resolve_success",
				{
					requestedStrategy: resolved.requestedStrategy,
					actualAcquisitionMethod:
						resolved.evidence.actualAcquisitionMethod,
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
						Pega un enlace de Idealista.
					</h1>
					<p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
						Localiza intenta convertir el anuncio en una dirección oficial y
						auditable. Si no puede verificarla, deja el inmueble para entrada
						manual.
					</p>
				</header>

				<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="text-lg">Buscar dirección</CardTitle>
							<CardDescription>
								Pega un enlace completo de Idealista.
							</CardDescription>
						</CardHeader>
					<CardContent>
						<form
							className="flex flex-col gap-3 sm:flex-row"
							onSubmit={(event) => {
								event.preventDefault();
								void resolveLocation();
							}}
						>
							<label className="sr-only" htmlFor="localiza-source-url">
								URL del anuncio de Idealista
							</label>
							<Input
								id="localiza-source-url"
								type="url"
								value={sourceUrl}
								onChange={(event) => handleSourceUrlChange(event.target.value)}
								placeholder="https://www.idealista.com/inmueble/108926410/"
								className="min-h-12 flex-1 text-base"
							/>
							<Button
								type="submit"
								className="min-h-12 px-5 transition-[background-color,color,transform] active:scale-[0.96]"
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
						</form>

							{!hasConfiguredStrategy ? (
								<p className="mt-4 rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
									Localiza no está disponible ahora. Puedes crear el inmueble
									manualmente.
								</p>
							) : null}

						{error ? (
							<div className="mt-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								<AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
								<p>{error}</p>
							</div>
						) : null}
					</CardContent>
				</Card>

				{resolveIdealistaLocation.isPending ? (
					<LocalizaProgressPanel
						activeStageIndex={activeStageIndex}
						sourceUrl={sourceUrl.trim()}
					/>
				) : null}

				{result?.propertyDossier ? (
					<LocalizaPropertyReport dossier={result.propertyDossier} result={result} />
				) : null}

				{result ? (
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
							{resolvedAddress ? (
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
									</div>
								</div>
							) : null}

							{result.status === "needs_confirmation" &&
							result.candidates.length > 0 ? (
								<div className="grid gap-2">
									{result.candidates.map((candidate) => (
										<div
											key={candidate.id}
											className="rounded-md border border-border/70 p-3 text-sm"
										>
												<p className="font-medium text-foreground">
													{candidate.label}
												</p>
											</div>
										))}
									</div>
								) : null}

								<div className="flex flex-wrap gap-3">
								<Button
									asChild
									className="transition-[background-color,color,transform] active:scale-[0.96]"
								>
									<Link href={buildOnboardingHref(currentSourceUrl)}>
										Crear inmueble
										<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
								{result.officialSourceUrl ? (
									<Button
										asChild
										variant="outline"
										className="transition-[background-color,border-color,color,transform] active:scale-[0.96]"
									>
										<a
											href={result.officialSourceUrl}
											target="_blank"
											rel="noreferrer"
										>
											Fuente oficial
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
