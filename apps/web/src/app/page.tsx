import { Button, Card, CardContent, CardHeader, CardTitle } from "@casedra/ui";
import {
	ArrowRight,
	BarChart3,
	Building2,
	CheckCircle2,
	Clock3,
	FileSearch,
	Inbox,
	KeyRound,
	Mail,
	MapPinned,
	MessageSquareText,
	Route,
	Search,
	ShieldCheck,
	UsersRound,
	Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingHeaderAuthCta } from "./MarketingHeaderAuthCta";
import { calendarHref, generalEmail } from "./marketing-data";

export const metadata: Metadata = {
	title: "Casedra | AI revenue workflow for real-estate agencies",
	description:
		"Casedra helps real-estate agencies answer leads faster, route every conversation, prove performance, and turn listing intake into seller acquisition.",
};

const proofSignals = [
	{
		label: "Primer mensaje",
		value: "Antes que el lead se enfríe",
		icon: Clock3,
		tone: "border-[#7A2E2A]/25 bg-[#7A2E2A]/10 text-[#7A2E2A]",
	},
	{
		label: "Propietario visible",
		value: "IA, agente o dirección",
		icon: Route,
		tone: "border-primary/25 bg-primary/10 text-primary",
	},
	{
		label: "Prueba semanal",
		value: "Cobertura y pendientes",
		icon: BarChart3,
		tone: "border-[#4E6B43]/25 bg-[#4E6B43]/10 text-[#4E6B43]",
	},
] as const;

const inboxRows = [
	{
		contact: "Ana García",
		source: "Idealista",
		state: "Visita esta semana",
		owner: "Marta",
		summary: "Quiere Chamberí, 2 dormitorios y respuesta antes de las 18:00.",
	},
	{
		contact: "Carlos Moreno",
		source: "WhatsApp",
		state: "Casedra responde",
		owner: "IA activa",
		summary: "Pregunta disponibilidad, garaje y condiciones para reservar.",
	},
	{
		contact: "Lucia Vega",
		source: "Web",
		state: "Captación",
		owner: "Dirección",
		summary: "Pide una valoración para vender en Salamanca este trimestre.",
	},
] as const;

const benefits = [
	{
		title: "No pierdas el primer contacto",
		body: "Casedra responde, resume la intención y deja claro cuando una persona debe intervenir.",
		icon: MessageSquareText,
	},
	{
		title: "Dirige la oficina desde una bandeja",
		body: "Cada hilo tiene estado, responsable, origen y siguiente paso. Sin capturas, sin grupos paralelos.",
		icon: Inbox,
	},
	{
		title: "Convierte operaciones en prueba comercial",
		body: "La misma actividad que ordena el día a día sirve para demostrar velocidad, seguimiento y ROI al siguiente propietario.",
		icon: CheckCircle2,
	},
] as const;

const workflow = [
	{
		title: "Conecta los canales reales",
		body: "WhatsApp, portales, web y formularios entran en una cola común.",
		icon: Workflow,
	},
	{
		title: "Casedra cualifica y entrega",
		body: "La IA contesta lo urgente, resume el contexto y registra el motivo del traspaso.",
		icon: UsersRound,
	},
	{
		title: "La dirección ve lo que pasó",
		body: "Tiempo de respuesta, cobertura, pendientes y fricción quedan listos para revisión semanal.",
		icon: BarChart3,
	},
] as const;

const localizaPoints = [
	{
		title: "URL de Idealista",
		body: "El agente pega un enlace y Casedra extrae las señales útiles.",
		icon: Search,
	},
	{
		title: "Fuentes oficiales",
		body: "La ubicación se contrasta con Catastro o el catastro regional correspondiente.",
		icon: ShieldCheck,
	},
	{
		title: "Dossier accionable",
		body: "Dirección propuesta, referencia, historial público y evidencia para decidir.",
		icon: FileSearch,
	},
] as const;

const trustNotes = [
	"Una oficina primero",
	"Canales existentes",
	"Control humano visible",
	"Sin migración eterna",
] as const;

const localizaHref = "/app/localiza";

export default function HomePage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="relative isolate overflow-hidden">
				<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(31,26,20,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(31,26,20,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.18),transparent_72%)]" />

				<header className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
					<Link href="/" className="inline-flex min-w-0 items-center gap-3">
						<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/90 font-serif text-xl text-foreground shadow-sm">
							C
						</span>
						<span className="truncate text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
							Casedra
						</span>
					</Link>
					<nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
						<a
							href="#workflow"
							className="transition-colors hover:text-foreground"
						>
							Flujo
						</a>
						<a
							href="#localiza"
							className="transition-colors hover:text-foreground"
						>
							Localiza
						</a>
						<a
							href="#pricing"
							className="transition-colors hover:text-foreground"
						>
							Implantación
						</a>
					</nav>
					<MarketingHeaderAuthCta calendarHref={calendarHref} />
				</header>

				<main className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 lg:px-12 lg:pb-24">
					<section className="grid gap-8">
						<div className="animate-enter">
							<div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground shadow-[0_10px_28px_rgba(31,26,20,0.05)]">
								<Building2
									className="h-3.5 w-3.5 text-primary"
									aria-hidden="true"
								/>
								Revenue workflow para agencias inmobiliarias
							</div>
							<h1 className="mt-7 max-w-6xl text-balance font-serif text-[3.35rem] font-normal leading-[0.96] text-foreground sm:text-[5rem] lg:text-[6.15rem]">
								El lead llega vivo. Casedra lo mantiene así.
							</h1>
						</div>

						<div className="grid gap-8 lg:grid-cols-2 lg:items-start">
							<div className="animate-enter flex min-h-full flex-col justify-around gap-8 pb-2 [animation-delay:90ms]">
								<p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
									Casedra une WhatsApp, portales, web y propiedad en un solo
									flujo: contesta antes, entrega cada conversación con contexto
									y prueba el trabajo hecho cuando toca ganar al siguiente
									vendedor.
								</p>
								<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
									<Button asChild size="lg" className="rounded-full px-7">
										<Link
											href={calendarHref}
											className="inline-flex items-center gap-2"
										>
											<KeyRound className="h-4 w-4" aria-hidden="true" />
											Reservar implantación
										</Link>
									</Button>
									<Button
										asChild
										variant="outline"
										size="lg"
										className="rounded-full border-[#4E6B43]/30 px-7 text-[#4E6B43] hover:bg-[#4E6B43]/10 hover:text-[#4E6B43]"
									>
										<Link
											href={localizaHref}
											className="inline-flex items-center gap-2"
										>
											<Search className="h-4 w-4" aria-hidden="true" />
											Probar Localiza
										</Link>
									</Button>
								</div>
							</div>

							<div className="animate-enter overflow-hidden rounded-[1.75rem] border border-border bg-secondary shadow-[0_34px_110px_rgba(31,26,20,0.16)] [animation-delay:160ms]">
								<div className="relative">
									<Image
										src="/images/marketing/casedra-agency-command.webp"
										alt="Mesa editorial de una oficina inmobiliaria con panel operativo de Casedra"
										width={1672}
										height={941}
										priority
										className="casedra-hero-image aspect-[16/10] h-full w-full object-cover"
									/>
									<div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(31,26,20,0.18),transparent_44%)]" />
								</div>
								<div className="grid gap-2 border-t border-border bg-background/90 p-3 sm:grid-cols-3">
									{proofSignals.map((signal) => {
										const Icon = signal.icon;

										return (
											<div
												key={signal.label}
												className="casedra-lift rounded-2xl border border-border bg-[#FFFBF2]/88 p-3 shadow-[0_10px_28px_rgba(31,26,20,0.08)] backdrop-blur-md"
											>
												<div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
													<Icon
														className={`h-3.5 w-3.5 rounded-full border p-0.5 ${signal.tone}`}
														aria-hidden="true"
													/>
													{signal.label}
												</div>
												<p className="mt-2 text-sm font-semibold leading-5 text-foreground">
													{signal.value}
												</p>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</section>

					<section className="mt-12 grid gap-4 md:grid-cols-3">
						{benefits.map((item) => {
							const Icon = item.icon;

							return (
								<Card
									key={item.title}
									className="rounded-[1.25rem] border-border/80 bg-background/92 shadow-[0_18px_60px_rgba(31,26,20,0.06)]"
								>
									<CardHeader className="space-y-4">
										<div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
											<Icon className="h-5 w-5" aria-hidden="true" />
										</div>
										<CardTitle className="font-serif text-[2rem] font-normal leading-tight">
											{item.title}
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<p className="text-sm leading-6 text-muted-foreground">
											{item.body}
										</p>
									</CardContent>
								</Card>
							);
						})}
					</section>

					{/* biome-ignore lint/correctness/useUniqueElementIds: Singleton page anchor for header navigation. */}
					<section
						id="workflow"
						className="mt-14 overflow-hidden rounded-[1.75rem] border border-border/80 bg-background/95 shadow-[0_30px_90px_rgba(31,26,20,0.08)]"
					>
						<div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
							<div className="border-b border-border/80 p-5 sm:p-7 xl:border-b-0 xl:border-r">
								<p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
									Respuesta + Inbox
								</p>
								<h2 className="mt-3 max-w-2xl font-serif text-4xl font-normal leading-tight text-foreground sm:text-5xl">
									El trabajo vivo de la agencia, por fin en un sitio.
								</h2>
								<p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
									No estamos clonando un CRM pesado. Casedra empieza por el
									bucle que mueve dinero: entra un lead, alguien responde, el
									hilo se enruta y dirección puede demostrar que no se perdió.
								</p>

								<div className="mt-7 space-y-3">
									{inboxRows.map((row) => (
										<div
											key={row.contact}
											className="rounded-[1.15rem] border border-border/80 bg-secondary/45 p-4"
										>
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div>
													<p className="text-base font-semibold text-foreground">
														{row.contact}
													</p>
													<p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
														{row.source}
													</p>
												</div>
												<div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
													<span className="rounded-full border border-border bg-background px-3 py-1">
														{row.state}
													</span>
													<span className="rounded-full border border-border bg-background px-3 py-1">
														{row.owner}
													</span>
												</div>
											</div>
											<p className="mt-3 text-sm leading-6 text-foreground/85">
												{row.summary}
											</p>
										</div>
									))}
								</div>
							</div>

							<div className="bg-secondary/35 p-5 sm:p-7">
								<div className="space-y-3">
									{workflow.map((item, index) => {
										const Icon = item.icon;

										return (
											<div
												key={item.title}
												className="grid grid-cols-[46px_1fr] gap-4 rounded-[1.15rem] border border-border/80 bg-background p-4"
											>
												<div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
													<Icon className="h-5 w-5" aria-hidden="true" />
												</div>
												<div>
													<p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
														{String(index + 1).padStart(2, "0")}
													</p>
													<h3 className="mt-1 text-base font-semibold text-foreground">
														{item.title}
													</h3>
													<p className="mt-2 text-sm leading-6 text-muted-foreground">
														{item.body}
													</p>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</section>

					{/* biome-ignore lint/correctness/useUniqueElementIds: Singleton page anchor for header navigation. */}
					<section
						id="localiza"
						className="mt-14 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center"
					>
						<div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-secondary shadow-[0_30px_90px_rgba(31,26,20,0.1)]">
							<Image
								src="/images/marketing/casedra-property-dossier.webp"
								alt="Dossier inmobiliario con mapa, informe y panel operativo de Casedra"
								width={1448}
								height={1086}
								className="aspect-[4/3] h-full w-full object-cover"
							/>
						</div>
						<div>
							<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
								<MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
								Localiza
							</div>
							<h2 className="mt-5 max-w-3xl font-serif text-4xl font-normal leading-tight text-foreground sm:text-5xl">
								De un enlace oculto a una decisión de captación.
							</h2>
							<p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
								Localiza convierte un enlace de Idealista en una ubicación
								verificable cuando la evidencia lo permite. Si no puede
								probarlo, no inventa: pide confirmación o deja el camino manual.
							</p>
							<div className="mt-7 grid gap-3">
								{localizaPoints.map((point) => {
									const Icon = point.icon;

									return (
										<div
											key={point.title}
											className="flex gap-4 rounded-[1.15rem] border border-border/80 bg-background/90 p-4"
										>
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
												<Icon className="h-4 w-4" aria-hidden="true" />
											</div>
											<div>
												<h3 className="text-sm font-semibold text-foreground">
													{point.title}
												</h3>
												<p className="mt-1 text-sm leading-6 text-muted-foreground">
													{point.body}
												</p>
											</div>
										</div>
									);
								})}
							</div>
							<div className="mt-7">
								<Button
									asChild
									variant="outline"
									size="lg"
									className="rounded-full px-7"
								>
									<Link
										href={localizaHref}
										className="inline-flex items-center gap-2"
									>
										Probar con un enlace
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
							</div>
						</div>
					</section>

					{/* biome-ignore lint/correctness/useUniqueElementIds: Singleton page anchor for header navigation. */}
					<section
						id="pricing"
						className="mt-14 rounded-[1.75rem] border border-primary/25 bg-primary/10 p-6 sm:p-8"
					>
						<div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
							<div>
								<p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">
									Implantación para oficinas reales
								</p>
								<h2 className="mt-4 max-w-3xl font-serif text-4xl font-normal leading-tight text-foreground sm:text-5xl">
									Entra pagando por control operativo, no por otra herramienta
									que nadie abre.
								</h2>
								<p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
									La primera versión se instala con una oficina, canales reales
									y revisión semanal. El objetivo no es tener una cuenta creada;
									es recuperar leads, ordenar responsables y enseñar resultados
									que justifiquen seguir pagando.
								</p>
								<div className="mt-6 flex flex-wrap gap-2">
									{trustNotes.map((note) => (
										<span
											key={note}
											className="rounded-full border border-primary/20 bg-background/75 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-primary/85"
										>
											{note}
										</span>
									))}
								</div>
							</div>
							<div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
								<Button asChild size="lg" className="rounded-full px-7">
									<Link
										href={calendarHref}
										className="inline-flex items-center gap-2"
									>
										Reservar implantación
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									size="lg"
									className="rounded-full px-7"
								>
									<Link
										href={`mailto:${generalEmail}`}
										className="inline-flex items-center gap-2"
									>
										<Mail className="h-4 w-4" aria-hidden="true" />
										Escribir
									</Link>
								</Button>
							</div>
						</div>
					</section>
				</main>
			</div>
		</div>
	);
}
