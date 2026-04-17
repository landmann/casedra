# Casablanca — Product Roadmap

Companion to `MASTERPLAN.md`, `COMPETITIVE-LANDSCAPE.md`, `RESEARCH-FINDINGS.md`. This document specifies what we build, in what order, and what we deliberately do not build. **Revenue gates** at the end of each phase block further product investment — if we're behind on revenue, we stop shipping features and return to selling.

Each phase header carries a **conviction level (1–10)** reflecting how confident we are we'll hit the commercial milestones of that phase given what we know today. Conviction is re-scored whenever a material competitor move, product learning, or gate slip changes the picture. See `COMPETITIVE-LANDSCAPE.md` §3 for the full conviction ladder.

**Operating cadence:** weekly releases, every release in production the Friday it ships, every release demoed to at least one real Madrid agent the following Monday.

**Today's date:** 2026-04-17. All dated milestones in this document are absolute, not relative.

---

## Revenue gates at a glance

| Gate | Date (≤) | Min MRR | Min paying agencies | Consequence of missing |
|---|---|---|---|---|
| G0 | 2026-05-01 | €300 | 5 | Stop all new features. Go to field full-time. |
| G1 | 2026-05-17 | €2,000 | 20 | Hold Phase 1 scope. Fix Phase 0 pricing/demo. |
| G2 | 2026-07-17 | €15,000 | 120 | Delay Phase 2. Hire a BDR before another engineer. |
| G3 | 2026-10-17 | €50,000 | 500 | Don't open Barcelona until Madrid PMF locked. |
| G4 | 2027-01-17 | €100,000 | 800 | Don't raise seed; extend pre-seed instead. |
| G5 | 2027-04-17 | €225,000 | 1,800 | Don't start Phase 3 rails; double down on SaaS. |
| G6 | 2027-10-17 | €700,000 | 4,000 | Delay Italy. Series A paused. |
| G7 | 2028-04-17 | €2,240,000 | 8,000 | Delay France. Re-tune unit economics. |

These gates are the product roadmap's clock. Features exist to pass the next gate; nothing else.

---

## 0. Product philosophy

Five non-negotiable product principles.

1. **Agent-first, not admin-first.** Every screen is designed for a tired agent on an iPhone 12 walking between viewings. Desktop is the second-class surface.
2. **Spanish-first UX.** Copy, pricing, document names, and flows reflect Spanish real estate (ficha, nota simple, arras, cédula, nota encargo), not a translated US product.
3. **AI is a feature, not a section.** We don't have an "AI tab". Every input has an AI assist one keystroke away.
4. **WhatsApp-native.** Every outbound message defaults to WhatsApp. Every lead shows up in WhatsApp. We meet agents where they are.
5. **Observable by the agent.** Every AI action shows its work: "this description mentions X because of Y in the photos". Agents trust what they can audit.

---

## Phase 0 — AI Speed-to-Lead (primary) + Media Studio (bundled) (Weeks 1–4 · Apr 17 → May 17, 2026)

**Conviction: 8/10 HIGH on Responde as primary wedge · 5/10 MEDIUM-LOW on Media Studio as standalone SKU · 9/10 HIGH on Media Studio as bundled demo asset.** See `COMPETITIVE-LANDSCAPE.md` §1.1–1.2.

**Why this ordering changed:** second-wave competitive research (Pedra.ai at €29/mo with 20k+ agents and Barcelona case studies, Idealista's free Texto Inteligente + bundled VHS, Witei/Inmovilla/Mobilia all shipping AI staging, €2/photo price floor at REHAVITAT) makes Media Studio a saturated category. Standalone-media-studio revenue is possible but the wedge is crowded. AI Speed-to-Lead is greenfield in Spain with a quantified euro-denominated ROI pitch — this is our sharper acquisition edge.

**Goal:** paying customers in week 2. Lead the sales motion with Responde (the math demo). Use Media Studio as the viral 90-second wow demo that opens the meeting, not the SKU we bill for.

**Revenue gate G0 (2026-05-01):** €300 MRR / 5 paying agencies. Misses = freeze feature work.
**Revenue gate G1 (2026-05-17):** €2,000 MRR / 20 paying agencies. Misses = fix pricing/demo before adding features.

**Stack leverage:** Fal.ai (Flux/Runway) + Convex (mediaJobs) + Clerk + Stripe are already scaffolded. This is an integration job, not a greenfield build. WhatsApp Business API (via 360dialog or Twilio) is wired in week 1 as the critical path for Responde.

**Order of operations in Phase 0:**
1. **Weeks 1–2:** ship Media Studio (photo, staging, copy) — this is **faster** to ship and is the *demo asset*. Sales meetings open with the before/after. Studio Lite €29 sits as a low-friction funnel top but is not the target conversion.
2. **Weeks 2–3:** WhatsApp Business API + Responde auto-responder ships in parallel. This is the product we bill for.
3. **Week 4:** convert Studio trialists into Responde paid customers via the lost-lead-math pitch.

### Must-ship features — Media Studio (Weeks 1–2, bundled demo asset)

1. **Photo enhancement pipeline**
   - Drag-and-drop upload (web) + camera capture (mobile Expo)
   - Auto-correct exposure, white balance, verticals
   - Sky replacement (blue + golden hour presets)
   - Decluttering (remove personal items, cables, trash bins)
   - Before/after slider — this is the demo
   - Output: 4K JPEG + watermarked preview

2. **Virtual staging**
   - Room type detection (sala, dormitorio, cocina, baño, terraza, estudio)
   - 6 style presets: contemporáneo, nórdico, mediterráneo, clásico, minimalista, bohemio
   - Empty-room → staged-room in <60s
   - Agent can regenerate with one click
   - Legal disclaimer overlay: "imagen generada por IA con fines ilustrativos" (required under Spanish consumer law)

3. **Twilight / golden hour conversion**
   - Daytime exterior → dusk with warm windows
   - Single model call, single button

4. **AI listing copy**
   - Input: photos + neighborhood + m² + bedrooms + price
   - Output: 120-word Spanish description, Idealista-style
   - Tone selector: profesional / cálido / premium / directo
   - Mandatory Ley de Vivienda disclosure fields pre-populated
   - Titulo generator (max 60 chars, SEO-tested)

5. **Floor plan generator (MVP)**
   - User uploads room photos + paces off dimensions
   - Output: clean 2D floor plan (SVG/PNG)
   - V0 uses a simple model (Fal/CubiCasa style); improve in phase 1.

6. **Export bundle**
   - "Descargar para Idealista" → zip of correctly-sized photos + description + titulo
   - "Descargar para Fotocasa" → same but with their image dimensions
   - Copy-to-clipboard for the description
   - **No auto-publish yet.** Phase 1 problem.

7. **Billing (Studio standalone — kept as funnel top, not primary)**
   - Stripe-subscribed plans:
     - **Studio Lite** €29/mo — 10 renders (matches Pedra's entry — this is the floor, not the target)
     - **Studio bundled free** inside every Responde tier — this is how we win price parity without a race to the bottom
   - Overage pricing: €2 per extra render
   - 7-day free trial, credit card required
   - Annual prepay: 20% off (cash flow unlock)

8. **Agent onboarding**
   - Google/email sign-up via Clerk
   - First listing setup wizard: "upload your worst listing, let's fix it"
   - First render free regardless of trial state (we want the wow — this is marketing)

### Must-ship features — AI Speed-to-Lead "Responde" (Weeks 2–4, the primary wedge)

9. **WhatsApp / SMS 5-minute auto-responder**
   - Agent connects their WhatsApp Business number (or we provision one)
   - Incoming message from a number not already in their contacts → AI replies within 60 seconds in Spanish
   - Qualification script: budget, timeline, type of property, neighborhood preference
   - AI hands back to agent after qualification with a summary
   - 24/7 coverage (addresses the 19:00–23:00 search surge — 62% of searches happen then)

10. **Portal-lead capture → WhatsApp bridge**
    - Idealista / Fotocasa / Habitaclia lead emails forwarded to a Casablanca inbox
    - Lead phone number auto-extracted, message auto-sent over WhatsApp within 2 minutes of the email arriving
    - Every portal lead becomes a warm WhatsApp thread

11. **Missed-call rescue**
    - Agent's phone gets a missed call → Casablanca texts the caller a WhatsApp follow-up within 3 minutes
    - "Vi tu llamada, soy [Agent Name]. ¿Qué piso te interesa?"

12. **Lead dashboard**
    - Leads ranked by Casablanca's qualification score
    - Time-to-first-response per lead, aggregate by agent
    - "Leads saved from the grave" counter — how many cold leads we kept alive

### Pricing for Phase 0 (repriced around Responde as primary)
- **Studio Lite** €29/mo — 10 renders (funnel top; matches Pedra parity; expected to be a stepping stone, not a destination)
- **Responde Solo** €99/mo — AI Speed-to-Lead, unlimited messages up to 2,000 leads/mo, **Studio Pro bundled at no extra cost**
- **Responde + Studio Pro** is the recommended tier. Pitch: *"€99 al mes. Recuperas un lead perdido y te sale gratis todo el año."*
- **Agencia** €349/mo — 3 seats, unlimited Responde, 300 renders, priority queue
- Annual prepay: 20% off
- 7-day free trial, credit card required
- **No standalone Studio Pro SKU.** We refuse to compete head-on with Pedra at €29–79 for staging-only. Bundle it or lose it.

### Explicitly out of scope for Phase 0
- Team features (share, approve, comment)
- Portal APIs — export files only
- CRM / contacts / pipeline
- Mobile app beyond camera capture
- Analytics dashboards
- Multi-language (Spanish only)

### Success criteria for Phase 0 (must hit by 2026-05-17)
- [ ] **G0 by 2026-05-01:** 5 paying agencies, €300 MRR, first Responde lead reply in <60s measured live
- [ ] **G1 by 2026-05-17:** 20 paying agencies, €2,000 MRR
- [ ] **≥70% of paid agencies on Responde Solo (€99) or Agencia (€349), not Studio Lite (€29)** — proves the primary-wedge thesis
- [ ] <90s median time from upload to staged output (for the demo)
- [ ] <60s median Responde auto-reply latency
- [ ] 60%+ trial-to-paid conversion
- [ ] NPS >50 from the first 20 users
- [ ] First recorded case of "Responde recovered a deal the agent would have lost" from a friend-agency — this becomes sales asset #1

---

## Phase 1 — Listing Cockpit + Unified Inbox (Months 2–4 · May 17 → Jul 17, 2026)

**Conviction: 8/10 HIGH.** Unified Lead Inbox is the retention hook nobody else in Spain ships — Inmovilla (Idealista-owned, ~90% MLS share) has only fragmented per-channel widgets, Witei is email+phone only. Ley-de-Vivienda-compliant listing cockpit is Spain-specific. See `COMPETITIVE-LANDSCAPE.md` §1.3.

**Goal:** own the listing lifecycle *and* the lead stream. Become the place agents *start* a listing and the place every lead lands.

**Revenue gate G2 (2026-07-17):** €15,000 MRR / 120 paying agencies. Misses = delay Phase 2, hire BDR not engineer.

**Research anchor:** per `RESEARCH-FINDINGS.md` §3, channel fragmentation is universal. No Spanish CRM has a true unified inbox today — Inmovilla is read-only fragments with manual tagging. This is a flagship wedge.

### Features

1. **Listing project model** in Convex
   - A `Listing` owns photos, staged variants, copy, floor plan, metadata, portal publish state
   - Versioning: every AI regen creates a version; agent can roll back
   - Sharing: generate a private link for the seller to approve the listing before publish
   - **Ley de Vivienda compliance:** mandatory disclosure fields auto-populated and validated before publish (addresses post-2023 regulatory risk)

2. **Multi-portal publisher**
   - Idealista: via their XML feed protocol (for agencies with contracts) + manual copy-paste fallback
   - Fotocasa: their feed format
   - Habitaclia: their feed format
   - Pisos.com, Yaencontré: feed format
   - "Publish to all" button with per-portal preview
   - Publish state tracked in real time (Convex subscription)

3. **Unified Lead Inbox (Phase 1 flagship)**
   - One stream for leads from: Idealista, Fotocasa, Habitaclia, Pisos.com, web forms, WhatsApp (agent's personal number via Chrome extension bridge; Business API for agencies), Instagram DM, phone calls
   - Auto-deduplication when the same lead contacts via two channels
   - Round-robin or AI-routed assignment rules
   - Portal-spend ROI view: "you spent €150 on Idealista promos, got 12 leads, 1 closed deal"
   - First-response-time SLA dashboard per agent

4. **WhatsApp inbox (upgrade of Phase 0 Responde)**
   - Replies from Casablanca sync back to the agent's phone
   - AI suggested replies in Spanish, context-aware ("this lead is asking about metro access — here's a draft")
   - Team views: who's replying to whom, no duplicate replies
   - Conversation summary + lead score auto-generated

5. **Viewings scheduler**
   - Calendar integration (Google, iCloud)
   - SMS/WhatsApp confirmations in Spanish
   - Post-viewing auto-survey to the buyer ("¿Qué te pareció el piso?")
   - No-show detection + auto-follow-up

6. **Seller reports**
   - Weekly PDF / WhatsApp message to the owner: "Your listing had 248 views, 6 enquiries, 2 viewings."
   - Political tool — agents use it to keep the listing signed to them

7. **Inmovilla / Witei / Idealista Tools import (conversion wedge)**
   - One-click CSV import, plus guided migration from Inmovilla's export format
   - Because Inmovilla is owned by Idealista, the migration pitch writes itself: *"stop paying your portal twice"*

### Pricing update (Phase 1)
- **Responde Pro** €129/mo (adds listing cockpit, multi-portal export, unified inbox seat, Studio bundled)
- **Agencia** €399/mo (3 seats, unified inbox, seller reports, Studio bundled)
- **Studio Lite** stays at €29 as funnel top
- Rule of thumb: every paying customer moves up the ladder over 90 days, or they churn anyway

### Success criteria for Phase 1 (must hit by 2026-07-17)
- [ ] **G2 by 2026-07-17:** 120 paying agencies, €15k MRR
- [ ] 40%+ of published listings use at least one AI asset
- [ ] 70%+ of agencies use unified inbox weekly
- [ ] First paying agency with 5+ seats
- [ ] 10+ Inmovilla migrations completed

---

## Phase 2 — Agent OS + Captación Suite (Months 4–9 · Jul 17, 2026 → Jan 17, 2027)

**Conviction: 7/10 MEDIUM-HIGH.** Captación Suite (AVM widget + FSBO converter + microsite + reel generator) is novel in Spain and addresses the sharpest agency pain. Core CRM vs. Inmovilla is harder — we win on Idealista-owns-Inmovilla positioning and AI-native UX, not on feature-for-feature depth. AVM accuracy carries data-partnership risk (Catastro + Idealista Data or proprietary index). See `COMPETITIVE-LANDSCAPE.md` §1.4, §1.6.

**Goal:** become the system of record for the agency. Make switching feel like divorce. And weaponize Casablanca for seller acquisition — captación is where agencies are bleeding most (per `RESEARCH-FINDINGS.md` §5).

**Revenue gates:**
- **G3 by 2026-10-17:** €50,000 MRR / 500 paying agencies
- **G4 by 2027-01-17:** €100,000 MRR / 800 paying agencies. This gate opens the seed raise.

### Features

1. **Contacts and CRM**
   - Contact types: buyer, seller, landlord, tenant, captador (referral source)
   - Pipeline stages configurable per agency
   - Deal objects linked to contacts + listings
   - Tags, custom fields, notes
   - Import from Inmovilla, Witei, Idealista Tools (CSV + API where possible)

2. **Pipeline view (Kanban + list)**
   - Drag-drop, filter by agent, time-in-stage alerts
   - Forecast view: expected commissions by month

3. **Captación Suite (Phase 2 flagship)**
   - **Valuation Lead Magnet:** embeddable AVM widget for agency website. Seller enters address → gets instant price estimate. Email + phone captured, routed to agent's pipeline.
   - **AVM wrapper:** Catastro data + neighborhood comparables + our observed-transaction data over time
   - **FSBO Converter:** scrapes particular-owner listings from Idealista/Milanuncios (public data) in the agent's geo, drafts an outreach message for the agent to send. 3–5 fresh opportunities per week per agent.
   - **Agent microsite:** SEO-optimized, public URL `casablanca.ai/inmobiliaria/domus-madrid`. Showcases portfolio, response time, days-on-market stats, client reviews — directly addresses the "owners compare agents online" reality.
   - **Social reel generator:** every new listing auto-generates an Instagram reel + LinkedIn post + TikTok draft from its photos + description.
   - **Mandate-signing via e-sign** (see Phase 3 for digital signing integration)

4. **Mobile app (real, not a shell)**
   - Photo capture → instant staging
   - Contact/deal updates on the go
   - WhatsApp inbox
   - Viewings calendar and route optimization
   - Offline support for basement viewings

5. **Team features**
   - Roles: owner, agent, assistant, viewer
   - Deal splits and commission calculator
   - Activity feed per agency
   - Goal tracking (monthly captaciones, listings, closings)

6. **Email + WhatsApp marketing**
   - Mailchimp-lite for agencies: send new listings to their saved-buyer database
   - Segmented broadcasts via WhatsApp (respecting Business API policy)
   - AI-drafted campaigns

7. **Public agency microsite**
   - Every agency gets an SEO-optimized microsite: `casablanca.ai/inmobiliaria/domus-madrid`
   - Branded with their colors, agents, listings
   - Upsell from Casablanca branding to white-label (€99/mo add-on)

### Pricing update
- **Starter (solo agent)** €99/mo — full OS, 1 seat
- **Solo Network** €199/mo — for iad/SAFTI-style network agents, includes microsite + Responde + captación widget
- **Agencia** €349/mo — 5 seats
- **Agencia Pro** €149/seat — 6+ seats, white-label microsite
- **Enterprise** custom — 30+ seat agencies, franchises

### Success criteria for Phase 2 (must hit by 2027-01-17)
- [ ] **G3 by 2026-10-17:** 500 paying agencies, €50k MRR
- [ ] **G4 by 2027-01-17:** 800 paying agencies, €100k MRR
- [ ] 80%+ of active users log in weekly
- [ ] <3% monthly logo churn
- [ ] Median seats-per-account: 3+
- [ ] Valuation widget deployed on 200+ agency websites
- [ ] Seed round closed

---

## Phase 3 — Transaction Rails + Document Concierge (Months 9–18 · Jan 17, 2027 → Oct 17, 2027)

**Conviction: 8/10 HIGH on strategy · 6/10 MEDIUM on 12-month execution.** The €1B math lives here — SaaS alone doesn't reach unicorn revenue at our ACV. Each rail (mortgage, e-sign, escrow, energy cert, notaría) is an integration win that compounds into an uncopyable graph. Execution risk: each partnership carries partner-dependency, regulatory onboarding (eIDAS, BdE for escrow), and timeline uncertainty. See `COMPETITIVE-LANDSCAPE.md` §1.5.

**Goal:** monetize the €140B transaction flow, not just the SaaS seat. This is where the €1B math lives. Plus document concierge eats the 2–4 hours per transaction agents waste chasing paperwork (per `RESEARCH-FINDINGS.md` §7).

**Revenue gates:**
- **G5 by 2027-04-17:** €225,000 MRR / 1,800 paying agencies (~€2.7M ARR). Year-one milestone.
- **G6 by 2027-10-17:** €700,000 MRR / 4,000 paying agencies (~€8.4M ARR). This gate opens Series A.

### Features

1. **Mortgage concierge**
   - Partner with mortgage brokers (Idealista Hipotecas, iAhorro, TrioTeca, or directly with BBVA/Sabadell)
   - Buyer opts in via WhatsApp bot during lead flow
   - Casablanca earns 0.2–0.5% of loan origination
   - Agent gets commission visibility

2. **Digital signing**
   - Hoja de visita (viewing disclosure) e-signed
   - Nota de encargo (listing agreement) e-signed
   - Contrato de arras (pre-purchase contract) e-signed
   - Partner: Signaturit, Docusign, or build native on top of eIDAS
   - Monetization: per-envelope fee or bundled in higher tier

3. **Document Concierge (bundled as "Casablanca Cierre")**
   - One-click nota simple pull from Registro (via Colegio de Registradores API) — €5–15 take-rate
   - Auto-pull catastral data
   - Energy certificate request concierge (partner with CertiCalia or equivalent — *not* Idealista Energy) — €20–80 take-rate
   - ITE / cédula de habitabilidad tracking and chase-up (cédula alone takes 20–30 days)
   - Plusvalía municipal calculator
   - ITP filing helper
   - IBI / comunidad certificate chaser
   - Zona tensionada calculator (auto-check rent caps for Catalunya and tensionada Madrid barrios)

4. **Closing coordination**
   - Notaría booking via partnerships (Ancert or direct notary network)
   - Tasación (appraisal) booking
   - Buyer's insurance quote comparison (Línea Directa, Mutua, Mapfre partners)
   - Home insurance take-rate

5. **Cobros / escrow**
   - Deposit (señal, arras) held in Casablanca-branded escrow via a regulated partner
   - Release on closing
   - Take-rate: 0.3–0.5% of deposit

6. **Post-closing services**
   - Change of utilities (Iberdrola, Naturgy, Movistar, Vodafone) — referral fees
   - Moving services — referral fees
   - Home renovation leads — referral fees to contractors

7. **Agent commission automation**
   - Agent agency commission schedule defined in app
   - Auto-calculation and payment triggers
   - 1099-equivalent (modelo 130) prep

### Pricing update
- Keep SaaS tiers unchanged.
- Add take-rate revenue: 5–30bps on transaction value depending on service.
- Target: transaction rails contribute 30%+ of revenue by year 3.

### Success criteria for Phase 3 (must hit by 2027-10-17)
- [ ] **G5 by 2027-04-17:** 1,800 agencies, €225k MRR, €2.7M ARR
- [ ] **G6 by 2027-10-17:** 4,000 agencies, €700k MRR, €8.4M ARR
- [ ] 10%+ of deals closed through Casablanca use at least one rail service
- [ ] Transaction revenue > €50k/month
- [ ] 3 rail partners signed (mortgage, notary/e-sign, insurance minimum)
- [ ] Net revenue retention >130%
- [ ] Series A closed

---

## Phase 4 — Consumer Layer & European Expansion (Year 2 · Oct 17, 2027 → Apr 17, 2028)

**Conviction: 6/10 MEDIUM.** SaaS expansion playbook (hire country lead, localize, embed with 3 design-partners, replicate Madrid motion) is proven. Risks: country-lead hiring velocity, per-country portal/legal/document localization overhead, premature-expansion-before-Spain-PMF-fully-locked risk. Consumer layer is gated on 25%+ listing share in a city — it's optional, not core. See `COMPETITIVE-LANDSCAPE.md` §4.

**Goal:** decide whether to launch a consumer portal. Meanwhile, replicate the model in country #2 and #3.

**Revenue gate G7 by 2028-04-17:** €2,240,000 MRR / 8,000 paying agencies (~€27M ARR). Portugal + Italy contributing meaningfully. Missing this means delay France and re-tune unit economics.

### Consumer layer (only if we have 25%+ Madrid listing share)

- **SearchCasa** (working name): consumer property search with features Idealista won't ship
  - AI-generated neighborhood guides
  - Commute-time search (metro + bike + car)
  - Mortgage pre-qual built in
  - Book-a-viewing one-tap
- Launched only in cities where we have 25%+ of professional listings
- Staffed as a separate team under Casablanca

### European expansion

**Target order (based on market size × fragmentation × language adjacency):**

1. **Portugal (Lisbon, Porto)** — Month 12. ~15k agents, Idealista already operates there, legal system adjacent, founders can speak Portuguese or hire 1 PM.
2. **Italy (Milan, Rome)** — Month 15. ~40k agents, immobiliare.it dominant, Immobiliare.it/Idealista duopoly, strong proptech appetite.
3. **France (Paris, Lyon)** — Month 18–24. ~130k agents, SeLoger/LeBonCoin portals, higher ARPU, more regulation. Hardest, biggest.
4. **Germany** — Year 3. ImmoScout24 dominant, slower to adopt, enterprise-heavy. Hold until we have enterprise muscle.

**Expansion playbook per country:**
- Hire 1 local country manager + 1 sales lead, month 0
- Localize the product (copy, portals, regulatory documents) in 6–8 weeks
- Sign 3 design-partner agencies in the capital city within 30 days
- Replicate the Madrid GTM motion city by city

### Features that generalize; features that don't
- **Generalizes:** media studio, CRM, WhatsApp, mobile app, pipeline, captación, microsites
- **Country-specific:** portals, legal document templates, escrow partner, mortgage market, notary/solicitor flow, VAT handling

---

## Phase 5 — Platform & Consolidation (Year 3+ · Apr 17, 2028 → Apr 17, 2031)

**Conviction: 4/10 LOW.** Aspirational. Marketplace, data products, rollup acquisitions, and Casablanca Capital each require a company state we don't yet have (Series B+ balance sheet, enterprise muscle, regulatory licensing). Named so the plan has a real endgame, but we deliberately don't plan weekly sprints around it. Conviction rises as Phase 3 rails prove out.

**Goal:** become the default platform for European real estate software.

**Revenue milestones:**
- **By 2029-04-17:** €8.4M MRR, ~€100M ARR. Transaction rails 25%+ of revenue.
- **By 2030-04-17:** €12.5M MRR, ~€150M ARR. France live, Germany groundwork.
- **By 2031-04-17:** €16.7M MRR, ~€200M ARR. **€1B valuation event (Series C, IPO, or strategic exit).**

1. **Casablanca Marketplace** — third-party apps (CRM integrations, tasación providers, decoration stores, mudanzas) plug into Casablanca via a public API. Take 15–20% of partner revenue.
2. **Data products** — anonymized market intelligence to banks, funds, insurers. Spanish market transparency is terrible; we become the Bloomberg for residential.
3. **Acquisition strategy** — roll up weaker CRMs in markets where we arrived late (Germany, Benelux). Migrate their customer base to Casablanca in 6 months.
4. **Casablanca Capital (optional)** — fund mortgages directly via a bank partnership or MREL, capture net interest margin. High-risk, high-reward, requires Series C+ balance sheet.

---

## Technical architecture

### Keep
- **Convex** as the data + realtime layer. Excellent for our reactive UI and background jobs. Scales to our year-3 needs.
- **Next.js** for web studio.
- **Expo** for mobile. Shared TRPC types, one codebase.
- **Clerk** for auth. Organizations feature handles our multi-seat model.
- **Fal.ai** as primary AI media provider.
- **Firecrawl** for ingestion (competitor listing scraping for sales intelligence, *not* for re-listing without consent).
- **Stripe** for billing.
- **PostHog** for product analytics.

### Add by month 3
- **Meta WhatsApp Business API** (via 360dialog or Twilio)
- **Resend** for transactional email
- **Inngest** or Convex scheduled functions for cron/workflow orchestration
- **Replicate** as Fal fallback

### Add by month 6
- Self-hosted fine-tunes of Flux (via Replicate or Modal) for our virtual staging styles — reduces per-render cost 3–5x at scale
- A Spanish-tuned small LLM (Mistral or Qwen fine-tuned on Idealista-style listings) for description generation — reduces per-listing cost 10x vs. GPT-4

### Add by year 2
- Proprietary search index for the consumer layer (Typesense or Elasticsearch)
- Data warehouse (BigQuery or ClickHouse) for market analytics products
- Event bus (Kafka or NATS) once we cross 10M events/day

### Explicitly avoid
- Kubernetes before we need it (Vercel + Convex gets us to €10M ARR)
- Building our own foundation models
- Multi-region deployment before we have customers outside Spain
- Microservices premature decomposition. Monolith + Convex functions until it breaks.

---

## AI/ML strategy

### Year 1 — buy
- All AI via Fal, Replicate, OpenAI/Anthropic APIs
- Prompt engineering is our IP
- We capture every input/output into Convex for eventual fine-tuning

### Year 2 — tune
- Fine-tune virtual staging models on our proprietary dataset (now 500k+ staged rooms)
- Fine-tune listing copy LLM on Spanish-specific Idealista-winning listings
- Train a valuation model on Catastro + observed prices

### Year 3 — own
- In-house computer vision team (3–5 engineers)
- Proprietary room-type classifier, photo-quality scorer, price-predictor
- Our models become the product's edge; competitors can't catch up without the data

---

## What we will not build — ever, or for a long time

- **iBuyer / brokerage ourselves.** See masterplan §7.
- **A better Zillow for Spain.** Not before we have supply leverage.
- **A crypto anything.** No.
- **On-premise / self-hosted versions.** Everyone is cloud.
- **SMS 2FA before WhatsApp.** Spain skips SMS.
- **A public roadmap.** Customers vote with dollars and churn, not GitHub stars.
- **A freemium with no credit card.** Every free trial requires a card. Agents who won't put down a card won't pay later.

---

## What each engineer touches

Starting with 2–3 engineers, responsibilities are thin and broad:

- **Eng #1 (full-stack, AI):** media studio pipeline, Fal integration, prompt tuning, cost optimization
- **Eng #2 (full-stack, product):** listing cockpit, CRM, mobile app, UX
- **Eng #3 (hire in month 3):** WhatsApp, integrations, transaction rails backend

The founders do everything else. No product manager until month 9 (the founders are the PMs).

---

## Release discipline

- **Weekly release** every Friday, deployed to 100% of users. No long-lived feature branches.
- **Feature flags** via Convex for anything riskier than a copy change.
- **Postmortems** for every incident, public to the team, 48h turnaround.
- **Design partner preview** — every feature shipped to the 3 friend agencies 48h before general release, even after we have 1,000 agencies.

---

## What "done" looks like, phase by phase (dated)

- **Phase 0 done by 2026-05-17:** 20 paying agencies, €2k MRR, media studio + Responde both live, 90-second upload-to-render, <60s first-lead-reply.
- **Phase 1 done by 2026-07-17:** 120 agencies, €15k MRR, unified inbox live across Idealista+Fotocasa+Habitaclia+WhatsApp+Instagram+Web.
- **Phase 2 done by 2027-01-17:** 800 agencies, €100k MRR, full CRM + captación suite + mobile app + microsites. Seed closed.
- **Phase 3 done by 2027-10-17:** 4,000 agencies, €700k MRR (~€8.4M ARR), 3 rail partners, 10% deal attach. Series A closed.
- **Phase 4 done by 2028-04-17:** 8,000 agencies, €2.24M MRR (~€27M ARR), Portugal + Italy live.
- **Phase 5 done by 2031-04-17:** 35,000 agencies, €16.7M MRR (~€200M ARR), €1B valuation event.

Ship the next thing. Compound. Repeat. **If a gate slips, stop building and sell.**
