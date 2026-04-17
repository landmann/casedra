# Casablanca — Masterplan

**Thesis in one sentence:** Become the AI-native operating system for European real-estate agencies, starting in Madrid with an AI media studio that an agent pays for in week one, and ending as the transaction rails every property in Europe runs on.

**North-star valuation:** €1B+ within 5 years. The math works because we are not building a portal — we are building the system of record for a €70B/year transaction market that is currently served by 2010-era software.

---

## 1. The thesis

Spanish real estate is a massive, fragmented, under-digitized market whose core software is a joke.

- **Residential transaction volume:** ~€140B/year in Spain (~650k transactions).
- **Agent population:** ~60k registered agents, ~30k active agencies. Mostly 1–5 person shops.
- **Software spend per agency:** €30–200/month on a CRM (Inmovilla, Witei, Idealista Tools, Fotocasa Pro) that looks and feels like 2011.
- **Portal monopoly:** Idealista (~€250M revenue, ~€3B valuation) dominates classifieds but has no interest in fixing the agent's day-to-day.
- **The gap:** there is no Toast, no Shopify, no Rippling for Spanish real estate. That gap is Casablanca.

We are not trying to dethrone Idealista by building a prettier consumer portal. That is a billion-euro cold start. We are going to own the **supply side** — the agent's daily workflow — and monetize the transaction rails that flow through it. Once we hold 20%+ of Spanish listing supply, every distribution decision (Idealista, Fotocasa, our own surface) becomes ours to make.

---

## 2. Why now

Five tailwinds converge in 2026 that make this possible for a small team:

1. **Generative AI for media is finally production-grade.** Virtual staging that cost €200/room manually can now be done for cents via Fal/Flux. Listing photography — Spain's biggest listing-quality problem — is now a software problem.
2. **LLMs speak fluent Spanish real estate.** Listing copy, lead qualification, contract review, client Q&A — all now automatable. The Spanish CRM incumbents have shipped zero AI features that matter.
3. **WhatsApp Business API is mature.** Every Spanish agent's primary channel is WhatsApp. Building a WhatsApp-native CRM is finally feasible.
4. **Regulatory pain is at an all-time high.** The Ley de Vivienda (2023), energy certificates, cédula de habitabilidad, nota simple, certificado ITE — agents now need to coordinate 5+ documents per transaction. Software is the only path through this.
5. **Modern stack economics.** Convex + Next.js + Fal + Clerk means a 3-person team can ship what took 30 people in 2018. Our burn is an order of magnitude lower than our competitors' maintenance cost.

The window for a category-defining entry closes when Idealista or a well-funded European player (PriceHubble, Casavo, Housfy) ships an agent OS. We have ~18 months.

---

## 3. The wedge: AI Speed-to-Lead ("Responde"), with Media Studio as the demo asset

Our entry product — the product we bill for in week one — is **Responde**, an AI speed-to-lead system:

- Auto-replies on WhatsApp in <60 seconds to every inbound lead, 24/7, in Spanish
- Ingests leads from Idealista, Fotocasa, Habitaclia, web forms, and missed calls
- Runs a Spanish qualification script (budget, timeline, neighborhood, property type), hands warm leads back to the agent
- Covers the 19:00–23:00 search surge (62% of Spanish property searches happen after agent hours)

Our **demo asset** — the tool we use to open every sales meeting — is the **AI Media Studio**:

- AI photo enhancement, virtual staging, twilight conversion, floor plans, Spanish listing copy, multi-portal export
- The 90-second before/after slider is the viral marketing artifact
- Bundled free into every Responde tier; standalone at €29/mo (Studio Lite) as funnel top only

**Why this ordering (after doing the competitive research in `COMPETITIVE-LANDSCAPE.md`):**

- **Responde is greenfield in Spain.** No Spanish incumbent ships a WhatsApp-native 24/7 AI speed-to-lead bot. Inmovilla, Witei, Fotocasa Pro all stop at email forwarding. Standalone speed-to-lead products (US-based kvCORE, Follow Up Boss) have no Spain presence and no WhatsApp-native AI.
- **The ROI math is quantifiable in euros.** Agencies lose 40% of leads to slow response = ~€72–120k/year per agency (per `RESEARCH-FINDINGS.md` §2). Responde at €99/mo pays for itself if it recovers one lead per year. Every agent can do this math in the first 60 seconds of the demo.
- **Media Studio is a saturated category.** Pedra.ai (€29/mo, 20k+ agents globally, documented Barcelona case study), Idealista's free Texto Inteligente + bundled VHS, Witei/Inmovilla/Mobilia all ship AI staging, price floor €2/photo at REHAVITAT. Competing on media alone is a race to the bottom. But the *demo* is still the best door-opener in proptech — so we use it, bundled.
- **Fast to ship.** Fal.ai + Convex media jobs ship in week 1 (demo). WhatsApp Business API + Responde ship weeks 2–3 (product). Two-week timeline to first paying customer.
- **Pricing bundles cleanly around the math, not the wow.** Responde Solo €99/mo, Agencia €349/mo, Studio Lite €29/mo (funnel top only). No standalone Studio Pro — we refuse to fight Pedra at €29–79 for staging.

Responde is **not** the company either. It is the Trojan horse that puts Casablanca inside every agency in Madrid within 90 days. Once we're in, we expand into Listing Cockpit + Unified Inbox (Phase 1), then the full Agent OS + Captación Suite (Phase 2), then Transaction Rails (Phase 3).

---

## 4. The expansion: from media studio to transaction OS

We expand in five phases, each unlocked by owning the previous phase's data. **Conviction levels** reflect our confidence in hitting each phase's commercial milestones given what we know today; see `COMPETITIVE-LANDSCAPE.md` §3.

| Phase | Product | Timeline | Why it matters | Conviction |
|---|---|---|---|---|
| 0. Responde + Media Studio | AI speed-to-lead (primary); AI image/copy (bundled demo) | Now → Month 2 | Entry. Revenue in week 1. | **8/10 HIGH** (Responde) / 5 as standalone Studio / 9 as bundled Studio |
| 1. Listing Cockpit + Unified Inbox | Multi-portal publishing, omnichannel lead inbox, WhatsApp | Month 2 → Month 4 | We own the listing lifecycle and the lead stream. | **8/10 HIGH** |
| 2. Agent OS + Captación Suite | Full CRM, pipeline, mobile, AVM widget, FSBO converter, microsites | Month 4 → Month 9 | We become the system of record, and we weaponize seller acquisition. | **7/10 MEDIUM-HIGH** |
| 3. Transaction Rails + Document Concierge | Mortgage, notary, e-signature, escrow, nota simple, energy cert | Month 9 → Month 18 | We monetize the transaction, not just the SaaS seat. Where the €1B math lives. | **8/10 strategy · 6/10 12-mo execution** |
| 4. Consumer Layer + European Expansion | Optional consumer portal, Portugal, Italy, France | Year 2 → Year 5 | European rollup. | **6/10 MEDIUM** |
| 5. Platform + Consolidation | Marketplace, data products, CRM acquisitions, Casablanca Capital | Year 3+ | Endgame. | **4/10 LOW — aspirational** |

Each phase deepens lock-in and multiplies ARPU. A solo agent pays us €49 for media; a mid-size agency pays us €4k/month for the OS; a transaction fee of 0.5% on a €400k piso is €2,000 of margin with zero CAC.

---

## 5. The moat

We have three moats and they compound.

### Moat 1: Data
Every listing we process teaches the system. After 100k listings we have the largest Spanish-market-specific vision dataset in existence: rooms, styles, pricing-by-neighborhood, photo-quality-to-days-on-market. Nobody else — not Idealista, not OpenAI — has this. This dataset is what makes the next version of our AI untouchable.

### Moat 2: Workflow lock-in
Once an agency runs their pipeline, contacts, WhatsApp comms, viewings calendar, and commission tracking through us, switching means exporting 3 years of relationships. They don't. This is the Salesforce moat, not the Slack moat.

### Moat 3: Transaction graph
We build direct integrations with the mortgage brokers, notarías, registros, tasadoras, and insurers that every Spanish transaction touches. Each integration is slow and boring; the resulting graph is uncopyable. This is the moat that justifies the €1B.

**What is not a moat:** the AI models themselves. Anyone can call Flux. Our edge is the data on top, the workflow underneath, and the transaction rails beside.

---

## 6. Competitive positioning

| Competitor | What they do | Why we win |
|---|---|---|
| **Idealista (portal + Inmovilla + Idealista Tools + VHS + Texto Inteligente)** | **Vertically integrated:** the #1 portal AND the #1 CRM (Inmovilla, ~90% of Spanish MLS) AND their own agency suite (Idealista Tools) AND bundled virtual staging AND a free AI description tool. An agent today often pays Idealista three times and gets Idealista's AI for free on top. | They are the *landlord* of Spanish real estate software. We are the *only* independent OS. Pitch: *"paga Idealista una vez por tus anuncios — no dos."* They can't undercut that positioning without cannibalizing their own portal business. |
| **Pedra.ai** | Global AI media studio (staging, photo, copy, reels, floor plans). €29/mo. 20k+ agents. Active Spanish case studies (Barcelona eXp). | They own the standalone-media-studio SKU at our proposed price. We do *not* try to beat them at their own game. We bundle Media Studio into Responde (€99) and compete on speed-to-lead + CRM + transaction rails, categories Pedra does not touch. |
| **Witei / Mediaelx / Inmofactory / Mobilia** | Legacy Spanish CRMs not owned by the portals; several have added AI staging | 2010-era UX, shallow AI, SMB-owned, low R&D. We are 10x better on AI-native workflow and positioned against the incumbent (Inmovilla) rather than each other. |
| **Fotocasa Pro** | #2 portal's agent suite | Tied to their portal; agents hate being locked into any single portal's ecosystem. |
| **iad España / SAFTI / Keller Williams ES** | Network agent models (higher commission retention, no office) | Agents are defecting *to* them from traditional agencies. They're underserved by tooling. Opportunity — we sell to them as "Solo Network" tier, and potentially white-label defensively. |
| **PriceHubble / Casavo / Housfy** | Venture-backed European proptech | Different wedges (valuation, iBuyer, buyer-side). We are agent-OS; we are partners or irrelevant, not competitors. |
| **US speed-to-lead stacks (Follow Up Boss, kvCORE, Zillow PA)** | Mature US speed-to-lead tooling, no Spain presence, not WhatsApp-native | The Spanish market is greenfield for speed-to-lead — this is our sharpest wedge. |
| **Compass (hypothetical entry)** | US agent platform | Unlikely to enter Spain — their model is brokerage, not SaaS; regulated market per country. |

**Critical positioning insight (from research):** The biggest strategic finding is that **Idealista owns Inmovilla.** The dominant Spanish real estate CRM is a product of the dominant Spanish real estate portal. Most Spanish agents don't realize this. Every feature Inmovilla ships is a strategic weapon for Idealista's portal — and every euro a Spanish agency pays Inmovilla goes to the company selling ads to their buyers. This gives us a clean, durable, agent-sympathetic positioning: **Casablanca is the only major Spanish real estate OS not owned by a portal.** Full research in `RESEARCH-FINDINGS.md`.

**Our asymmetric advantage:** we are three people in Madrid with three friends who are agents. We ship weekly; they ship quarterly. We use the product in the field tomorrow; they have never met a working agent. Most importantly, we aren't accountable to a portal's P&L.

---

## 7. Strategic principles (what we won't do)

These are load-bearing. Violating them kills the company.

1. **We will not become a brokerage.** We sell picks and shovels. Becoming the agent is a different, lower-margin, regulated, capital-intensive business (Compass, Housfy, Purplebricks). Stay SaaS + rails.
2. **We will not launch a consumer portal before we have listing leverage.** A premature portal forces Idealista to fight us; a late portal (with 25%+ of supply locked in) is a coronation.
3. **We will not build for enterprise first.** Engel & Völkers is a 12-month sales cycle. Independent Madrid agents are a 12-minute sales cycle. PMF lives in the SMB.
4. **We will not fragment our focus internationally before Spain works.** Spain is €70B of TAM. Winning Spain first is non-negotiable. Portugal is a year-2 decision.
5. **We will not over-hire.** Every AI-native company that hit $100M ARR in 2025 did it with <30 people. We aim for the same.
6. **We will not build our own LLMs or image models.** We are a data, workflow, and distribution company that *uses* AI. Training foundation models is a distraction.
7. **We will not take agent commissions.** Our pricing is transparent SaaS + transaction fees from *partners* (mortgage origination, notary, insurance). Agents are the customer, not the product.

---

## 8. Milestones to €1B (dated)

Project start: 2026-04-17. Every milestone below has a hard date; see `GTM-ROADMAP.md` for the gate-slip response ("if we miss, every founder back into field sales").

| Date (≤) | Milestone | ARR / MRR | Proof point | Conviction |
|---|---|---|---|---|
| 2026-05-01 | Gate G0 | €300 MRR | Friend's agency pays — Responde pricing holds | 9/10 |
| 2026-05-17 | Gate G1 — Phase 0 done | €2k MRR | Responde live; 70%+ paid on Responde tier (not €29 Studio) | 8/10 |
| 2026-07-17 | Gate G2 — Phase 1 done | €15k MRR | Unified inbox live; 10+ Inmovilla migrations | 7/10 |
| 2026-10-17 | Gate G3 | €50k MRR | 3 cities live, first press | 7/10 |
| 2027-01-17 | Gate G4 — seed closes | €100k MRR (~€1.2M ARR) | Multi-city Spain, seed round closed | 6/10 |
| 2027-04-17 | Gate G5 — Phase 2 done | €225k MRR (~€2.7M ARR) | 1,800 agencies, Captación Suite driving inbound | 6/10 |
| 2027-10-17 | Gate G6 — Series A opens | €700k MRR (~€8.4M ARR) | Transaction rails live, Portugal pilot | 6/10 |
| 2028-04-17 | Gate G7 — Phase 4 done | €2.24M MRR (~€27M ARR) | Italy + Portugal contributing, Series A closed | 5/10 |
| 2029-04-17 | Series B territory | €8.4M MRR (~€100M ARR) | 4+ countries, rails 25%+ of revenue | 5/10 |
| 2030-04-17 | France live | €12.5M MRR (~€150M ARR) | Acquisitions closing | 4/10 |
| **2031-04-17** | **€1B valuation event** | €16.7M MRR (~€200M ARR) | **Series C, IPO, or strategic exit** | 4/10 |

Conviction decreases the further out we look — this is honest, not pessimistic. Phase 0 and 1 are near-term, well-understood, and well-defended by research. Series C conviction at 4/10 isn't "we won't get there" — it's "the path beyond year 3 has too many exogenous variables to be confident today." We raise these scores as we prove each prior gate.

These are aggressive but not absurd. Toast did ~€1B valuation in 5 years post-launch. Rippling: 4. Deel: 3. The AI-era compressed that further. We're targeting 5 years to the €1B event from today.

---

## 9. The endgame

Three possible endings, in decreasing order of ambition.

1. **European real estate OS (IPO).** Casablanca is to European real estate what Toast is to restaurants. €500M+ ARR, public company, owns the transaction rails in 6+ countries.
2. **Strategic acquisition by Idealista/EQT or a global proptech.** Most likely at Series B/C when we have enough listing supply to threaten the portal. Outcome: €1–3B exit.
3. **Private-equity roll-up play.** We acquire Inmovilla, Witei, and similar legacy CRMs for their customer bases and consolidate. Higher revenue, lower multiple, but a clear €1B path.

We optimize for option 1 and keep 2 and 3 as insurance.

---

## 10. Team principles

- **Three founders in Madrid.** Plus three friend-agents as permanent design partners and future referral engines.
- **Ship daily.** Every week a Madrid agent should see something new. Our speed is our moat against incumbents.
- **Live in the field.** Every founder does at least one agency visit per week in year one. No exceptions. Product decisions die in conference rooms.
- **Spanish-first, English-native.** Product, support, and marketing are Spanish. Engineering and docs are English. This scales internationally without rework.
- **AI-native, human-backed.** Every workflow has an AI first draft and a human confirmation. We don't ship autonomous mistakes.

---

## 11. Risks and how we kill them

| Risk | Mitigation |
|---|---|
| Idealista launches a competing media studio | Our lead is 18 months; our data moat compounds; we're syndication-friendly so we ride their rails. |
| Fal.ai raises prices / goes down | Multi-provider abstraction from day one (Fal primary, Replicate/Runware fallback). Own fine-tunes by month 6. |
| Agents won't pay | Solved in week 1 with the three friends. If they won't pay, we pivot before we hire. |
| WhatsApp Business API policy change | WhatsApp is a channel, not the product. Email + SMS + in-app inbox as backup. |
| Spanish regulatory shift | We *benefit* from regulation; more compliance = more software need. |
| Can't hire in Madrid | Remote-friendly for engineering, Madrid-core for sales/ops. |
| Runway before PMF | €150k of pre-seed covers 6 months. PMF signal by month 3 or we cut scope. |

---

## 12. What success looks like in one year

- €1M+ ARR, growing 15%+ MoM
- 2,500+ paying agents across Spain, concentration in Madrid/Barcelona/Valencia
- Media studio + listing cockpit shipped; agent OS in alpha
- Seed round closed, Series A conversations starting
- Team of 8–12, all hires retained
- Inbound referrals >50% of new revenue
- Known brand in Spanish proptech circles (SIMA, Proptech Spain, Idealista roundtables)
- First transaction-rail integration live (mortgage partner)

If we hit those, the €1B is not a question of if but of when.

---

## 13. First principles we'll come back to

- **Agents are the customer, the transaction is the product.**
- **Software that saves an agent an hour a day is software they'll never leave.**
- **Own the workflow, distribute through the portals, monetize the transaction.**
- **Data compounds; code does not. Ship the data flywheel first.**
- **In a fragmented market, distribution beats product, and focus beats distribution.**

This is the plan. Everything else — roadmap, GTM, financials — serves it.
