import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MessageCircle, Sparkles } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@casablanca/ui";

const talkingPoints = [
  {
    title: "Map your listing workflows",
    description:
      "See how Casablanca keeps brand, media, and approvals aligned with your team's daily rhythm.",
  },
  {
    title: "Wire fal.ai into your pipeline",
    description:
      "Review prebuilt generation templates and how we tailor them to each market you serve.",
  },
  {
    title: "Plan your rollout",
    description:
      "Discuss crew onboarding, lead routing, and the integrations needed to go live with confidence.",
  },
];

const prepChecklist = [
  "Current marketing stack & MLS requirements",
  "Media volume and turnaround expectations",
  "Automations or playbooks you want to standardize",
];

export const metadata: Metadata = {
  title: "Book a demo | Casablanca",
  description:
    "Schedule a walkthrough of the Casablanca media studio and CRM so your listings launch with complete collateral.",
};

export default function BookDemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 sm:px-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Book a walkthrough
            </span>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Plan the rollout of your listing studio with the Casablanca team.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              We will unpack how your brokers, creatives, and partners collaborate today, then show the media automations and approval flows Casablanca keeps on rails.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="default">
                <Link href="mailto:product@casablanca.cloud" className="inline-flex items-center gap-2">
                  Email us directly
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="https://cal.com/product@casablanca.cloud/demo" className="inline-flex items-center gap-2">
                  View calendar slots
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <Card className="border-dashed border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Arrive with your priorities
                </CardTitle>
                <CardDescription>
                  Bring a quick rundown of the following so we can point Casablanca at the right problems.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {prepChecklist.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-background">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Share your team info</CardTitle>
              <CardDescription>
                Drop the essentials and we will send a tailored agenda within one business day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Full name
                    <Input placeholder="Jordan Alvarez" required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Work email
                    <Input type="email" placeholder="jordan@yourteam.com" required />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Brokerage or team name
                  <Input placeholder="Atlas Collective" required />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Team size
                  <Input placeholder="8 agents" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  What should we focus on?
                  <Textarea
                    rows={4}
                    placeholder="Listing volume, current collateral workflow, tools you use today..."
                    required
                  />
                </label>
                <Button type="submit" size="lg" className="inline-flex items-center gap-2">
                  Request a session
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  We will reply with available times and any prep materials within 24 hours. Prefer to skip the form? Email us at
                  <Link href="mailto:product@casablanca.cloud" className="ml-1 underline">
                    product@casablanca.cloud
                  </Link>
                  .
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 sm:px-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {talkingPoints.map((point) => (
            <Card key={point.title} className="border-primary/20 bg-background">
              <CardHeader>
                <CardTitle className="text-base font-semibold">{point.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {point.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
