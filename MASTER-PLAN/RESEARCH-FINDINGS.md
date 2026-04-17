# Casablanca — Research Findings & Product Implications

Synthesis of Spanish real estate agent pain points collected from public sources (industry blogs, forums, agency platforms, regulators, Trustpilot reviews). Each finding links to what we should do differently in product and GTM.

**Date of research:** April 2026. Sources listed at the bottom.

---

## 1. The single most important finding: **Idealista owns Inmovilla**

Inmovilla — the CRM used by **~90% of Spanish MLS/agrupaciones** and by far the largest agency software provider in Spain — is owned by Idealista.

Most agents don't realize this. They pay Idealista:
1. Once for portal listings (€79–400+/month per agency depending on promos, premium slots, highlighted listings)
2. Again for Inmovilla CRM (€40–80/month)
3. Again for Idealista Tools (€79+/month for premium)

**Implications for Casablanca:**

- **Competitive map changes.** Our real competitor isn't "Idealista the portal" — it's Idealista the vertically-integrated landlord. Every feature they ship in Inmovilla or Idealista Tools directly threatens us.
- **Positioning becomes a wedge, not a footnote.** The narrative "your CRM is owned by the portal that sells to your buyer" lets us position Casablanca as *the only truly independent* agent OS in Spain.
- **Sales pitch line:** *"Paga Idealista una vez por tus anuncios — no dos. Nosotros somos el CRM que no pertenece a tu mayor proveedor."*
- **Migration tooling is Priority 1A.** One-click import from Inmovilla becomes our most valuable conversion feature. If we make leaving Inmovilla painless, we take share.
- **Rail partnerships must avoid Idealista-owned adjacencies.** Idealista Hipotecas, idealista/data, Idealista Energy Certificate (when they launch it) — we should partner with alternatives (iAhorro, TrioTeca, CertiCalia) to stay visibly non-aligned.

---

## 2. Quantified pain: the Spanish agent lead funnel is leaking €72–120k per agency per year

Per published benchmarks from Spanish real estate automation vendors (Remmit, Sooprema, AI Fast Track) and corroborating US/international data:

- **40% of leads are lost** by the average Spanish agency — no response, late response, dropped follow-up.
- **Responding to a lead within 5 minutes multiplies contact probability by 100x** vs. responding at 30 min.
- **60% of leads who don't get a reply in <10 minutes contact another agency.**
- A typical agent manages **50+ simultaneous active leads.**
- **62% of Spanish real estate searches happen between 19:00 and 23:00** — after agent working hours, when nobody is at the desk.

A mid-size agency losing ~40 of 100 monthly leads is leaving ~**1 closed sale/month** on the table = **€6,000–10,000/month in lost commissions** = **€72–120k/year**.

**Implications for Casablanca:**

- **Add "AI Speed-to-Lead" as a Phase 0 product alongside the media studio.** An AI WhatsApp/SMS responder that handles the first 5-minute reply automatically, 24/7. This directly addresses the 19:00–23:00 evening search surge. Every agent understands the math.
- This is arguably a **more acute pain** than the media studio — a deeper budget ask unlocks faster. Ship it in week 3–4 after the media studio goes live.
- **Pricing lever:** we can anchor the Speed-to-Lead product to "costs less than one month of lost commissions." At €149/mo we pay back in <10 days for a typical agency.

---

## 3. Channel fragmentation is universal — nobody has a central inbox

Agents receive leads through:
- Idealista, Fotocasa, Habitaclia, Pisos.com, Milanuncios (portal messaging)
- Web form on agency site
- WhatsApp (personal number, agent's own phone)
- WhatsApp Business (if the agency has one)
- Instagram DMs and comments
- Phone calls
- Referrals / walk-ins

There is no unified inbox. Leads "fall through the cracks", duplicate replies happen when two agents both see a lead, context is lost between channels.

Inmovilla has a "centralized leads" feature but it's read-only fragments with manual tagging. Witei is similar. Idealista Tools only surfaces Idealista leads.

**Implications for Casablanca:**

- **Unified Lead Inbox** becomes Phase 1's flagship feature — one stream of all leads from all channels, auto-deduped, assigned by round-robin or AI-routing rules.
- **Phase 1 positioning line:** *"All your leads, from all your portals, in one place, answered in under 5 minutes."*
- **WhatsApp is the #1 integration.** Spain runs on it. We should support both cloud API (365dialog/Twilio) and the agent's personal number (via Chrome extension or WhatsApp Web bridge — trickier, but a differentiator).

---

## 4. Reputation and trust crisis — buyers actively distrust Spanish agents

From Forocoches threads ("MENTIRAS de agentes inmobiliarios", "me dan asco los agentes inmobiliarios", "Desesperación vivienda — trucos de agente inmobiliario") and Trustpilot reviews, Spanish consumers repeatedly report:

- Agents inflating listing prices (portales inflate up to **44% vs. registered transaction prices**, per eldiario.es)
- Fake or stale listings that no longer exist (bait-and-switch to other flats)
- Duplicate listings from different agents for the same property
- Agents demanding visits before showing any property info
- No license required in Spain generally — anyone can call themselves an "agente"
- UGT formally denounced Idealista + Fotocasa for listing non-compliant housing (Dec 2025)

**Implications for Casablanca:**

- **Verification layer opportunity:** every Casablanca-listed property carries a "verified by Casablanca" badge — listing is checked against Catastro, owner-confirmed, with declared accurate price. Over time this becomes a real consumer-side brand asset.
- **Trust features for agents:** public "Verified Agent" profiles with Casablanca-tracked metrics (avg response time, % closed listings, client reviews), giving reputable agents a way to differentiate from the long tail.
- **Don't ignore the consumer side of this brand.** When we eventually launch SearchCasa (Phase 4+), our consumer wedge is trust: "every listing is real, every agent is verified."

---

## 5. Captación (seller acquisition) is where agents are bleeding

Per iad España's captación guide, the six barriers to acquiring listings are:
1. **Intense local competition** — many agents chasing the same listings
2. **Weak adaptation** to market shifts
3. **Reputation crisis** — owners pick competitors if they perceive poor image
4. **Weak online presentation** — owners judge agents by their photos, virtual tours, description quality
5. **Obsolete outreach** — old techniques don't work
6. **Underinvestment in tooling** — no CRM, no pricing estimator, no prospect tracking

Critically: **92% of Spanish homebuyers start their search online**, and owners comparison-shop agents before signing the mandate.

**Implications for Casablanca:**

- **Captación Suite is Phase 2's flagship**, not an afterthought.
  - Embeddable AVM valuation widget for agency websites — captures owner leads as they pre-shop their flat's price.
  - "Compare your agent" page: agency microsite that lets an owner see the agent's portfolio, response time, avg days on market, recent closings.
  - Automated LinkedIn/Instagram post generator: every new listing gets a reel and a post auto-drafted for the agent.
- **Product #4 could be "Valuation Lead Magnet":** free widget for the agent's website that gives a seller a Catastro + comparable-based price estimate, captures the email + phone, routes to the agent. This is a pure growth channel for agents, and we bundle it into Agent OS pricing.
- **Phase 0 media studio directly addresses captación point #4.** Owners comparing agents will pick the one with magazine-quality photos over the one with iPhone snapshots. We can pitch media studio as a *captación weapon* ("use our staged photos in your listing presentation to win mandates"), not just a listing dressing tool. This is a better pitch than "make listings pretty."

---

## 6. Ley de Vivienda (2023) has reshaped the market — and created a software opportunity

Post Ley 12/2023:
- **Agency commission must be paid by the landlord** (not the tenant) for rentals. Triggered mass layoffs — one reported agency went from 43 to <21 staff.
- Rental transactions cratered in 2024; many agencies pivoted to sales.
- Disclosure rules changed: agents must provide complete, truthful, accessible info on every listing.
- "Zona tensionada" rent caps apply in Catalunya and some Madrid neighborhoods.

**Implications for Casablanca:**

- **Compliance-by-default wins.** Our listing copy generator pre-populates the required Ley de Vivienda disclosures. Inmovilla hasn't done this properly yet.
- **Pivot-tooling:** agencies moving from rentals to sales need to rebuild their database. A migration tool that pulls rental contacts into a sales pipeline is a conversion hook.
- **Zona tensionada calculator:** for agencies operating in Madrid/Catalunya, automatic check on whether a given address falls under rent caps, with the applicable reference price.

---

## 7. Document burden: nota simple, cédula de habitabilidad, certificado energético

Every Spanish sale requires:
- **Nota simple** from Registro de la Propiedad (pulled by the agent or buyer's lawyer)
- **Certificado de eficiencia energética** — notary rejects transaction without it
- **Cédula de habitabilidad** — required in many regions, 20-30 days to obtain
- **ITE (Inspección Técnica de Edificios)** — for buildings older than ~45 years
- **Plusvalía municipal** calculation
- **ITP** (tax on transactions) filing
- **IBI, comunidad** up-to-date certifications

Each is a separate web form, separate supplier, separate PDF. Agents waste ~2–4 hours per transaction chasing documents.

**Implications for Casablanca:**

- **Document Concierge** (Phase 3) becomes a material revenue stream and a lock-in moat. Per-transaction take-rate (€20-80 for energy certificate, €5-15 for nota simple automation).
- **Energy certificate partnership with CertiCalia** or similar as a month-9 deliverable.
- **Nota simple automation via Colegio de Registradores API** — technically complex but valuable.
- Bundle as "Casablanca Cierre" — a full closing concierge for agents, with commission carveout.

---

## 8. The iad España disruption signal

iad España (part of iad Group, French origin, ~5,000 agents in Spain, growing fast) runs a 100%-remote, commission-at-87.8%-max model. Key signals from agent reviews:

- **Pull factor:** 69-87.8% commission retention vs. ~40-50% at traditional agencies
- **Push factor away from iad:** high monthly fees (€150-200), required insurance, coach availability lottery, loneliness (no office)
- iad agents describe needing better individual tooling — they don't have an office IT team
- iad bundles an app called "propertips" for referrals

**Implications for Casablanca:**

- **Network-only agents (iad, SAFTI, etc.) are an underserved tier.** They have cash flow (bigger commission cuts), no agency overhead, and need all the tools iad doesn't provide in-house.
- **Pricing tier opportunity:** "Casablanca Solo" at €149–249/mo positioned specifically at network-model agents who bill their own commissions.
- **Competitive tell:** if iad/SAFTI bundle a media studio + speed-to-lead tool into their base package within 12 months, they become a serious threat. We should think about white-labeling Casablanca for a network as a defensive play.

---

## 9. Valuation / AVM market is active but fragmented

- Tinsa Digital, Euroval, Gloval, Idealista Data, Trovimap all offer AVM.
- Most are B2B for banks and funds, not B2C for sellers or agents.
- Trovimap offers a free consumer AVM — lightweight, noisy.
- Idealista Data charges agencies for access to their valuation model.

**Implications for Casablanca:**

- **Build or license an AVM wrapper** for our captación widget. Catastro data is free and public; comparable-based pricing is a straightforward ML problem on a dataset we'll accumulate naturally.
- **Don't try to beat Tinsa on accuracy.** Beat them on integration: AVM embedded in the agent's acquisition workflow, not a standalone tool.

---

## 10. FSBO (particular vendedor) is a permanent feature of the market

Idealista allows particulares to post **2 listings free**, then charges €140 for the third if associated with a business. This puts DIY sellers on the same shelf as agents.

Common FSBO complaints:
- Hundreds of competing listings in the same barrio
- Don't know how to price
- Notary will reject without the right docs
- Time commitment is crushing

**Implications for Casablanca:**

- **Do not build an FSBO-direct product.** That pits us against every paying agency customer. Agents hate FSBO and hate any tool that enables it.
- **Do build agent-side "FSBO converter":** a tool that helps agents approach active FSBO listings on Idealista/Milanuncios with a value-proposition message. We scrape public FSBO listings (legal), identify fresh ones, draft outreach messages for the agent to send. This is a captación goldmine.

---

## Summary: product additions to incorporate

| # | Finding | Product change | Where in roadmap |
|---|---|---|---|
| 1 | Idealista owns Inmovilla | Reframe competitive positioning; prioritize Inmovilla import; avoid Idealista-owned rail partners | MASTERPLAN §6, PRODUCT §Phase 1–3 |
| 2 | €72-120k/year in lost leads per agency | **Add AI Speed-to-Lead as Phase 0.5**, shipping in weeks 3-4 | PRODUCT §Phase 0 |
| 3 | Channel fragmentation | Unified Lead Inbox as Phase 1 flagship | PRODUCT §Phase 1 |
| 4 | Trust crisis | "Verified Agent" + "Verified Listing" badges; consumer trust wedge in Phase 4 | MASTERPLAN §4, PRODUCT §Phase 4 |
| 5 | Captación is bleeding | Captación Suite as Phase 2 flagship; AVM widget + microsite comparison + reel generator | PRODUCT §Phase 2 |
| 6 | Ley de Vivienda | Compliance-by-default in listing copy; zona tensionada calculator; rental→sales migration tool | PRODUCT §Phase 1 |
| 7 | Document burden | Document Concierge as Phase 3 revenue stream (not just nice-to-have) | PRODUCT §Phase 3 |
| 8 | iad model | Pricing tier for network-only agents; watch for white-label defense | GTM §Pricing |
| 9 | AVM fragmentation | Build wrapper AVM for captación widget; don't chase accuracy leaders | PRODUCT §Phase 2 |
| 10 | FSBO permanence | Ship agent-side FSBO converter; never build consumer FSBO product | PRODUCT §Phase 2 |

These additions are reflected in the updated PRODUCT-ROADMAP.md and GTM-ROADMAP.md.

---

## Sources

Industry + market signal:
- [Remmit — Por qué tu agencia pierde el 40% de sus leads](https://remmit.app/blog/por-que-tu-agencia-pierde-leads)
- [Sooprema — ¿Tus captaciones mueren en WhatsApp?](https://www.sooprema.com/arreglar-seguimiento-whatsapp-inmobiliario/)
- [AI Fast Track — Cómo responder a un lead inmobiliario en menos de 5 minutos](https://www.aifasttrack.tech/blog/responder-lead-inmobiliario-5-minutos)
- [iad España — Dificultades para captar propiedades](https://www.join-iad.es/blog/dificultades-para-captar-propiedades/)
- [iad España — Mejorar la captación inmobiliaria](https://www.join-iad.es/blog/mejorar-la-captacion-inmobiliaria/)

Competitive landscape:
- [Landing Agency — Mejor CRM inmobiliario en España 2025](https://www.landingagency.com/blog/mejor-crm-inmobiliario-en-espana-comparativa)
- [InmoCMS — Comparativa CRM inmobiliarios](https://inmocms.com/comparativa-crm-inmobiliarios/)
- [Witei — Top 5 mejores CRM Inmobiliario](https://get.witei.com/es/articulos/mejor-crm-inmobiliario-espana/)
- [Avaibook — Comparativa CRM inmobiliarios](https://www.avaibook.com/blog/comparativa-crm-inmobiliarios/)
- [ImmoEdge — Best CRMs for Real Estate Agencies in Spain](https://immoedge.com/spains-top-crms-for-real-estate-agencies/)
- [Inmoweb — Property portals integrations](https://www.inmoweb.net/real-estate-portals/)

Market + regulation:
- [Idealista — Los agentes inmobiliarios prevén que el acceso empeore en 2025](https://www.idealista.com/news/inmobiliario/vivienda/2024/11/21/821443-los-agentes-inmobiliarios-preven-que-el-acceso-al-mercado-de-la-vivienda-en-espana)
- [Idealista — La competencia por cada piso de alquiler sigue subiendo](https://www.idealista.com/news/inmobiliario/vivienda/2026/04/15/892974-el-numero-de-interesados-que-compiten-por-cada-vivienda-en-alquiler-crece-un-17-en)
- [eldiario.es — Los portales inflan hasta un 44% el aumento de los precios](https://www.eldiario.es/economia/portales-inmobiliarios-inflan-44-aumento-precios-vivienda_1_12722009.html)
- [Infobae — UGT denuncia a Idealista y Fotocasa](https://www.infobae.com/espana/2025/12/05/ugt-denuncia-a-idealista-y-fotocasa-por-publicar-anuncios-de-pisos-que-no-cumplen-la-ley-no-son-minipisos-son-infraviviendas/)
- [Idealista News — Impacto Ley de Vivienda en inmobiliarias](https://www.idealista.com/news/inmobiliario/vivienda/2023/11/29/809518-la-ley-de-vivienda-arrastra-a-las-inmobiliarias-despidos-y-giro-hacia-la)
- [BOE — Ley 12/2023 por el derecho a la vivienda](https://www.boe.es/buscar/act.php?id=BOE-A-2023-12203)
- [Arrenta — Cómo afecta la Ley de Vivienda a los profesionales](https://www.arrenta.es/blog/mercado-legislacion/como-afecta-ley-vivienda-actividad-profesionales-inmobiliarios/)

Consumer sentiment + trust:
- [Trustpilot — Idealista reviews (1.3/5 rating)](https://www.trustpilot.com/review/idealista.com)
- [El Blog Salmón — Precios inflados en Idealista](https://www.elblogsalmon.com/entorno/desesperado-porque-todos-pisos-idealista-tienen-precio-inflado-he-cambiado-estrategia-para-buscar-viviendas-chollo)
- [Forocoches thread — Desesperación vivienda, trucos de agente inmobiliario](https://forocoches.com/foro/showthread.php?t=10003317)
- [Forocoches thread — Mentiras de agentes inmobiliarios](https://forocoches.com/foro/showthread.php?t=7580472)
- [Forocoches thread — Recomendáis ser asesor inmobiliario?](https://forocoches.com/foro/showthread.php?t=9422833)

Documents + compliance:
- [Certificados Energéticos — Cédula + certificado energético](https://www.certificadosenergeticos.com/cedula-de-habitabilidad-certificado-energetico)
- [Immotècnics — Cédula de habitabilidad y certificado energético](https://immotecnics.com/cedula-habitabilidad-certificado-energetico/)

iad + alternative models:
- [GoWork — Opiniones sobre iad España (195 reviews)](https://es.gowork.com/iad-espana-espana)
- [Empresario Independiente — IAD España Opiniones 2025](https://empresarioindependiente.es/iad-espana-opiniones/)
- [Trustpilot — iad España reviews](https://es.trustpilot.com/review/www.iadespana.es)

AVM / valuation:
- [Tinsa Digital AVM](https://www.tinsadigital.com/que-hacemos/avm/)
- [Idealista Data — AVM](https://www.idealista.com/data/consultoria-inmobiliaria/valoracion-automatica/)
- [Euroval — AVM methodology](https://euroval.com/metodos-estadisticos-de-valoracion-masiva-de-inmuebles-valoracion-automatizada-avm/)

Commissions + legal:
- [Garón Abogados — No pagar comisión inmobiliaria](https://www.garonabogados.es/blog/comision-inmobiliaria-puentear-venta-piso/)
- [Properfy — Comisiones inmobiliarias en España 2025](https://www.properfy.es/cuanto-cobra-una-inmobiliaria-por-vender-un-piso-honorarios-y-comisiones/)
- [Artículo 14 — Consumo investiga comisiones ilegales](https://www.articulo14.es/economia/consumo-investiga-inmobiliarias-cobrar-comisiones-ilegales-inquilinos-20241022.html)
