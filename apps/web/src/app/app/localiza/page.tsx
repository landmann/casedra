import { Button, Card, CardContent, CardHeader, CardTitle } from "@casedra/ui";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { auth } from "@clerk/nextjs/server";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	MinusCircle,
	Radar,
	ShieldCheck,
	Timer,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createConvexClient } from "@/server/convexClient";
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

	const snapshot = await getLocalizaReadinessSnapshot({
		convex: createConvexClient(convexAuthToken),
	});
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
								href="/app/inbox"
								className="inline-flex items-center gap-2"
							>
								<ArrowLeft className="h-4 w-4" aria-hidden="true" />
								Volver a la bandeja
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
