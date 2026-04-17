# Casablanca — Competitive Landscape

Companion to `MASTERPLAN.md`, `PRODUCT-ROADMAP.md`, `GTM-ROADMAP.md`, and `RESEARCH-FINDINGS.md`.

This document is an honest, source-backed view of who we're competing with **per wedge**, where the market is already crowded, and how that reshapes our conviction in each phase of the plan.

**Date:** 2026-04-17. Refresh every quarter or whenever we hear a new competitor name in the field.

---

## TL;DR — what changed after doing the work

1. **The AI media studio category is saturated.** Pedra.ai, Idealista's own VHS + Texto Inteligente, Witei, Mobilia, Inmovilla, and a fleet of global players (Styldod, Collov, BoxBrownie, Virtual Staging AI, REimagineHome) all ship it. Price floor has collapsed to €2/photo or free.
2. **Media Studio is no longer our primary acquisition wedge.** It remains a *bundled* feature and a viral demo, not a standalone SKU we build a company around.
3. **AI Speed-to-Lead (Responde) is the primary wedge.** No Spanish-market incumbent ships a true WhatsApp-native 24/7 speed-to-lead bot targeting the 19:00–23:00 Spanish search surge. ROI math is quantifiable in euros lost per lead.
4. **Unified Lead Inbox is the primary retention hook.** Inmovilla (Idealista-owned) and Witei do not have real omnichannel inboxes. This is still wide open.
5. **Conviction levels per phase** are now explicit in the product and GTM roadmaps. They move as we learn.

---

## 1. Per-wedge competitive analysis

### 1.1 AI Media Studio (photo enhancement + virtual staging + listing copy)

**Our original plan:** lead with media studio as the €29/mo wedge. Ship in weeks 1–2. Pay back in week 3.

**What the research shows:**

| Competitor | Coverage | Pricing | Spanish market? | Source/signal |
|---|---|---|---|---|
| **Pedra.ai** | Virtual staging, photo enhancement, videos, 360° tours, floor plans, listing copy, social reels | €29/mo Pro (100 credits), €59/mo Plus, custom Enterprise | **YES** — active. 20k+ agents globally. Case study: David González, eXp Barcelona, DOM dropped 67→34 days, cost €2,000→€24 | Pedra public site + case studies; Barcelona real-estate LinkedIn posts |
| **Idealista Home Staging Virtual (VHS)** | Virtual staging via Idealista's platform (launched ~2020) | Bundled into Idealista portal contracts | **YES** — directly bundled with the #1 portal. Agents already paying Idealista get it inside their existing subscription | Idealista product pages; Idealista News |
| **Idealista Texto Inteligente** | AI listing description generation | **Currently free** (Nov 2023 launch) — 20,000+ descriptions generated in first 6 months | **YES** — inside the Idealista agent dashboard, zero friction for any agent already posting | Idealista News announcement |
| **Witei** | AI home staging + CRM bundle | Inside €49–99/mo CRM tier | **YES** — Spanish CRM, bundled | Witei product site |
| **Inmovilla** | AI staging + description features (added 2024–2025) | Bundled into CRM (~€40–80/mo) | **YES, dominant** — ~90% of Spanish MLS/agrupaciones use Inmovilla | Inmovilla product site; industry sources |
| **Mobilia CRM** | AI staging + CRM bundle | Bundled | **YES** | Mobilia product site |
| **REHAVITAT** | Human-assisted virtual staging | **€2/photo** | **YES** — Spain-native | REHAVITAT.com |
| **Virtual Staging AI** | Fully automated staging | $1 per image (~€0.90) | Global, no Spain-specific localization | virtualstagingai.app |
| **Collov AI** | Staging + design | $0.23–$1.99 per image | Global | collov.ai |
| **REimagineHome** | Staging, decluttering, exteriors | $49/mo for 50 images | Global, US-primary | reimaginehome.ai |
| **Styldod** | Human-reviewed staging | $16–$23 per image | Global, US-primary | styldod.com |
| **BoxBrownie** | Premium human-in-loop staging | $32 per image | Global, premium | boxbrownie.com |
| **Apply Design / StageHQ** | Self-serve staging | $19 for 20 photos (StageHQ) | Global | Product sites |

**The hard truth:**
- A Spanish agent at €29/mo today can already get virtual staging + AI descriptions from Pedra (same price), Idealista (bundled), Witei/Inmovilla (bundled), or pay €2/photo at REHAVITAT. The "€29/mo for AI staging" slot is filled.
- The category's wow-factor has worn off for sophisticated agents. The ones who haven't tried it are marginal adopters; the ones who have tried it already have a tool.
- Pedra ships Spain-localized case studies. They are not a distant threat; they are *here*.

**What we still win at:**
- **Speed of demo.** A 90-second before/after still closes a first meeting. This is marketing, not a SKU.
- **Ley de Vivienda compliance baked into copy generation.** Spanish-specific legal disclosure auto-populated. Idealista has it inside their portal; Pedra does not.
- **Spanish tone tuning.** "cálido", "mediterráneo", "clásico" presets feel native. Global players use English-first prompts.
- **Bundled into the rest of the OS.** Staging happens *inside* the listing cockpit, not in a separate tab of a separate tool. Context is the moat.

**Strategic implication:** Media studio is a feature we ship, bundle, and demo — **not a wedge we lead with**. Lead pricing should not be "€29/mo for staging" (Pedra-parity) but "staging included free with Responde" or "staging included with Listing Cockpit".

**Conviction on media studio as standalone product: 5/10 MEDIUM-LOW.**
**Conviction on media studio as bundled feature / demo asset: 9/10 HIGH.**

---

### 1.2 AI Speed-to-Lead ("Responde") — WhatsApp auto-responder + portal-lead bridge + missed-call rescue

**What the research shows:**

| Competitor | What they do | Gap for Casablanca |
|---|---|---|
| **WhatsApp Business API** (360dialog, Twilio) | Infrastructure only | Not a product — we build on top |
| **Inmovilla** | Has WhatsApp notifications for leads; no AI auto-response, no 24/7 bot | Wide open gap |
| **Witei** | Has WhatsApp integration; no AI bot | Wide open gap |
| **Idealista Tools** | Lead email forwarding; no WhatsApp, no AI response | Wide open gap |
| **HubSpot / Pipedrive** (used by ~5% of large Spanish agencies) | Generic CRM, poor Spanish real-estate fit, no WhatsApp-native AI bot | We're vertical-specific |
| **Zapier + custom GPT bots** | Agents duct-tape this together themselves | Our advantage: done-for-you, Spanish-tuned, Ley-de-Vivienda-aware |
| **US players (Zillow Premier Agent, Follow Up Boss, kvCORE)** | Speed-to-lead focused, no Spain presence, not WhatsApp-native | No Spain entry, no WhatsApp, English-first |
| **iSalesCRM, Chatdesk, Manychat**-style bots | Generic chatbot tooling | Not real-estate-specific, not Spanish-tuned, no portal lead ingestion |

**The hard truth:** we could not find a single Spanish-market product that (a) auto-replies in <60s on WhatsApp, (b) ingests Idealista/Fotocasa/Habitaclia lead emails, (c) runs a Spanish-language qualification script, (d) routes to the agent. This is greenfield.

**Research-backed ROI pitch:**
- 40% of leads lost = €72–120k/year per agency (per `RESEARCH-FINDINGS.md` §2).
- 5-min response = 100× contact probability vs. 30 min.
- 62% of Spanish searches happen 19:00–23:00, after agent hours.

**Strategic implication:** This is the sharpest wedge we have. Every agent can instantly compute "this pays for itself if it saves me one deal per year." €99/mo vs. a €150–400k commission recovered.

**Conviction on Responde as primary Phase 0 wedge: 8/10 HIGH.**
- Upside: greenfield Spanish category, quantified euro-value, 24/7 coverage addresses a real temporal gap.
- Downside: WhatsApp Business API onboarding friction (business verification, 3–10 day approval) could slow week-1 revenue. Mitigate: agency friends can pre-apply before product launch; we use personal-WhatsApp Chrome-extension bridge as fallback for solo agents.

---

### 1.3 Unified Lead Inbox (omnichannel aggregation)

**What the research shows:**

| Competitor | Omnichannel capability | Gap |
|---|---|---|
| **Inmovilla** | Fragmented per-channel widgets; no unified inbox; manual tagging | Dominant but weak here |
| **Witei** | Email + phone log; no WhatsApp/IG DM merge | Weak |
| **Idealista Tools** | Portal leads only; no cross-portal, no off-portal | Weak |
| **Fotocasa Pro** | Fotocasa leads only | Weak |
| **HubSpot / Pipedrive** | General-purpose omnichannel; not real-estate-tuned, not WhatsApp-native in Spain | Horizontal, not vertical |
| **Dialpad, Front** | Inbox-first products, English-primary, generic | Not Spain-native, not portal-integrated |

**Strategic implication:** Spain's dominant agent CRM (Inmovilla) is not unified. Nobody else is Spain-native here either. The Unified Inbox is the retention hook — once 3 months of agent+seller+buyer conversations live inside Casablanca, leaving costs a divorce.

**Conviction on Unified Inbox as Phase 1 flagship: 8/10 HIGH.**

---

### 1.4 Captación Suite (valuation widgets, FSBO converter, microsites, reel generator)

**What the research shows:**

| Competitor | What they do | Gap |
|---|---|---|
| **PriceHubble** (Swiss, Europe) | AVM widgets for agencies | Premium-priced, not SMB-friendly; Spain presence limited |
| **Idealista Data** | AVM (sold to banks and institutional) | Not packaged for agents |
| **Tinsa / Euroval** | Professional appraisals (human-led) | Slow, expensive, not a lead magnet |
| **Housfy / Casavo** | Consumer-facing valuation tools | They're agents-killers, not agent-enablers |
| **Real Geeks, Placester** (US) | Agent-microsite builders | US-only, no Spanish portals |
| **FSBO (particulares) scraping** | Nobody in Spain offering this packaged | Wide open |
| **Social reel generators** (e.g., Pedra's reels) | Pedra has basic version; nobody Spain-specific | Partial competition |

**Strategic implication:** Captación (seller acquisition) is where agents feel the sharpest pain per `RESEARCH-FINDINGS.md` §5. No Spain-specific, agent-packaged AVM+FSBO+microsite combo exists. Novel wedge.

**Conviction on Captación Suite as Phase 2 flagship: 7/10 MEDIUM-HIGH.**
- Upside: novel category, addresses known pain, becomes a second acquisition wedge if Responde saturates.
- Downside: AVM accuracy requires data partnerships (Catastro + Idealista Data or proprietary index). FSBO scraping is regulatory grey zone — must be very careful.

---

### 1.5 Transaction Rails (mortgage, e-sign, escrow, document concierge)

**What the research shows:**

| Competitor | Coverage | Gap |
|---|---|---|
| **iAhorro, TrioTeca, Idealista Hipotecas** | Mortgage brokers direct-to-consumer | Partners, not competitors |
| **Signaturit, Docusign, Adobe Sign** | E-signature infra | Partners |
| **Ancert** | Spanish notary network software | Potential partner |
| **CertiCalia, and energy-cert providers** | Energy cert brokers | Partners |
| **Registro de la Propiedad API** | Nota simple fetching | Infra, not competitor |
| **Spanish proptech (Housfy, Casavo)** | iBuyer / transaction-as-a-service | Adjacent, different model |

**Strategic implication:** Transaction rails are integration work, not competitive work. Each integration is boring and slow; the graph of integrations becomes the moat. This is where the €1B math lives — SaaS alone can't get there.

**Conviction on transaction rails strategy: 8/10 HIGH.**
**Conviction on transaction rails 12-month execution: 6/10 MEDIUM.** — each partnership carries partner-dependency risk, regulatory onboarding time, and BaaS complexity.

---

### 1.6 Agent CRM (core OS)

**What the research shows:**

| Competitor | Share / note |
|---|---|
| **Inmovilla** | ~90% of MLS/agrupaciones. Owned by Idealista. Sticky but UI-dated. |
| **Witei** | ~10–15% of independents. Modern-ish UI, Spanish. |
| **Mediaelx** | Legacy, smaller share |
| **Idealista Tools** | Idealista's own agent suite, bundled with portal tier |
| **Fotocasa Pro** | Fotocasa's agent suite |
| **Casafari** | Market-data+CRM hybrid, multi-country |
| **HubSpot / Pipedrive / Zoho** | <5% of Spanish agencies, generic |

**Strategic implication:** Direct CRM-vs-CRM feature fight with Inmovilla is a losing frame — they have 90% share, 15 years of feature depth, and Idealista's bundled distribution. We win by being the **only independent AI-native agent OS in Spain** and using Inmovilla import as the conversion wedge. The Idealista-owns-Inmovilla positioning (per `RESEARCH-FINDINGS.md`) is our single sharpest competitive asset.

**Conviction on Agent OS / CRM as Phase 2 deliverable: 7/10 MEDIUM-HIGH.**

---

## 2. Revised wedge hierarchy

Before research:
1. ~~Media Studio~~ (primary wedge)
2. Listing Cockpit
3. Agent OS
4. Transaction Rails

After research:
1. **AI Speed-to-Lead "Responde"** (primary wedge, Phase 0)
2. **Unified Lead Inbox** (Phase 1 flagship, primary retention hook)
3. **Captación Suite** (Phase 2 flagship, second acquisition wedge)
4. **Transaction Rails** (Phase 3, €1B math)
5. **Media Studio** (bundled demo asset, not a wedge)

---

## 3. Conviction ladder — at a glance

| Phase | Product focus | Conviction | Rationale |
|---|---|---|---|
| **0a** | AI Speed-to-Lead ("Responde") | **8/10 HIGH** | Greenfield Spanish category, quantified euro ROI, 24/7 coverage addresses 19:00–23:00 surge, no true Spanish competitor |
| **0b** | Media Studio (bundled/demo) | **5/10 MEDIUM-LOW** as standalone · **9/10 HIGH** as bundled demo | Saturated category; still the best 90-second demo in real estate |
| **1** | Listing Cockpit + Unified Inbox | **8/10 HIGH** | Unified Inbox is open; Listing Cockpit + Ley-de-Vivienda compliance is Spain-specific; Inmovilla migration wedge |
| **2** | Agent OS + Captación Suite | **7/10 MEDIUM-HIGH** | Captación is novel; CRM-vs-Inmovilla is hard but Idealista-owns-Inmovilla frame is sharp |
| **3** | Transaction Rails + Document Concierge | **8/10 strategy · 6/10 execution** | €1B math lives here, but partnership velocity is the risk |
| **4** | European expansion (PT, IT) | **6/10 MEDIUM** | Proven SaaS playbook; localization + country-lead hiring risk |
| **5** | Consumer layer + platform + rollup | **4/10 LOW** | Aspirational, too many unknowns; don't plan around it |

**How to read this:** conviction is about *us hitting the commercial milestones for this phase*, not whether the space itself exists. A 5/10 is not "we're wrong" — it's "if we bet the company on this alone, we're at coin-flip odds." An 8/10 is "we should lean in and defend this position hard."

---

## 4. How this changes the plan

### In `PRODUCT-ROADMAP.md`
- Phase 0 reordered: **Responde (Weeks 1–4) is primary**; Media Studio (Weeks 1–2) is secondary/bundled.
- Phase 0 pricing rewritten so Responde is the lead SKU (€99/mo), Studio is bundled into Responde at no extra cost for Pro tier, standalone Studio Lite (€29) remains as funnel top.
- Conviction line added to each phase header.

### In `MASTERPLAN.md`
- §3 "The wedge" reframed: primary wedge is Responde, not Media Studio.
- §6 competitive table extended to reflect the saturated-media-studio reality.
- §8 milestone table gets a conviction column.

### In `GTM-ROADMAP.md`
- Week 1–2 pitch rewritten: "no pierdas otro lead" (the math story) over "mira cómo queda el piso" (the wow story). The wow demo is still used, just as the *second* beat, not the first.
- Revenue milestone table gets a conviction column.

### In `FINANCIAL-MODEL.md`
- ARPU assumptions revisited: Responde at €99 anchors Phase 0, not Studio Lite at €29. Blended ARPU Phase 0 exit target moves from ~€60 to ~€90.

---

## 5. What we monitor (competitive early-warning)

Weekly, one founder owns each of these:
- **Pedra.ai** — new features, Spanish case studies, pricing moves. Monitor pedra.so + their LinkedIn.
- **Idealista** — any new agent-tool shipped, any CRM-adjacent feature in Idealista Tools, VHS pricing changes. Monitor Idealista News blog + Idealista product updates.
- **Inmovilla** — product changelog (if public), any AI-feature announcements, any mobile-app improvements.
- **Witei** — product + pricing + any Spanish proptech press.
- **Mobilia** — AI feature launches.
- **Housfy / Casavo / PriceHubble** — any move toward agent-OS positioning.
- **EU entries** — a US or UK player opening Spain is an existential signal; flag immediately.

If any of these ships a direct competitor to our current wedge within 90 days of our launch, we hold an emergency strategy session and re-examine the conviction ladder.

---

## 6. The one line to remember

**Our edge is not any single feature. Our edge is that we are the only independent, AI-native, Spain-native operating system for agents — positioned against Idealista's three-way bundle (portal + Inmovilla + Tools) — and we ship weekly.**

Every feature in the roadmap must defend or extend that line.
