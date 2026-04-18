export type MasterPlanDoc = {
  slug: string;
  title: string;
  label: string;
  filename: string;
};

export const DOCS: readonly MasterPlanDoc[] = [
  {
    slug: "read-first",
    filename: "MASTERPLAN-3Y-REWRITE.md",
    title: "Read First",
    label: "Read first",
  },
  {
    slug: "ai-doctrine",
    filename: "AI-DOCTRINE.md",
    title: "AI doctrine",
    label: "AI doctrine",
  },
  { slug: "overview", filename: "MASTERPLAN.md", title: "Masterplan", label: "Masterplan" },
  {
    slug: "research",
    filename: "RESEARCH-FINDINGS.md",
    title: "Research findings",
    label: "Research",
  },
  {
    slug: "competition",
    filename: "COMPETITIVE-LANDSCAPE.md",
    title: "Competitive landscape",
    label: "Competition",
  },
  {
    slug: "product",
    filename: "PRODUCT-ROADMAP.md",
    title: "Product roadmap",
    label: "Product",
  },
  { slug: "gtm", filename: "GTM-ROADMAP.md", title: "GTM roadmap", label: "GTM" },
  {
    slug: "finance",
    filename: "FINANCIAL-MODEL.md",
    title: "Financial model",
    label: "Finance",
  },
  {
    slug: "build",
    filename: "RESPONDE-BUILD-PLAN.md",
    title: "Build plan",
    label: "Build",
  },
  {
    slug: "operating-rhythm",
    filename: "OPERATING-RHYTHM.md",
    title: "Operating rhythm",
    label: "Operating",
  },
  {
    slug: "execution-2026",
    filename: "EXECUTION-PLAN-Q2-Q4-2026.md",
    title: "Execution plan for Q2 to Q4 2026",
    label: "Execution 2026",
  },
] as const;

export const DEFAULT_SLUG = DOCS[0].slug;

export const getDoc = (slug: string): MasterPlanDoc | undefined =>
  DOCS.find((d) => d.slug === slug);
