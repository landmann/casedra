import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Textarea,
} from "@casedra/ui";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { auth } from "@clerk/nextjs/server";
import { makeFunctionReference } from "convex/server";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	DatabaseZap,
	MinusCircle,
	Radar,
	ShieldCheck,
	Timer,
} from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createConvexClient } from "@/server/convexClient";
import { resolveIdealistaLocation } from "@/server/localiza/resolver";
import { getLocalizaReadinessSnapshot } from "@/server/localiza/readiness";

const percentFormatter = new Intl.NumberFormat("es-ES", {
	style: "percent",
	maximumFractionDigits: 1,
});

const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
	maximumFractionDigits: 0,
});
const secondsFormatter = new Intl.NumberFormat("es-ES", {
	maximumFractionDigits: 1,
});

type LocalizaIncidentSummary = {
	_id: string;
	sourceUrl: string;
	externalListingId?: string;
	resolverVersion?: string;
	resultStatus?:
		| "exact_match"
		| "building_match"
		| "needs_confirmation"
		| "unresolved"
		| "manual_override";
	notes?: string;
	status: "open" | "resolved";
	createdAt: number;
	resolvedAt?: number;
};

const listFalsePositiveIncidentsRef = makeFunctionReference<
	"query",
	{ status?: "open" | "resolved" },
	LocalizaIncidentSummary[]
>("locationResolutions:listFalsePositiveIncidents");

const reportFalsePositiveIncidentRef = makeFunctionReference<
	"mutation",
	{
		sourceUrl: string;
		externalListingId?: string;
		resolverVersion?: string;
		resultStatus?:
			| "exact_match"
			| "building_match"
			| "needs_confirmation"
			| "unresolved"
			| "manual_override";
		notes?: string;
		now: number;
	},
	{ id: string }
>("locationResolutions:reportFalsePositiveIncident");

const resolveFalsePositiveIncidentRef = makeFunctionReference<
	"mutation",
	{
		id: string;
		resolutionNotes?: string;
		now: number;
	},
	{ id: string }
>("locationResolutions:resolveFalsePositiveIncident");

const pruneExpiredLocationResolutionsRef = makeFunctionReference<
	"mutation",
	{
		now: number;
		limit?: number;
	},
	{ deleted: number; hasMore: boolean }
>("locationResolutions:pruneExpired");

type LocalizaLiveFixtureRecord = {
	_id: string;
	fixtureId: string;
	sourceUrl: string;
	expectedStatus:
		| "exact_match"
		| "building_match"
		| "needs_confirmation"
		| "unresolved";
	territoryAdapter:
		| "state_catastro"
		| "navarra_rtn"
		| "alava_catastro"
		| "bizkaia_catastro"
		| "gipuzkoa_catastro";
	humanUnitResolvable: boolean;
	expectedLocation: {
		street: string;
		city: string;
		stateOrProvince: string;
		country: string;
		postalCode?: string;
	};
	validationStatus: "pending_official_validation" | "officially_validated";
	lastValidationRunAt?: string;
	lastObservedStatus?:
		| "exact_match"
		| "building_match"
		| "needs_confirmation"
		| "unresolved";
	lastObservedTerritoryAdapter?:
		| "state_catastro"
		| "navarra_rtn"
		| "alava_catastro"
		| "bizkaia_catastro"
		| "gipuzkoa_catastro";
	lastObservedReasonCodes?: string[];
	observedAt: string;
	validationNotes: string;
	source: "seed" | "incident_auto_added";
	updatedAt: number;
};

const listLiveFixturesRef = makeFunctionReference<
	"query",
	Record<string, never>,
	LocalizaLiveFixtureRecord[]
>("localizaGoldenLiveFixtures:list");

const markLiveFixtureValidatedRef = makeFunctionReference<
	"mutation",
	{
		fixtureId: string;
		validationNotes?: string;
		now?: number;
	},
	{ id: string }
>("localizaGoldenLiveFixtures:markOfficiallyValidated");

const recordLiveFixtureObservationRef = makeFunctionReference<
	"mutation",
	{
		fixtureId: string;
		lastObservedStatus:
			| "exact_match"
			| "building_match"
			| "needs_confirmation"
			| "unresolved";
		lastObservedTerritoryAdapter?:
			| "state_catastro"
			| "navarra_rtn"
			| "alava_catastro"
			| "bizkaia_catastro"
			| "gipuzkoa_catastro";
		lastObservedReasonCodes?: string[];
		lastValidationRunAt: string;
		now?: number;
	},
	{ id: string }
>("localizaGoldenLiveFixtures:recordObservation");

const blockerCopy: Record<string, string> = {
	localiza_convex_auth_unavailable:
		"No se pudo abrir la sesión de trabajo. Revisa la configuración de acceso.",
	localiza_false_positive_incident_reported:
		"Hay una dirección marcada como incorrecta. Corrígela antes de ampliar el acceso.",
	localiza_firecrawl_not_configured:
		"No podemos leer anuncios ahora mismo. Revisa la conexión de lectura.",
	localiza_live_regression_set_pending_official_validation:
		"Faltan pruebas con anuncios reales antes de ampliar el acceso.",
	localiza_metrics_unavailable:
		"No podemos medir el rendimiento ahora mismo. Amplía el acceso cuando vuelva la medición.",
	localiza_timeout_rate_threshold_breached:
		"Demasiadas búsquedas tardan demasiado.",
	localiza_unresolved_rate_threshold_breached:
		"Demasiadas direcciones quedan sin confirmar.",
};

const formatBlocker = (blocker: string) =>
	blockerCopy[blocker] ??
	"Hay un bloqueo sin texto público. Revisa la configuración interna.";

const formatDuration = (durationMs: number | null) => {
	if (durationMs === null) {
		return "Sin datos";
	}

	if (durationMs < 1000) {
		return "Menos de 1 s";
	}

	return `${secondsFormatter.format(durationMs / 1000)} s`;
};

type ConvexTokenGetter = (options: {
	template: "convex";
}) => Promise<string | null>;

const isMissingConvexJwtTemplateError = (error: unknown) =>
	error instanceof Error &&
	error.message.includes("No JWT template exists with name: convex");

const getConvexAuthToken = async (getToken: ConvexTokenGetter) => {
	try {
		return await getToken({ template: "convex" });
	} catch (error) {
		if (
			isMissingConvexJwtTemplateError(error) ||
			(isClerkAPIResponseError(error) && error.status === 404)
		) {
			return null;
		}

		throw error;
	}
};

const incidentStatusOptions = [
	"exact_match",
	"building_match",
	"needs_confirmation",
	"unresolved",
	"manual_override",
] as const;

const incidentStatusLabel: Record<
	(typeof incidentStatusOptions)[number],
	string
> = {
	exact_match: "Dirección exacta",
	building_match: "Edificio",
	needs_confirmation: "Opciones",
	unresolved: "No encontrada",
	manual_override: "Editada a mano",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
	dateStyle: "medium",
	timeStyle: "short",
});

const normalizeOptionalText = (value: FormDataEntryValue | null) => {
	const normalized = typeof value === "string" ? value.trim() : "";
	return normalized.length > 0 ? normalized : undefined;
};

const normalizeIncidentStatus = (value: FormDataEntryValue | null) => {
	const normalized = normalizeOptionalText(value);
	return incidentStatusOptions.find((status) => status === normalized);
};

const getActionConvexClient = async () => {
	const { getToken, userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	const convexAuthToken = await getConvexAuthToken(getToken);

	if (!convexAuthToken) {
		throw new Error("No se pudo abrir la sesión de trabajo.");
	}

	return createConvexClient(convexAuthToken);
};

const reportFalsePositiveIncidentAction = async (formData: FormData) => {
	"use server";

	const sourceUrl = normalizeOptionalText(formData.get("sourceUrl"));

	if (!sourceUrl) {
		throw new Error("La URL del anuncio es obligatoria.");
	}

	const convex = await getActionConvexClient();
	await convex.mutation(reportFalsePositiveIncidentRef, {
		sourceUrl,
		externalListingId: normalizeOptionalText(formData.get("externalListingId")),
		resolverVersion: normalizeOptionalText(formData.get("resolverVersion")),
		resultStatus: normalizeIncidentStatus(formData.get("resultStatus")),
		notes: normalizeOptionalText(formData.get("notes")),
		now: Date.now(),
	});
	revalidatePath("/app/localiza/readiness");
};

const resolveFalsePositiveIncidentAction = async (formData: FormData) => {
	"use server";

	const id = normalizeOptionalText(formData.get("incidentId"));

	if (!id) {
		throw new Error("Falta el incidente.");
	}

	const convex = await getActionConvexClient();
	await convex.mutation(resolveFalsePositiveIncidentRef, {
		id,
		resolutionNotes: normalizeOptionalText(formData.get("resolutionNotes")),
		now: Date.now(),
	});
	revalidatePath("/app/localiza/readiness");
};

const pruneExpiredCacheAction = async () => {
	"use server";

	const convex = await getActionConvexClient();
	await convex.mutation(pruneExpiredLocationResolutionsRef, {
		now: Date.now(),
		limit: 100,
	});
	revalidatePath("/app/localiza/readiness");
};

const markLiveFixtureValidatedAction = async (formData: FormData) => {
	"use server";

	const fixtureId = normalizeOptionalText(formData.get("fixtureId"));
	if (!fixtureId) {
		throw new Error("Falta el identificador de la prueba.");
	}

	const convex = await getActionConvexClient();
	await convex.mutation(markLiveFixtureValidatedRef, {
		fixtureId,
		validationNotes: normalizeOptionalText(formData.get("validationNotes")),
		now: Date.now(),
	});
	revalidatePath("/app/localiza/readiness");
};

const rerunLiveFixturesAction = async () => {
	"use server";

	const { getToken, userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	const convexAuthToken = await getConvexAuthToken(getToken);
	if (!convexAuthToken) {
		throw new Error("No se pudo abrir la sesión de trabajo.");
	}

	const convex = createConvexClient(convexAuthToken);
	const fixtures = await convex.query(listLiveFixturesRef, {});

	for (const fixture of fixtures) {
		if (fixture.validationStatus === "officially_validated") {
			continue;
		}

		try {
			const result = await resolveIdealistaLocation({
				convex,
				url: fixture.sourceUrl,
				strategy: "auto",
				userId,
			});

			await convex.mutation(recordLiveFixtureObservationRef, {
				fixtureId: fixture.fixtureId,
				lastObservedStatus: result.status,
				lastObservedTerritoryAdapter: result.territoryAdapter,
				lastObservedReasonCodes: result.evidence.reasonCodes.slice(0, 8),
				lastValidationRunAt: new Date().toISOString(),
				now: Date.now(),
			});
		} catch {
			await convex.mutation(recordLiveFixtureObservationRef, {
				fixtureId: fixture.fixtureId,
				lastObservedStatus: "unresolved",
				lastObservedReasonCodes: ["live_revalidation_threw"],
				lastValidationRunAt: new Date().toISOString(),
				now: Date.now(),
			});
		}
	}

	revalidatePath("/app/localiza/readiness");
};

const unsupportedBetaCases: Array<{ title: string; detail: string }> = [
	{
		title: "Otros portales",
		detail:
			"Ahora solo revisamos enlaces de idealista.com. Para otros portales, escribe la dirección a mano.",
	},
	{
		title: "Anuncios fuera de España",
		detail:
			"Ahora solo trabajamos con anuncios de España.",
	},
	{
		title: "Dirección demasiado oculta",
		detail:
			"Si el anuncio no muestra suficientes datos, no adivinamos. Te pediremos escribir la dirección.",
	},
	{
		title: "Piso o puerta sin prueba clara",
		detail:
			"Si solo podemos confirmar el edificio, te pediremos revisar el piso o puerta antes de guardar.",
	},
	{
		title: "Más caminos de búsqueda",
		detail:
			"Usaremos nuevos caminos de búsqueda cuando estén aprobados. Hoy solo usamos el camino abierto para esta versión.",
	},
	{
		title: "Búsqueda masiva",
		detail:
			"Revisamos una URL cada vez. No rastreamos ciudades, no buscamos propietarios y no contactamos a nadie.",
	},
];

export default async function LocalizaReadinessPage() {
	const { getToken, userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	const convexAuthToken = await getConvexAuthToken(getToken);
	const convex = createConvexClient(convexAuthToken);

	const snapshot = await getLocalizaReadinessSnapshot({
		convex,
	});
	const openIncidents = convexAuthToken
		? await convex.query(listFalsePositiveIncidentsRef, { status: "open" })
		: [];
	const liveFixtures = convexAuthToken
		? await convex.query(listLiveFixturesRef, {})
		: [];
	const authBlockers = convexAuthToken
		? []
		: ["localiza_convex_auth_unavailable"];
	const effectiveBlockers = Array.from(
		new Set([...authBlockers, ...snapshot.blockers]),
	);
	const isReady = effectiveBlockers.length === 0;
	const readinessIcon = isReady ? CheckCircle2 : AlertTriangle;
	const ReadinessIcon = readinessIcon;
	const visibleBlockers =
		effectiveBlockers.length > 0
			? effectiveBlockers.map(formatBlocker)
			: ["No hay bloqueos activos."];
	const metricCards = [
		{
			label: "Direcciones revisadas",
			value: compactNumberFormatter.format(
				snapshot.metrics.counts.attempts ?? 0,
			),
			icon: Radar,
		},
		{
			label: "Encontradas",
			value: percentFormatter.format(snapshot.metrics.rates.success ?? 0),
			icon: CheckCircle2,
		},
		{
			label: "Sin confirmar",
			value: percentFormatter.format(snapshot.metrics.rates.unresolved ?? 0),
			icon: AlertTriangle,
		},
		{
			label: "Tiempo típico",
			value: formatDuration(snapshot.metrics.durations.medianMs),
			icon: Timer,
		},
	] as const;

	return (
		<main className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border/80 bg-background/90">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-3">
						<Button
							asChild
							variant="ghost"
							className="h-auto justify-start px-0"
						>
							<Link
								href="/app/localiza"
								className="inline-flex items-center gap-2"
							>
								<ArrowLeft className="h-4 w-4" aria-hidden="true" />
								Volver a Localiza
							</Link>
						</Button>
						<div>
							<p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
								Verificación de direcciones
							</p>
							<h1 className="mt-3 font-serif text-[2.8rem] font-normal leading-tight sm:text-[4rem]">
								¿Listo para más cuentas?
							</h1>
							<p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
								Comprueba si la búsqueda de direcciones está funcionando bien
								antes de abrirla a más usuarios.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
						<ReadinessIcon
							className={`h-5 w-5 ${isReady ? "text-primary" : "text-destructive"}`}
							aria-hidden="true"
						/>
						<div>
							<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
								Más cuentas
							</p>
							<p className="text-lg font-semibold">
								{isReady ? "Listo para abrir" : "No abrir todavía"}
							</p>
						</div>
					</div>
				</div>
			</header>

			<div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
				<section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<ShieldCheck
									className="h-5 w-5 text-primary"
									aria-hidden="true"
								/>
								Qué está activo
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
							<div>
								<p className="text-xs font-medium uppercase tracking-[0.2em]">
									Entrada
								</p>
								<p className="mt-2 text-base font-semibold text-foreground">
									Un enlace cada vez
								</p>
							</div>
							<div>
								<p className="text-xs font-medium uppercase tracking-[0.2em]">
									Búsqueda
								</p>
								<p className="mt-2 text-base font-semibold text-foreground">
									Automática
								</p>
							</div>
							<div>
								<p className="text-xs font-medium uppercase tracking-[0.2em]">
									Estado
								</p>
								<p className="mt-2 text-base font-semibold text-foreground">
									{snapshot.acquisitionContract.configuredStrategies.length > 0
										? "Disponible"
										: "No disponible"}
								</p>
							</div>
						</CardContent>
					</Card>

					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="text-lg">Qué impide abrirlo</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2 text-sm text-muted-foreground">
								{visibleBlockers.map((blocker) => (
									<li
										key={blocker}
										className="rounded-md border border-border/70 p-3"
									>
										{blocker}
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{metricCards.map((metric) => {
						const Icon = metric.icon;

						return (
							<Card
								key={metric.label}
								className="border-border/80 bg-background"
							>
								<CardHeader className="space-y-3">
									<Icon className="h-5 w-5 text-primary" aria-hidden="true" />
									<CardTitle className="text-sm font-medium text-muted-foreground">
										{metric.label}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-2xl font-semibold">{metric.value}</p>
								</CardContent>
							</Card>
						);
					})}
				</section>

				<section className="grid gap-4 lg:grid-cols-2">
					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="text-lg">Pruebas de direcciones</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
							<p>
								Casos revisados:{" "}
								<span className="font-semibold text-foreground">
									{snapshot.goldenDataset.summary.fixtureCount}
								</span>
							</p>
							<p>
								Probadas hoy:{" "}
								<span className="font-semibold text-foreground">
									{
										snapshot.goldenDataset.summary
											.liveOfficiallyValidatedFixtureCount
									}{" "}
									/ {snapshot.goldenDataset.summary.liveFixtureCount}
								</span>
							</p>
							<p>
								Edificio encontrado:{" "}
								<span className="font-semibold text-foreground">
									{percentFormatter.format(
										snapshot.goldenDataset.summary.hiddenBuildingOrBetterRate,
									)}
								</span>
							</p>
							<p>
								Dirección exacta:{" "}
								<span className="font-semibold text-foreground">
									{percentFormatter.format(
										snapshot.goldenDataset.summary.humanUnitExactRate,
									)}
								</span>
							</p>
						</CardContent>
					</Card>

					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="text-lg">Alertas</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap gap-2 text-xs">
								{snapshot.metrics.alerts.length > 0 ? (
									<span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-destructive">
										{snapshot.metrics.alerts.length === 1
											? "Hay una alerta activa"
											: `Hay ${snapshot.metrics.alerts.length} alertas activas`}
									</span>
								) : (
									<span className="rounded-full border border-border px-3 py-1.5 text-muted-foreground">
										No hay alertas activas
									</span>
								)}
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<DatabaseZap
									className="h-5 w-5 text-primary"
									aria-hidden="true"
								/>
								Caché
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Borra resultados caducados sin tocar direcciones ya guardadas.
							</p>
						</CardHeader>
						<CardContent>
							<form action={pruneExpiredCacheAction}>
								<Button type="submit" disabled={!convexAuthToken}>
									Borrar caducados
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="text-lg">
								Direcciones marcadas como incorrectas
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Un caso abierto bloquea ampliar el acceso hasta que se cierre.
							</p>
						</CardHeader>
						<CardContent className="space-y-5">
							<form
								action={reportFalsePositiveIncidentAction}
								className="grid gap-3 rounded-md border border-border/70 p-3"
							>
								<div className="grid gap-3 sm:grid-cols-2">
									<label className="text-sm font-medium text-foreground">
										URL del anuncio
										<Input
											name="sourceUrl"
											type="url"
											placeholder="https://www.idealista.com/inmueble/..."
											required
											className="mt-2"
										/>
									</label>
									<label className="text-sm font-medium text-foreground">
										Referencia de Idealista
										<Input
											name="externalListingId"
											placeholder="110411564"
											className="mt-2"
										/>
									</label>
									<label className="text-sm font-medium text-foreground">
										Versión
										<Input
											name="resolverVersion"
											placeholder="localiza-bootstrap-2026-04-23.7"
											className="mt-2"
										/>
									</label>
									<label className="text-sm font-medium text-foreground">
										Resultado
										<select
											name="resultStatus"
											className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
											defaultValue=""
										>
											<option value="">Sin indicar</option>
											{incidentStatusOptions.map((status) => (
												<option key={status} value={status}>
													{incidentStatusLabel[status]}
												</option>
											))}
										</select>
									</label>
								</div>
								<label className="text-sm font-medium text-foreground">
									Notas
									<Textarea
										name="notes"
										placeholder="Qué se rellenó mal y cuál es la dirección correcta."
										className="mt-2"
									/>
								</label>
								<div>
									<Button type="submit" disabled={!convexAuthToken}>
										Marcar incorrecta
									</Button>
								</div>
							</form>

							<div className="space-y-3">
								{openIncidents.length > 0 ? (
									openIncidents.map((incident) => (
										<div
											key={incident._id}
											className="rounded-md border border-border/70 p-3 text-sm"
										>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
												<div className="space-y-1">
													<p className="font-medium text-foreground">
														{incident.externalListingId ?? "Sin referencia"}
													</p>
													<p className="break-all text-muted-foreground">
														{incident.sourceUrl}
													</p>
													<p className="text-xs text-muted-foreground">
														Abierto{" "}
														{dateTimeFormatter.format(
															new Date(incident.createdAt),
														)}
													</p>
													{incident.notes ? (
														<p className="text-muted-foreground">
															{incident.notes}
														</p>
													) : null}
												</div>
											</div>
											<form
												action={resolveFalsePositiveIncidentAction}
												className="mt-3 grid gap-3"
											>
												<input
													type="hidden"
													name="incidentId"
													value={incident._id}
												/>
												<Textarea
													name="resolutionNotes"
													placeholder="Qué cambió antes de cerrar este caso."
												/>
												<div>
													<Button type="submit" variant="outline">
														Cerrar caso
													</Button>
												</div>
											</form>
										</div>
									))
								) : (
									<p className="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
										No hay direcciones incorrectas abiertas.
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				</section>

				<section>
					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<DatabaseZap
									className="h-5 w-5 text-muted-foreground"
									aria-hidden="true"
								/>
								Pruebas con anuncios reales
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Cada enlace debe quedar marcado como verificado oficialmente
								antes de ampliar el acceso.
							</p>
						</CardHeader>
						<CardContent className="space-y-4">
							<form action={rerunLiveFixturesAction}>
								<Button type="submit" variant="outline">
									Volver a probar todos los pendientes
								</Button>
							</form>
							{liveFixtures.length === 0 ? (
								<p className="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
									No hay pruebas con anuncios reales registradas todavía.
								</p>
							) : (
								<div className="space-y-3">
									{liveFixtures.map((fixture) => (
										<div
											key={fixture.fixtureId}
											className="rounded-md border border-border/70 p-3 text-sm"
										>
											<div className="flex flex-wrap items-baseline justify-between gap-2">
												<p className="break-all font-medium text-foreground">
													{fixture.sourceUrl}
												</p>
												<span
													className={
														fixture.validationStatus ===
														"officially_validated"
															? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
															: "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
													}
												>
													{fixture.validationStatus ===
													"officially_validated"
														? "Verificada"
														: "Pendiente"}
												</span>
											</div>
											<dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
												<div>
													<dt className="font-medium text-foreground">
														Esperado
													</dt>
													<dd>{fixture.expectedStatus}</dd>
												</div>
												<div>
													<dt className="font-medium text-foreground">
														Última lectura
													</dt>
													<dd>
														{fixture.lastObservedStatus ?? "Sin datos"}
													</dd>
												</div>
												<div>
													<dt className="font-medium text-foreground">
														Territorio
													</dt>
													<dd>{fixture.territoryAdapter}</dd>
												</div>
												<div>
													<dt className="font-medium text-foreground">
														Origen
													</dt>
													<dd>
														{fixture.source === "incident_auto_added"
															? "Reportado"
															: "Inicial"}
													</dd>
												</div>
											</dl>
											{fixture.lastObservedReasonCodes &&
											fixture.lastObservedReasonCodes.length > 0 ? (
												<p className="mt-2 break-all text-xs text-muted-foreground">
													{fixture.lastObservedReasonCodes.join(", ")}
												</p>
											) : null}
											{fixture.validationStatus !==
											"officially_validated" ? (
												<form
													action={markLiveFixtureValidatedAction}
													className="mt-3 flex flex-wrap items-center gap-2"
												>
													<input
														type="hidden"
														name="fixtureId"
														value={fixture.fixtureId}
													/>
													<Input
														name="validationNotes"
														placeholder="Notas de verificación oficial"
														className="h-9 flex-1 text-sm"
													/>
													<Button type="submit" size="sm">
														Marcar como verificada
													</Button>
												</form>
											) : null}
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</section>

				<section>
					<Card className="border-border/80 bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<MinusCircle
									className="h-5 w-5 text-muted-foreground"
									aria-hidden="true"
								/>
								Lo que no hace todavía
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								No abras la función a cuentas que dependan de estos casos.
							</p>
						</CardHeader>
						<CardContent>
							<ul className="grid gap-3 sm:grid-cols-2">
								{unsupportedBetaCases.map((unsupported) => (
									<li
										key={unsupported.title}
										className="rounded-md border border-border/70 p-3"
									>
										<p className="text-sm font-semibold text-foreground">
											{unsupported.title}
										</p>
										<p className="mt-1.5 text-sm leading-6 text-muted-foreground">
											{unsupported.detail}
										</p>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</section>
			</div>
		</main>
	);
}
