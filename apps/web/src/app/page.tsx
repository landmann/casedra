import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Landmark,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@casablanca/ui";

const studioRoute = "/app/studio";
const demoRoute = "/book-demo";
const masterplanRoute = "/masterplan";

const marketSignals = [
  {
    label: "Response control",
    value: "Sub-2m SLA",
    detail: "Lead arrives, reply goes out, ownership stays visible.",
  },
  {
    label: "Workflow layer",
    value: "Inbox-first",
    detail: "WhatsApp, portal forwarding, and handoff in one command surface.",
  },
  {
    label: "Expansion path",
    value: "Seller acquisition",
    detail: "Proof-of-performance becomes the next instruction engine.",
  },
] as const;

const platformPillars = [
  {
    icon: MessageSquareText,
    title: "Responde",
    summary:
      "Answer every meaningful lead quickly, qualify context, and escalate cleanly when a human should step in.",
    details: ["First response", "AI-to-human handoff", "Visible conversation ownership"],
  },
  {
    icon: Workflow,
    title: "Inbox control",
    summary:
      "Turn messy inbound demand into a managed workflow with routing, assignment, SLA visibility, and weekly proof.",
    details: ["WhatsApp-first", "Manager accountability", "Weekly operating rhythm"],
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: "Seller engine",
    summary:
      "Use the performance data from buyer-side execution to win more instructions and create higher-value agency rituals.",
    details: ["Valuation capture", "Owner nurture", "Proof pages and presentations"],
  },
] as const;

const trustArchitecture = [
  {
    icon: ShieldCheck,
    title: "Clear ownership",
    body:
      "Casablanca shows exactly when AI is active, when a human owns the thread, and why a handoff happened.",
  },
  {
    icon: Radar,
    title: "Weekly proof",
    body:
      "Managers get a measurable view of response speed, coverage, missed demand, and what changed this week.",
  },
  {
    icon: Landmark,
    title: "Independent position",
    body:
      "Built for agencies that want a serious workflow layer beside the portal ecosystem, not inside it.",
  },
] as const;

const operatingLoop = [
  {
    step: "01",
    title: "Inbound lead arrives",
    description:
      "Portal forwarding, WhatsApp, and web sources land inside the same operating layer.",
  },
  {
    step: "02",
    title: "Response is controlled",
    description:
      "Casablanca drafts or sends the first reply fast, then routes the thread based on confidence and rules.",
  },
  {
    step: "03",
    title: "Team workflow stays visible",
    description:
      "Assignment, takeover, SLA pressure, and manager accountability stay explicit instead of buried in chat.",
  },
  {
    step: "04",
    title: "Performance becomes proof",
    description:
      "The agency turns operating data into weekly reviews, seller-facing proof, and the next growth wedge.",
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

        <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/80 font-serif text-xl text-foreground shadow-sm">
              C
            </span>
            <span className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">
              Casablanca
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#trust" className="transition-colors hover:text-foreground">
              Trust
            </a>
            <a href="#masterplan" className="transition-colors hover:text-foreground">
              Masterplan
            </a>
          </nav>
          <Button asChild className="rounded-full px-6">
            <Link href={demoRoute}>Book a walkthrough</Link>
          </Button>
        </header>

        <main className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-8 sm:px-10 lg:px-12 lg:pb-28">
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/85 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground shadow-sm backdrop-blur">
                <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Independent revenue OS for agencies
              </div>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl font-normal leading-[0.98] text-foreground sm:text-6xl lg:text-7xl">
                Own the first response.
                <br />
                Control the live workflow.
                <br />
                Win the next seller.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                Casablanca gives real-estate agencies a WhatsApp-first command layer for speed-to-lead,
                routing, accountability, and proof-of-performance. It is built to become the operating
                standard around inbound demand, not another media toy or bloated CRM clone.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-full px-7">
                  <Link href={demoRoute} className="inline-flex items-center gap-2">
                    Book a walkthrough
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full px-7">
                  <Link href={masterplanRoute} className="inline-flex items-center gap-2">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    Read the masterplan
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="rounded-full px-6">
                  <Link href={studioRoute} className="inline-flex items-center gap-2">
                    See the product preview
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <span className="rounded-full border border-border bg-background/70 px-3 py-2">
                  Spain first
                </span>
                <span className="rounded-full border border-border bg-background/70 px-3 py-2">
                  Portugal next
                </span>
                <span className="rounded-full border border-border bg-background/70 px-3 py-2">
                  Italy on the clock
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(156,97,55,0.18),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(111,94,74,0.14),transparent_34%)] blur-2xl" />
              <Card className="relative overflow-hidden rounded-[32px] border-border/80 bg-background/92 shadow-[0_34px_100px_rgba(31,26,20,0.12)]">
                <CardHeader className="border-b border-border/80 pb-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Command layer
                      </p>
                      <CardTitle className="mt-2 font-serif text-3xl font-normal leading-tight">
                        Madrid office overview
                      </CardTitle>
                    </div>
                    <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-primary">
                      Live
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Median first response", value: "01:42" },
                      { label: "Leads recovered this week", value: "+18" },
                      { label: "Weekly proof memos", value: "12 sent" },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-2xl border border-border/70 bg-secondary/55 p-4"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                          {metric.label}
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[26px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(248,241,229,0.88))] p-5">
                      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        <span>Live inbox</span>
                        <span>Idealista forwarding</span>
                      </div>
                      <div className="mt-5 space-y-4">
                        <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Ana Garcia</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Interested in a 2-bed flat in Chamberi. Wants a viewing this week.
                              </p>
                            </div>
                            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              New lead
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                            AI first response sent in 48s
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground/90">
                            Confirmed preferred area, budget band, and scheduling intent. Confidence
                            remained high until listing-specific availability was requested.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">Human takeover</p>
                            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Marta Ruiz
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Handoff triggered when the lead asked for a same-week viewing window and
                            mortgage timing advice.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[26px] border border-border/80 bg-secondary/55 p-5">
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                          Manager proof memo
                        </p>
                        <div className="mt-4 space-y-3">
                          {[
                            "92% of leads answered inside SLA",
                            "3 threads escalated for human local context",
                            "Seller page launched for 5 owner opportunities",
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
                          Expansion wedge
                        </p>
                        <p className="mt-3 font-serif text-2xl font-normal leading-tight text-foreground">
                          Daily buyer-side execution becomes seller-side proof.
                        </p>
                        <p className="mt-3 text-sm leading-6 text-foreground/85">
                          Casablanca compounds from response control into owner capture, proof pages,
                          and listing presentation assets grounded in real operating data.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            {marketSignals.map((signal, index) => (
              <div
                key={signal.label}
                className="animate-enter rounded-[24px] border border-border/80 bg-background/85 p-5 shadow-[0_18px_60px_rgba(31,26,20,0.06)]"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {signal.label}
                </p>
                <p className="mt-3 font-serif text-3xl font-normal leading-tight text-foreground">
                  {signal.value}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
              </div>
            ))}
          </section>

          <section id="platform" className="mt-24">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                What Casablanca actually does
              </p>
              <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-foreground sm:text-5xl">
                A workflow company first. A media layer only where it helps the workflow.
              </h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
                The company plan is explicit about sequence. Casablanca starts on the path of money,
                becomes part of daily operating behavior, then expands into seller acquisition and a
                selective marketplace. The UI should make that obvious.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
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

          <section id="trust" className="mt-24 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="rounded-[30px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,251,242,0.94),rgba(248,241,229,0.84))] p-6 shadow-[0_28px_90px_rgba(31,26,20,0.08)] sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Why this feels credible
              </p>
              <h3 className="mt-4 font-serif text-4xl font-normal leading-tight text-foreground">
                Confidence comes from visible control, not louder AI claims.
              </h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Harvey and Legora both present themselves as serious workflow infrastructure: clear
                outcomes, constrained product language, and strong trust signals. Casablanca needs the
                same posture for agencies.
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

            <div className="space-y-4">
              <div className="rounded-[30px] border border-border/80 bg-background/92 p-6 shadow-[0_24px_70px_rgba(31,26,20,0.07)] sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                  The loop we are trying to own
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

              <div
                id="masterplan"
                className="rounded-[30px] border border-primary/25 bg-primary/10 p-6 sm:p-8"
              >
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">
                  Strategy access
                </p>
                <h3 className="mt-4 font-serif text-4xl font-normal leading-tight text-foreground">
                  Every authored markdown file now has a home under `/masterplan`.
                </h3>
                <p className="mt-4 max-w-2xl text-base leading-8 text-foreground/85">
                  The route now covers the full `MASTER-PLAN` set alongside the repo-authored
                  documentation that supports implementation and operating context.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="rounded-full px-7">
                    <Link href={masterplanRoute} className="inline-flex items-center gap-2">
                      Open the reading room
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full px-7">
                    <Link href={demoRoute} className="inline-flex items-center gap-2">
                      Talk through the rollout
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
