import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@casablanca/ui";

const calendarHref = "https://cal.com/product@casablanca.cloud/demo";
const demoRoute = "/book-demo";
const emailHref = "mailto:product@casablanca.cloud?subject=Demo%20Casablanca";

export const metadata: Metadata = {
  title: "Casablanca",
  description:
    "Casablanca ayuda a agencias inmobiliarias a responder antes, ordenar WhatsApp y portales, y dar visibilidad real a dirección.",
};

const heroHighlights = [
  "Primera respuesta rápida",
  "Traspaso claro al agente",
  "Informe semanal para dirección",
] as const;

const previewHighlights = [
  { label: "Canales", value: "WhatsApp + portales" },
  { label: "Operativa", value: "Respuesta + reparto" },
  { label: "Dirección", value: "Informe semanal" },
] as const;

const buyerOutcomes = [
  {
    label: "Respuesta",
    value: "Menos leads sin contestar",
    detail: "La primera respuesta sale antes y la conversación no se enfría en la bandeja.",
  },
  {
    label: "Equipo",
    value: "Menos caos en WhatsApp",
    detail: "Queda claro cuándo responde Casablanca y cuándo entra una persona del equipo.",
  },
  {
    label: "Dirección",
    value: "Más control de oficina",
    detail: "Cada semana se revisa qué se respondió, qué quedó pendiente y qué toca ajustar.",
  },
] as const;

const platformPillars = [
  {
    icon: MessageSquareText,
    title: "Primera respuesta",
    summary:
      "Casablanca atiende el primer contacto, recoge intención y deja la conversación encarrilada desde el minuto uno.",
    details: ["WhatsApp", "Portales", "Formulario web"],
  },
  {
    icon: Workflow,
    title: "Reparto y traspaso",
    summary:
      "Cada lead llega al agente correcto con contexto, resumen y un siguiente paso claro.",
    details: ["Asignación", "Resumen para agente", "Escalado claro"],
  },
  {
    icon: Radar,
    title: "Visibilidad para dirección",
    summary:
      "Dirección ve cobertura, pendientes, hilos escalados y fricciones sin perseguir capturas por WhatsApp.",
    details: ["Cobertura", "Pendientes", "Informe semanal"],
  },
] as const;

const trustArchitecture = [
  {
    icon: ShieldCheck,
    title: "Siempre se sabe quién responde",
    body:
      "Casablanca no oculta la operativa. Queda claro cuándo actúa la IA y cuándo toma el hilo una persona.",
  },
  {
    icon: MessageSquareText,
    title: "Empieza con vuestros canales actuales",
    body:
      "WhatsApp, reenvíos de portales y formularios web entran en la misma operativa sin cambiar todo de golpe.",
  },
  {
    icon: Building2,
    title: "Se implanta por oficina",
    body:
      "La demo y el despliegue se plantean sobre un equipo real, con un alcance claro y sin vender humo.",
  },
] as const;

const operatingLoop = [
  {
    step: "01",
    title: "Llega el lead",
    description:
      "Idealista, web y WhatsApp aterrizan en el mismo sitio en lugar de perderse entre reenvíos y chats.",
  },
  {
    step: "02",
    title: "Sale la primera respuesta",
    description:
      "Casablanca abre el hilo, recoge lo básico y evita que el lead se quede esperando.",
  },
  {
    step: "03",
    title: "Se pasa al agente correcto",
    description:
      "El equipo recibe contexto, intención y siguiente paso sin tener que reconstruir la conversación.",
  },
  {
    step: "04",
    title: "Dirección revisa la semana",
    description:
      "Cada semana queda claro qué se respondió, qué se perdió y qué necesita ajuste.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(156,97,55,0.22),transparent_60%)] blur-3xl" />
          <div className="absolute right-[-4rem] top-[-6rem] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(232,223,204,0.92),transparent_66%)] blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-[560px] bg-[linear-gradient(180deg,rgba(255,251,242,0),rgba(255,251,242,0.8)_62%,rgba(255,251,242,1))]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(31,26,20,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(31,26,20,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.16),transparent_72%)]" />
        </div>

        <header className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
          <Link href="/" className="inline-flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/80 font-serif text-lg text-foreground shadow-sm sm:h-11 sm:w-11 sm:text-xl">
              C
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-sm sm:tracking-[0.26em]">
              Casablanca
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            <a href="#benefits" className="transition-colors hover:text-foreground">
              Qué gana tu oficina
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#trust" className="transition-colors hover:text-foreground">
              Implantación
            </a>
          </nav>
          <Button asChild className="rounded-full px-5 sm:px-6">
            <Link href={calendarHref}>Ver huecos disponibles</Link>
          </Button>
        </header>

        <main className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pb-28">
          <section className="grid gap-8 lg:gap-10 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,28rem)] xl:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-background/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground shadow-sm backdrop-blur sm:px-4 sm:text-[11px] sm:tracking-[0.28em]">
                <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Para agencias inmobiliarias que trabajan con WhatsApp y portales
              </div>
              <h1 className="mt-6 max-w-4xl text-balance font-serif text-[3rem] font-normal leading-[0.98] text-foreground sm:text-[4.25rem] xl:text-[5.2rem]">
                Primera respuesta rápida.
                <br />
                Reparto claro al agente.
                <br />
                Control real para dirección.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                Casablanca ayuda a tu agencia a responder antes, ordenar la entrada de leads desde
                WhatsApp y portales, y dar a dirección visibilidad semanal sin añadir otro CRM
                pesado ni promesas vacías de automatización.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap">
                <Button asChild size="lg" className="rounded-full px-7 sm:w-auto">
                  <Link href={calendarHref} className="inline-flex items-center gap-2">
                    Ver huecos disponibles
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full px-7 sm:w-auto">
                  <Link href={demoRoute}>Qué verás en la demo</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="rounded-full px-6 sm:w-auto sm:justify-start"
                >
                  <Link href={emailHref}>Escribirnos</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:gap-3 sm:text-xs sm:tracking-[0.2em]">
                {heroHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border bg-background/70 px-3 py-2"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[34rem] xl:mx-0 xl:justify-self-end">
              <div className="absolute -inset-4 rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(156,97,55,0.18),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(111,94,74,0.14),transparent_34%)] blur-2xl sm:-inset-6" />
              <Card className="relative overflow-hidden rounded-[28px] border-border/80 bg-background/92 shadow-[0_34px_100px_rgba(31,26,20,0.12)] sm:rounded-[32px]">
                <CardHeader className="border-b border-border/80 pb-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Vista del producto
                      </p>
                      <CardTitle className="mt-2 font-serif text-[1.9rem] font-normal leading-tight sm:text-3xl">
                        Cómo trabaja una oficina con Casablanca
                      </CardTitle>
                    </div>
                    <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-primary">
                      Vista previa
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="rounded-[26px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(244,236,223,0.82))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        Recorrido visual
                      </span>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                        Vídeo próximamente
                      </span>
                    </div>
                    <div className="mt-4 rounded-[22px] border border-border/80 bg-background/80 p-5">
                      <p className="font-serif text-[1.75rem] font-normal leading-tight text-foreground">
                        Así se verá el flujo completo de Casablanca.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Muy pronto añadiremos un vídeo corto del producto. Mientras tanto, este es
                        el recorrido que enseñamos en la demo.
                      </p>
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        {[
                          "Lead entra desde WhatsApp o portal",
                          "Sale la primera respuesta",
                          "El agente recibe resumen y contexto",
                          "Dirección revisa la semana",
                        ].map((item) => (
                          <div
                            key={item}
                            className="rounded-2xl border border-border/80 bg-secondary/45 px-4 py-3 text-sm text-foreground/90"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {previewHighlights.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-border/70 bg-secondary/55 p-4"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[26px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(248,241,229,0.88))] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        <span>Bandeja unificada</span>
                        <span>WhatsApp + portales</span>
                      </div>
                      <div className="mt-5 space-y-4">
                        <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Lead entrante</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Consulta por Idealista. Quiere visitar un piso esta semana y resolver
                                disponibilidad.
                              </p>
                            </div>
                            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Nuevo
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                            Primera respuesta
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground/90">
                            Casablanca confirma intención, zona y disponibilidad antes de pasar la
                            conversación al equipo.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">Resumen para agente</p>
                            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Listo para seguir
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            El agente recibe contexto, intención y siguiente paso sin reconstruir el
                            hilo desde cero.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[26px] border border-border/80 bg-secondary/55 p-5">
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                          Qué ve dirección
                        </p>
                        <div className="mt-4 space-y-3">
                          {[
                            "Cobertura de respuestas",
                            "Conversaciones pendientes",
                            "Hilos escalados al equipo",
                            "Seguimientos de la semana",
                          ].map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm text-foreground/90"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[26px] border border-primary/25 bg-primary/10 p-5">
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                          Sin cajas negras
                        </p>
                        <p className="mt-3 font-serif text-2xl font-normal leading-tight text-foreground">
                          La IA ayuda a operar. El equipo sigue mandando.
                        </p>
                        <p className="mt-3 text-sm leading-6 text-foreground/85">
                          Casablanca está pensada para que el control siga siendo visible en todo
                          momento, especialmente cuando toca entrar a un agente.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="benefits" className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {buyerOutcomes.map((item, index) => (
              <div
                key={item.label}
                className="animate-enter rounded-[24px] border border-border/80 bg-background/85 p-5 shadow-[0_18px_60px_rgba(31,26,20,0.06)]"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-3 font-serif text-3xl font-normal leading-tight text-foreground">
                  {item.value}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </section>

          <section id="how-it-works" className="mt-24">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Qué hace Casablanca
              </p>
              <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-foreground sm:text-5xl">
                Menos tiempo perdido entre mensajes. Más operativa clara para la oficina.
              </h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
                La propuesta es simple: responder antes, repartir mejor y dar a dirección una vista
                real de lo que está pasando sin depender de reenvíos manuales ni memoria de equipo.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {platformPillars.map((pillar, index) => {
                const Icon = pillar.icon;

                return (
                  <Card
                    key={pillar.title}
                    className="animate-enter h-full rounded-[28px] border-border/80 bg-background/92 shadow-[0_24px_70px_rgba(31,26,20,0.07)]"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <CardHeader className="space-y-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <CardTitle className="font-serif text-[2rem] font-normal leading-tight">
                          {pillar.title}
                        </CardTitle>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {pillar.summary}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {pillar.details.map((detail) => (
                          <span
                            key={detail}
                            className="rounded-full border border-border bg-secondary/55 px-3 py-1.5 text-xs font-medium text-foreground/85"
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section id="trust" className="mt-24 grid gap-8 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
            <div className="rounded-[30px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,251,242,0.94),rgba(248,241,229,0.84))] p-6 shadow-[0_28px_90px_rgba(31,26,20,0.08)] sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Implantación y control
              </p>
              <h3 className="mt-4 font-serif text-4xl font-normal leading-tight text-foreground">
                Esto tiene que ayudar a trabajar mejor, no complicar más la oficina.
              </h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                La venta no debería depender de promesas abstractas. Debería quedar claro cómo entra
                el lead, quién responde, cuándo se escala y qué ve dirección cada semana.
              </p>
              <div className="mt-8 space-y-4">
                {trustArchitecture.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-[22px] border border-border/80 bg-background/92 p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-foreground">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-border/80 bg-background/92 p-6 shadow-[0_24px_70px_rgba(31,26,20,0.07)] sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Cómo se mueve un lead
              </p>
              <div className="mt-6 space-y-4">
                {operatingLoop.map((item) => (
                  <div
                    key={item.step}
                    className="grid gap-3 rounded-[24px] border border-border/80 bg-secondary/45 p-5 sm:grid-cols-[68px_1fr] sm:items-start"
                  >
                    <div className="font-serif text-3xl font-normal leading-none text-primary">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-24 rounded-[30px] border border-primary/25 bg-primary/10 p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">
              Demo de 20 min
            </p>
            <h3 className="mt-4 max-w-4xl font-serif text-4xl font-normal leading-tight text-foreground">
              Si quieres ver si encaja con tu oficina, te lo enseñamos sobre vuestro flujo real.
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-8 text-foreground/85">
              Vemos de dónde entran vuestros leads, cómo se reparten hoy y dónde tendría sentido
              empezar. Sin pitch genérico. Sin compromiso. Si no encaja, te lo diremos.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link href={calendarHref} className="inline-flex items-center gap-2">
                  Ver huecos disponibles
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-7">
                <Link href={emailHref}>Escribir a product@casablanca.cloud</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80 sm:text-xs sm:tracking-[0.2em]">
              <span className="rounded-full border border-primary/20 bg-background/70 px-3 py-2">
                20 minutos
              </span>
              <span className="rounded-full border border-primary/20 bg-background/70 px-3 py-2">
                Sobre vuestro caso
              </span>
              <span className="rounded-full border border-primary/20 bg-background/70 px-3 py-2">
                Sin pitch genérico
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
