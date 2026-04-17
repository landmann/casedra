# Casablanca — Financial Model & Path to €1B

Companion to `MASTERPLAN.md`, `PRODUCT-ROADMAP.md`, and `GTM-ROADMAP.md`. This document does the math: can we realistically get to a €1B valuation in 5 years, and what does the path look like quarter by quarter?

**Short answer:** yes, if we hit ~€50M ARR by year 4 with transaction-rail revenue mixed in — that's a €1B business at a 20x multiple (SaaS with a take-rate kicker trades higher than pure SaaS). The assumptions are aggressive but have been hit by analogous companies (Toast, Mindbody, ServiceTitan, Deel, Rippling) in similar timelines.

---

## 1. Market sizing

### TAM (Europe)
- **EU residential transaction volume:** ~€1.2 trillion/year (2024, combined EU+UK)
- **Estimated EU real-estate agents:** ~1.2M professionals, ~400k agencies
- **Commission pool:** ~€36B/year (3% blended take-rate on transaction volume)
- **Agent software spend (TAM):** ~€3.6B/year (10% of commissions as a reasonable upper bound on software+services ceiling)

### SAM (Spain, Portugal, Italy — our first 3 markets)
- **Residential transaction volume:** ~€250B/year combined
- **Agents:** ~130k
- **Agencies:** ~70k
- **Current software spend (SAM):** ~€400–600M/year (across CRM, portal subscriptions, staging/photo services, e-sign, e-valuation)
- **Transaction-service take-rate potential:** €2.5B/year (1% of transaction volume)

### SOM by year 5 (realistic target)
- 30,000 paying agencies (~25% share in Spain, 15% Portugal, 10% Italy, early footholds elsewhere)
- Average ARPU blended: ~€350/mo (including transaction rails)
- SaaS ARR: ~€125M
- Transaction rail revenue: ~€75M
- **Total year-5 ARR target: €200M**
  - This implies €1B+ valuation at 5x revenue (software+marketplace multiple); potential upside to €2B+ at growth-premium multiples.

---

## 2. Revenue streams (by phase)

### Streams
| Stream | Launch | Year-1 mix | Year-3 mix | Year-5 mix |
|---|---|---|---|---|
| Media Studio (Lite/Pro) | Month 0 | 70% | 25% | 15% |
| Agent OS SaaS (Agencia, Agencia Pro) | Month 3 | 25% | 40% | 35% |
| Enterprise (franchise deals) | Month 8 | 5% | 10% | 10% |
| Transaction rails (mortgage, escrow, notary, insurance) | Month 12 | 0% | 20% | 30% |
| Data / API / marketplace | Year 3 | 0% | 5% | 10% |

### Why the mix shifts
- Early revenue is **broad, shallow, SaaS** (lots of small agents paying €79).
- Mid-term revenue is **deeper SaaS + enterprise** (bigger agencies, more seats).
- Late-term revenue is **transaction-rail + data** (higher margin, higher ceiling, harder to replicate).

This mix shift is the single most important driver of valuation multiple expansion. Pure SaaS trades at 6–12x ARR; vertical SaaS with embedded fintech trades at 12–30x. Toast trades as a fintech now, not a POS software company.

---

## 3. Unit economics

### Year 1 (SaaS only)
| Metric | Target |
|---|---|
| Blended ARPU | €120/mo |
| CAC (blended) | €150 |
| Payback | 1.3 months |
| Gross margin | 78% |
| Logo churn | 3.5%/mo |
| Net dollar retention | 105% |
| LTV | ~€2,700 |
| LTV/CAC | ~18x |

### Year 3 (SaaS + transaction rails)
| Metric | Target |
|---|---|
| Blended ARPU (SaaS) | €280/mo |
| Blended ARPU (incl. rails) | €400/mo |
| CAC | €600 (mostly enterprise + outbound) |
| Payback | 2.2 months |
| Gross margin | 72% |
| Logo churn | 1.5%/mo |
| NDR | 130% |
| LTV | ~€18,000 |
| LTV/CAC | ~30x |

### Year 5
| Metric | Target |
|---|---|
| Blended ARPU | €540/mo |
| NDR | 135% |
| Gross margin | 70% |
| Rule of 40 | >80 |

### Cost structure sanity checks
- **Fal.ai inference cost:** ~€0.03–0.08 per render at scale. Pro customer at €99/mo with 50 renders = €2–4 COGS. Healthy 95%+ margin on media studio.
- **WhatsApp Business API:** ~€0.04–0.09 per conversation. 500 msgs/agent/mo = €20–45 COGS for €100+ ARPU. Tight but fine.
- **Stripe fees:** 1.4% + €0.25 EU / 2.9% + €0.25 non-EU. Blended ~2% of revenue.
- **Convex:** ~€0.50–2 per active user per month at our workload. Negligible.
- **Support cost:** ~€15/user/month at scale with AI-assisted tooling. Largely a people cost; automate aggressively.

---

## 4. Revenue forecast (5-year view)

All figures in €. Conservative-realistic case — not the bull case.

Project start: 2026-04-17. Quarters below are calendar quarters from that date.

### Year 1 — Apr 17, 2026 → Apr 17, 2027

| Quarter end | Date (≤) | Gate | Agencies | ARPU | MRR | ARR |
|---|---|---|---|---|---|---|
| Q1 | 2026-07-17 | G2 | 120 | 125 | €15,000 | €180k |
| Q2 | 2026-10-17 | G3 | 500 | 100 | €50,000 | €600k |
| Q3 | 2027-01-17 | G4 (seed) | 800 | 125 | €100,000 | €1.2M |
| Q4 | 2027-04-17 | G5 | 1,800 | 125 | €225,000 | €2.7M |

**Year 1 ARR exit (by 2027-04-17): ~€2.7M.**

Implies 1,800 agencies in 12 months out of ~30,000 Spanish agencies (6% share). Achievable with field sales + referral + content, concentrated geographically in Madrid/Barcelona/Valencia.

### Year 2 — Apr 17, 2027 → Apr 17, 2028

| Quarter end | Date (≤) | Gate | Agencies | ARPU | MRR | ARR |
|---|---|---|---|---|---|---|
| Q5 | 2027-07-17 | — | 3,000 | 160 | €480,000 | €5.8M |
| Q6 | 2027-10-17 | G6 (Series A) | 4,500 | 200 | €900,000 | €10.8M |
| Q7 | 2028-01-17 | — | 6,000 | 240 | €1.44M | €17.3M |
| Q8 | 2028-04-17 | G7 | 8,000 | 280 | €2.24M | €26.9M |

**Year 2 ARR exit (by 2028-04-17): ~€27M.** Includes Portugal (~15% of ARR) and Italy (~8%) contributions, transaction rails starting to contribute (~10% of MRR).

### Year 3 — Apr 17, 2028 → Apr 17, 2029

| Quarter end | Date (≤) | Agencies | ARPU | MRR | ARR |
|---|---|---|---|---|---|
| Q9 | 2028-07-17 | 11,000 | 320 | €3.5M | €42M |
| Q10 | 2028-10-17 | 14,000 | 360 | €5.0M | €60M |
| Q11 | 2029-01-17 | 17,000 | 390 | €6.6M | €79M |
| Q12 | 2029-04-17 | 20,000 | 420 | €8.4M | €100M |

**Year 3 ARR exit (by 2029-04-17): ~€100M.** Transaction rails ~25% of MRR. Series B territory.

### Year 4 — Apr 17, 2029 → Apr 17, 2030
- Agencies: 20,000 → 28,000
- Exit ARR (by 2030-04-17): ~€150M
- France launch in Q13 (2029-07-17); Germany groundwork in Q16 (2030-04-17)
- Transaction rails ~28% of MRR

### Year 5 — Apr 17, 2030 → Apr 17, 2031
- Agencies: 28,000 → 35,000
- Exit ARR (by 2031-04-17): ~€200M
- Data/API contribution meaningful (~10% of MRR)
- **Valuation event by 2031-04-17: €1B+ at Series C, IPO, or strategic acquisition.**

### Bull case, bear case

| Case | Year-5 ARR | Year-5 valuation |
|---|---|---|
| Bear (Spain-only, no rails) | €35M | €200–350M |
| Base (3 markets, rails at 25%) | €200M | €1.0–1.5B |
| Bull (5 markets, rails at 35%, rollup) | €400M | €3–5B |

---

## 5. Funding milestones

### Pre-seed (now — month 3)
- **Raise:** €250k–€500k
- **Sources:** founders, friends/family, 3–5 angels (ex-Spanish founders, real estate insiders)
- **Valuation:** €3–5M post
- **Use:** 6–9 months of runway, 3 founders + 1 early BDR + infra
- **Trigger:** signed already or about to be

### Seed (month 6–9)
- **Raise:** €3–5M
- **Valuation:** €15–20M post
- **Use:** 18 months runway; team to 15; Spain national + Portugal pilot
- **Trigger:** €50–100k MRR, <4% logo churn, design-partner testimonials, clear PMF signal
- **Target funds (Spain):** Samaipata, Seaya, K Fund, Kibo, JME, Bonsai
- **Target funds (EU):** Point Nine, LocalGlobe, Stride, Speedinvest
- **Target angels:** ex-Idealista execs, Wallapop/Jobandtalent/Housfy founders

### Series A (month 15–20)
- **Raise:** €15–25M
- **Valuation:** €80–130M post
- **Use:** Italy + France entry, transaction rails buildout, team to 50
- **Trigger:** €3M+ ARR, 130%+ NDR, transaction rails live with 3+ partners, early non-Spain revenue
- **Target funds:** Atomico, Accel, Index, Sequoia Europe, Northzone, Felix, EQT Ventures

### Series B (year 3)
- **Raise:** €40–70M
- **Valuation:** €300–500M post
- **Use:** Germany entry, enterprise muscle, acquisitions of legacy CRMs
- **Trigger:** €15M+ ARR, rails >20% of revenue, proven playbook across 3 countries
- **Target funds:** Iconiq, General Atlantic, Tiger, Coatue Europe, Eurazeo

### Series C / pre-IPO (year 4–5)
- **Raise:** €80–150M
- **Valuation:** €1B+ post
- **Use:** European consolidation, potential consumer-portal launch, Casablanca Capital
- **Trigger:** €50M+ ARR, clear IPO-scale growth profile
- **Target funds:** Softbank, Tiger, growth-stage crossovers, sovereign wealth (Mubadala, GIC)

### Dilution schedule (founder-friendly targets)
| Round | Dilution | Founder ownership after |
|---|---|---|
| Pre-seed | ~10% | 85% |
| Seed | ~18% | 65% |
| Series A | ~18% | 50% |
| Series B | ~15% | 38% |
| Series C | ~12% | 28% |
| Post-IPO / exit | — | 22–25% |

At €1B post-money, 25% founder stake = €250M pre-dilution, ~€180M net of employee option pool growth. Distributed across 3 founders: ~€60M each. Life-changing, not the top.

At €3B strategic exit (bull case): ~€180M each. Enterprise-level wealth.

---

## 6. Headcount plan

| Month | Eng | Sales | CS | Marketing | Ops | Founders | Total |
|---|---|---|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 0 | 0 | 3 | 4 |
| 3 | 2 | 1 | 0 | 0 | 0 | 3 | 6 |
| 6 | 3 | 3 | 1 | 1 | 0 | 3 | 11 |
| 12 | 6 | 6 | 2 | 2 | 1 | 3 | 20 |
| 24 | 15 | 15 | 6 | 5 | 3 | 3 | 47 |
| 36 | 30 | 30 | 15 | 10 | 8 | 3 | 96 |
| 48 | 50 | 50 | 25 | 18 | 15 | 3 | 161 |
| 60 | 80 | 70 | 40 | 25 | 25 | 3 | 243 |

Benchmarks: Toast reached $1B valuation at ~300 employees. Deel at ~100. Rippling at ~200. We target ~250 at the €1B milestone — lean by SaaS-unicorn standards but appropriate for an AI-native era.

---

## 7. Burn and runway

### Year 1
- Monthly burn: ~€120k by month 12 (team of 20, infra ~€5k/mo, misc)
- Annual burn: ~€1.1M
- Revenue offset: exits Y1 at ~€225k MRR → ~€2.7M run-rate
- **Net burn year 1:** ~€500k (revenue covers 60% of burn by Q4)
- Seed of €4M gives ~24–30 months runway

### Year 2
- Monthly burn: ~€550k by month 24 (team of 47)
- Annual burn: ~€5M
- Revenue: exits at €2.24M MRR → €27M run-rate
- **Net burn year 2:** -€20M+ (i.e., cashflow-positive in aggregate if pricing holds)

Realistically we will reinvest at negative margins to hit growth thresholds investors want — but we design for a path to profitability rather than burning on faith.

### Profitability point
- Target: cashflow-positive by month 30, ~€25–30M ARR.
- This makes us optionally independent from capital markets from Series B onward.

---

## 8. Path to €1B (the concrete math)

Three realistic paths, in ascending likelihood of outsized return.

### Path A: Strategic acquisition by Idealista / EQT at Series B
- **When:** year 3, €15–20M ARR
- **Multiple:** 30–50x ARR (strategic premium; Idealista needs us to defend against Immobiliare.it + foreign proptech)
- **Outcome:** €500M–€1B exit
- **Probability:** ~35%

### Path B: IPO trajectory at €50–100M ARR
- **When:** year 5, €100M+ ARR
- **Multiple:** 10–20x ARR (public SaaS+fintech multiples)
- **Outcome:** €1–2B valuation at IPO
- **Probability:** ~40%

### Path C: Roll-up / growth equity buyout at €30–70M ARR
- **When:** year 4
- **Multiple:** 15–25x ARR (PE take-private, with plan to consolidate European real estate software)
- **Outcome:** €750M–€1.5B
- **Probability:** ~20%

### Failure modes (the other 5%)
- **PMF never locks in:** we miss the Q2 milestone of 300 paying agencies. Pivot trigger.
- **Idealista launches a good competing product by month 9:** possible but unlikely (their org is slow). Defense: CRM lock-in by then.
- **Capital markets frozen:** Series A unavailable at our target terms. Fallback: extend runway on revenue alone — we should have a clear path to profitability by month 18 as insurance.
- **Spanish economic downturn:** real estate transactions drop 30%+. Casablanca suffers but less than agencies themselves (we're a productivity tool; more valuable when transactions are scarce).

---

## 9. Comparable companies (valuation benchmarks)

| Company | Vertical | Peak valuation | ARR at peak | Multiple | Time to peak |
|---|---|---|---|---|---|
| Toast (POS for restaurants) | Vertical SaaS + fintech | $35B (2021) | $650M | 55x | 9 years |
| ServiceTitan (HVAC/plumbing) | Vertical SaaS | $18B (2021) private | $500M+ | 35x | 12 years |
| Mindbody (fitness) | Vertical SaaS | $1.9B (2019) | $220M | 9x | 19 years |
| Compass (real estate brokerage) | Hybrid | $8B IPO (2021) | $6B revenue | 1.3x | 9 years |
| PriceHubble (EU prop-AI) | Vertical SaaS | $250M (2023) | ~$30M | 8x | 8 years |
| Housfy (iBuyer ES) | Real estate transactions | $200M (2021) | $80M | 2.5x | 6 years |
| Casavo (iBuyer IT) | Real estate transactions | €700M (2022) | €200M | 3.5x | 5 years |

**Takeaways:**
- Vertical SaaS with embedded fintech (Toast) trades far higher than pure SaaS (Mindbody). Our transaction rails strategy is the single biggest valuation lever.
- iBuyer/brokerage models (Compass, Housfy, Casavo) trade at ~1–3x revenue because they're capital-intensive. Staying SaaS + rails is right.
- Similar European proptech precedents exist at $250M–€700M; €1B+ is the next tier that requires cross-country scale.

Our target multiple at €1B: 15–20x forward ARR. That implies €50–70M forward ARR at the €1B event — consistent with the model above.

---

## 10. Investor narrative (the pitch in 5 bullets)

1. **The market:** €140B/year Spanish residential transaction volume. No Toast-equivalent exists. Incumbent software is 2010-era Inmovilla/Witei.
2. **The wedge:** AI media studio → paying customers in week one. Fal.ai + Convex + Clerk = two-week time-to-revenue.
3. **The expansion:** agent OS → transaction rails → consumer portal (optional). Each phase multiplies ARPU 3–10x.
4. **The moat:** proprietary data flywheel from every listing + workflow lock-in + transaction graph with banks/notaries/insurers.
5. **The team:** three founders in Madrid with three friend-agents as permanent design partners. Shipping weekly. Revenue before capital.

**Ask:** €3–5M seed after we hit €50k MRR (month 6–9). That's what the number we're going to work toward — not a minute earlier.

---

## 11. The single most important number

**1,800 paying agencies by 2027-04-17.**

If we hit that, everything else in this document becomes a matter of execution. If we miss it by 50%+, we should pivot or wind down rather than burn a Series A on a broken growth curve.

The intermediate gates to watch en route (these are our early-warning system):

- **€300 MRR by 2026-05-01** — wedge pricing works
- **€2,000 MRR by 2026-05-17** — first 20 agencies, Phase 0 locked
- **€15,000 MRR by 2026-07-17** — Madrid critical mass, Phase 1 done
- **€50,000 MRR by 2026-10-17** — multi-city validated
- **€100,000 MRR by 2027-01-17** — seed closes

Miss any intermediate gate by 2+ weeks → all founders back into field sales until caught up.

Everything else is commentary.
