import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderPlus,
  Globe,
  Presentation,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@casablanca/ui";

const quickActions = [
  {
    title: "Spin up a listing workspace",
    description:
      "Gather MLS data, collaborators, and required assets. We will scaffold the brief for you.",
    cta: "Start from template",
    href: "/app/onboarding?step=brand",
    icon: FolderPlus,
  },
  {
    title: "Import from MLS or Firecrawl",
    description:
      "Paste a listing URL to ingest copy, imagery, and floor plans without manual uploads.",
    cta: "Connect a source",
    href: "/app/onboarding?step=listings",
    icon: Globe,
  },
  {
    title: "Upload raw media",
    description:
      "Drop photography, video, or 3D assets to keep the studio as the single source of truth.",
    cta: "Open uploads",
    href: "#",
    icon: UploadCloud,
  },
  {
    title: "Book a creative review",
    description:
      "Invite stakeholders to comment on drafts and ready final deliverables for handoff.",
    cta: "Schedule working session",
    href: "mailto:product@casablanca.cloud",
    icon: Users,
  },
];

const pipelineStages = [
  {
    title: "Discovery",
    listings: 3,
    summary: "Listings collecting briefs, comps, and MLS-ready data.",
    highlight: "2 briefs due this week",
  },
  {
    title: "Creative in progress",
    listings: 5,
    summary: "Media generation, copywriting, and approvals happening here.",
    highlight: "Fal jobs queued: 4",
  },
  {
    title: "Launch prep",
    listings: 2,
    summary: "Packaging collateral, sequencing drip campaigns, and scheduling releases.",
    highlight: "Stripe onboarding pending",
  },
];

const recommendedFlows = [
  {
    title: "Luxury listing reveal",
    description:
      "Cinematic reel + agent voiceover, carousel post, email blast, and postcard template.",
    steps: "6 assets • 3 automations",
  },
  {
    title: "Open house momentum",
    description:
      "Weekend reminder cadence with automated follow-up tasks for captured leads.",
    steps: "4 assets • 2 automations",
  },
  {
    title: "Referral nurture",
    description:
      "Quarterly touchpoints with referral partners, powered by AI-personalized snippets.",
    steps: "3 assets • 1 automation",
  },
];

const activityFeed = [
  {
    title: "Fal visual refinement finished",
    description: "Casablanca Loft set delivered with 8 hero stills.",
    timestamp: "4m ago",
  },
  {
    title: "Listing brief approved",
    description: "Prospect Heights brownstone ready for launch prep stage.",
    timestamp: "38m ago",
  },
  {
    title: "Stripe customer created",
    description: "Payment profile linked for Willow Lane homeowners.",
    timestamp: "Today, 9:12 AM",
  },
];

export default function StudioPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-12">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Studio
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Launch and orchestrate every listing campaign
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Coordinate discovery, AI-assisted asset generation, and approvals without juggling tabs.
              The studio keeps listings, media, and automations in sync.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Button size="lg" className="inline-flex items-center gap-2">
              Start a workspace
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Link
              href="mailto:product@casablanca.cloud"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Need something bespoke? Let us know.
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 sm:px-12">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="h-full border-primary/20 bg-background">
                <CardHeader className="flex flex-col gap-4">
                  <span className="inline-flex w-fit rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg font-semibold">
                      {action.title}
                    </CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild variant="secondary" className="inline-flex items-center gap-2">
                    <Link href={action.href}>
                      {action.cta}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Active listing pipeline</CardTitle>
                <CardDescription>
                  Track how listings progress from discovery into launch-ready collateral.
                </CardDescription>
              </div>
              <Button variant="outline" asChild size="sm">
                <Link href="#">
                  View all listings
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
              {pipelineStages.map((stage) => (
                <div
                  key={stage.title}
                  className="rounded-lg border border-border/60 bg-muted/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{stage.title}</h3>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stage.listings} listings
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{stage.summary}</p>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {stage.highlight}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/40 bg-background">
            <CardHeader>
              <CardTitle className="text-lg">Recommended automations</CardTitle>
              <CardDescription>
                Wire up repeatable flows that keep listings warm and teams coordinated.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {recommendedFlows.map((flow) => (
                <div
                  key={flow.title}
                  className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-4"
                >
                  <h3 className="text-sm font-semibold">{flow.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{flow.description}</p>
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                    <Presentation className="h-4 w-4" aria-hidden="true" />
                    {flow.steps}
                  </p>
                </div>
              ))}
              <Button variant="link" className="justify-start px-0 text-sm" asChild>
                <Link href="#">
                  Browse the playbook library
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Recent activity</CardTitle>
                <CardDescription>
                  Snapshot of creative output, approvals, and billing signals.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="#">
                  View history
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-6">
              {activityFeed.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-2 rounded-md border border-border/50 bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {item.timestamp}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Studio checklist</CardTitle>
              <CardDescription>
                Action items to wire Casablanca into your team&apos;s flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {[
                {
                  title: "Link your Convex deployment",
                  description: "Authenticate the CLI and sync schema updates.",
                },
                {
                  title: "Configure Clerk",
                  description: "Set publishable + secret keys and create the Convex JWT template.",
                },
                {
                  title: "Draft your first automation",
                  description: "Combine Fal outputs, Stripe billing, and PostHog funnels.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-md border border-dashed border-primary/30 bg-background p-4"
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
              <Button variant="secondary" asChild className="inline-flex items-center gap-2">
                <Link href="mailto:product@casablanca.cloud">
                  Partner with our team
                  <Users className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
