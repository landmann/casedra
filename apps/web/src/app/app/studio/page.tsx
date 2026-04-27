import { Button, Card, CardContent, CardHeader, CardTitle } from "@casedra/ui";
import { UserButton } from "@clerk/nextjs";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	CheckCircle2,
	Clock3,
	LayoutDashboard,
	MessageSquareText,
	ShieldCheck,
	Sparkles,
	Users,
	Workflow,
} from "lucide-react";
import Link from "next/link";

import { generalEmail, generalEmailHref } from "../../marketing-data";

const quickActions = [
	{
		title: "Conectar un canal en directo",
		description:
			"Conecta WhatsApp o portales para que los contactos lleguen a la bandeja.",
		icon: MessageSquareText,
		cta: "Abrir configuración de canales",
		href: "/app/onboarding?step=brand",
	},
	{
		title: "Revisar reglas de reparto",
		description:
			"Decide quién recibe cada contacto y cuándo debe entrar una persona.",
		icon: Workflow,
		cta: "Ver reparto",
		href: "#",
	},
	{
		title: "Preparar prueba para vendedores",
		description:
			"Prepara una prueba semanal clara para conversaciones con propietarios.",
		icon: LayoutDashboard,
		cta: "Preparar prueba",
		href: "#",
	},
	{
		title: "Coordinar la puesta en marcha",
		description:
			"Ve qué falta, qué cuentas necesitan atención y quién necesita formación.",
		icon: Users,
		cta: "Ver tareas",
		href: generalEmailHref,
	},
] as const;

const inboxQueue = [
	{
		contact: "Ana Garcia",
		source: "Idealista",
		state: "Esperando agente",
		owner: "Marta Ruiz",
		summary:
			"Solicitud de visita para un piso de 2 dormitorios en Chamberí. Presupuesto ya cualificado.",
	},
	{
		contact: "Carlos Moreno",
		source: "WhatsApp",
		state: "Casedra responde",
		owner: "Casedra",
		summary:
			"Pregunta por disponibilidad y aparcamiento en un inmueble de Chamartín.",
	},
	{
		contact: "Lucia Vega",
		source: "Formulario web de valoración",
		state: "Nuevo contacto vendedor",
		owner: "Seguimiento de propietarios",
		summary:
			"Pidió una valoración para un piso de 3 dormitorios y quiere una reunión la semana que viene.",
	},
] as const;

const scorecard = [
	{
		label: "Respuesta típica",
		value: "01:42",
		tone: "text-foreground",
	},
	{ label: "Bandeja activa semanal", value: "81%", tone: "text-foreground" },
	{
		label: "Canales en directo conectados",
		value: "14 / 16",
		tone: "text-foreground",
	},
	{ label: "Problemas abiertos", value: "0", tone: "text-primary" },
] as const;

const workflowCards = [
	{
		title: "Control de respuesta",
		body: "Casedra respondió el 92% de los contactos relevantes dentro del tiempo prometido esta semana.",
		footer: "Actualizado hace 12 minutos",
	},
	{
		title: "Visibilidad de dirección",
		body: "Dos cuentas necesitan ajustes de reparto porque la cobertura del fin de semana cayó por debajo del objetivo.",
		footer: "Necesita revisión hoy",
	},
	{
		title: "Captación de vendedores",
		body: "Cinco propietarios pidieron valoración después de un seguimiento claro.",
		footer: "Listo para revisar",
	},
] as const;

const activityFeed = [
	{
		title: "Resumen semanal entregado",
		description:
			"Ático Chamberí recibió su revisión del lunes con respuesta, pendientes y siguientes pasos.",
		timestamp: "09:12",
		icon: CheckCircle2,
	},
	{
		title: "Traspaso al equipo",
		description:
			"Una pregunta sobre plazos hipotecarios se escaló a Marta Ruiz con el resumen completo de la conversación.",
		timestamp: "08:47",
		icon: AlertCircle,
	},
	{
		title: "Nueva solicitud de valoración de vendedor",
		description:
			"Lucia Vega pidió una valoración y quedó lista para seguimiento.",
		timestamp: "08:31",
		icon: Sparkles,
	},
] as const;

export default function StudioPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="relative isolate overflow-hidden">
				<div className="pointer-events-none absolute inset-0">
					<div className="absolute left-[-8rem] top-[-5rem] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(156,97,55,0.16),transparent_62%)] blur-3xl" />
					<div className="absolute right-[-8rem] top-0 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(232,223,204,0.92),transparent_64%)] blur-3xl" />
				</div>

				<header className="relative border-b border-border/80 bg-background/88 backdrop-blur">
					<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
						<div className="space-y-3">
							<div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/85 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px] sm:tracking-[0.24em]">
								<Building2
									className="h-3.5 w-3.5 text-primary"
									aria-hidden="true"
								/>
								Vista previa del producto
							</div>
							<div>
								<h1 className="font-serif text-[2.8rem] font-normal leading-tight text-foreground sm:text-[4rem]">
									Centro de mando de la agencia
								</h1>
								<p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
									Una vista previa de Casedra para contactos, reparto del equipo
									y prueba semanal para captar vendedores.
								</p>
							</div>
						</div>
						<div className="flex flex-col gap-4 lg:items-end">
							<div className="flex items-center gap-3">
								<Button asChild className="rounded-full px-6">
									<Link
										href="/book-demo"
										className="inline-flex items-center gap-2"
									>
										Reservar recorrido
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
								<UserButton />
							</div>
							<Link
								href="/masterplan"
								className="text-sm text-muted-foreground transition-colors hover:text-foreground"
							>
								Leer el plan maestro
							</Link>
						</div>
					</div>
				</header>

				<main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8 sm:py-10">
					<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{quickActions.map((action) => {
							const Icon = action.icon;

							return (
								<Card
									key={action.title}
									className="rounded-[26px] border-border/80 bg-background/92 shadow-[0_18px_60px_rgba(31,26,20,0.06)]"
								>
									<CardHeader className="space-y-4">
										<div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
											<Icon className="h-5 w-5" aria-hidden="true" />
										</div>
										<div>
											<CardTitle className="text-lg font-semibold">
												{action.title}
											</CardTitle>
											<p className="mt-2 text-sm leading-6 text-muted-foreground">
												{action.description}
											</p>
										</div>
									</CardHeader>
									<CardContent className="pt-0">
										<Button
											asChild
											variant="secondary"
											className="rounded-full px-5"
										>
											<Link
												href={action.href}
												className="inline-flex items-center gap-2"
											>
												{action.cta}
												<ArrowRight className="h-4 w-4" aria-hidden="true" />
											</Link>
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</section>

					<section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
						<Card className="rounded-[28px] border-border/80 bg-background/92 shadow-[0_24px_70px_rgba(31,26,20,0.07)] sm:rounded-[30px]">
							<CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
								<div>
									<CardTitle className="font-serif text-[2rem] font-normal leading-tight sm:text-3xl">
										Cola de bandeja en directo
									</CardTitle>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
											Una sola superficie para contactos compradores, captación de
										vendedores y toma de control humana.
									</p>
								</div>
								<Button
									asChild
									variant="outline"
									size="sm"
									className="rounded-full"
								>
									<Link href="/app/inbox">
										Abrir bandeja
										<ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
							</CardHeader>
							<CardContent className="space-y-4 pt-2">
								{inboxQueue.map((item) => (
									<div
										key={item.contact}
										className="rounded-[24px] border border-border/80 bg-secondary/45 p-5"
									>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<p className="text-lg font-semibold text-foreground">
													{item.contact}
												</p>
												<p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
													{item.source}
												</p>
											</div>
											<div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
												<span className="rounded-full border border-border bg-background px-3 py-1">
													{item.state}
												</span>
												<span className="rounded-full border border-border bg-background px-3 py-1">
													Responsable: {item.owner}
												</span>
											</div>
										</div>
										<p className="mt-4 text-sm leading-6 text-foreground/90">
											{item.summary}
										</p>
									</div>
								))}
							</CardContent>
						</Card>

						<Card className="rounded-[28px] border-primary/25 bg-primary/10 sm:rounded-[30px]">
							<CardHeader>
								<CardTitle className="font-serif text-[2rem] font-normal leading-tight sm:text-3xl">
									Cuadro de mando de la oficina
								</CardTitle>
								<p className="mt-2 text-sm leading-6 text-foreground/75">
									Los números que dicen si la oficina responde bien y a tiempo.
								</p>
							</CardHeader>
							<CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
								{scorecard.map((item) => (
									<div
										key={item.label}
										className="rounded-[22px] border border-primary/15 bg-background/94 px-4 py-4"
									>
										<p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
											{item.label}
										</p>
										<p
											className={`mt-3 text-3xl font-semibold tracking-tight ${item.tone}`}
										>
											{item.value}
										</p>
									</div>
								))}
							</CardContent>
						</Card>
					</section>

					<section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
						<Card className="rounded-[28px] border-border/80 bg-[linear-gradient(180deg,rgba(255,251,242,0.96),rgba(248,241,229,0.88))] shadow-[0_24px_70px_rgba(31,26,20,0.07)] sm:rounded-[30px]">
							<CardHeader>
								<CardTitle className="font-serif text-[2rem] font-normal leading-tight sm:text-3xl">
										Destacados del trabajo
								</CardTitle>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
										Lo que la oficina ve cada día.
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								{workflowCards.map((card) => (
									<div
										key={card.title}
										className="rounded-[24px] border border-border/80 bg-background px-5 py-5"
									>
										<p className="text-lg font-semibold text-foreground">
											{card.title}
										</p>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">
											{card.body}
										</p>
										<div className="mt-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-primary">
											<Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
											{card.footer}
										</div>
									</div>
								))}
							</CardContent>
						</Card>

						<div className="grid gap-6">
							<Card className="rounded-[28px] border-border/80 bg-background/92 shadow-[0_24px_70px_rgba(31,26,20,0.07)] sm:rounded-[30px]">
								<CardHeader>
									<CardTitle className="font-serif text-[2rem] font-normal leading-tight sm:text-3xl">
										Actividad reciente
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									{activityFeed.map((item) => {
										const Icon = item.icon;

										return (
											<div
												key={item.title}
												className="flex items-start gap-4 rounded-[22px] border border-border/80 bg-secondary/45 p-4"
											>
												<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
													<Icon className="h-4 w-4" aria-hidden="true" />
												</div>
												<div className="min-w-0">
													<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
														<p className="text-sm font-semibold text-foreground">
															{item.title}
														</p>
														<span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
															{item.timestamp}
														</span>
													</div>
													<p className="mt-2 text-sm leading-6 text-muted-foreground">
														{item.description}
													</p>
												</div>
											</div>
										);
									})}
								</CardContent>
							</Card>

							<Card className="rounded-[28px] border-primary/25 bg-primary/10 sm:rounded-[30px]">
								<CardHeader>
									<CardTitle className="font-serif text-[2rem] font-normal leading-tight sm:text-3xl">
											Lista de puesta en marcha
									</CardTitle>
									<p className="mt-2 text-sm leading-6 text-foreground/75">
											Lo mínimo para abrir Casedra con criterio.
									</p>
								</CardHeader>
								<CardContent className="space-y-3">
									{[
										"Al menos un canal en directo conectado",
										"Reglas claras de asignación y toma de control acordadas con la oficina",
											"Primer resumen semanal programado para la revisión del lunes",
											"Dirección sabe dónde revisar respuesta, pendientes y riesgos",
									].map((item) => (
										<div
											key={item}
											className="rounded-[22px] border border-primary/15 bg-background/94 px-4 py-4 text-sm leading-6 text-foreground/90"
										>
											{item}
										</div>
									))}
									<Button
										asChild
										variant="secondary"
										className="rounded-full px-6"
									>
										<Link
											href={generalEmailHref}
											className="inline-flex items-center gap-2"
										>
												Hablar con el equipo
											<ShieldCheck className="h-4 w-4" aria-hidden="true" />
										</Link>
									</Button>
									<p className="text-xs leading-6 text-foreground/70">
										Contacto:{" "}
										<Link href={generalEmailHref} className="underline">
											{generalEmail}
										</Link>
									</p>
								</CardContent>
							</Card>
						</div>
					</section>
				</main>
			</div>
		</div>
	);
}
