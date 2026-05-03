# Feature: Buyer Outbound

## One-line pitch

Find prospective property buyers through high-intent, consent-first signals, convert them into a durable Informe del Comprador audience, help Casedra users craft source-backed buyer newsletters, and route qualified property questions into the inbox.

Madrid is the first launch market. It is not the product name.

## Current product decision

The first executable slice owns subscribers and consent in Convex before adding bulk email sending.

Execution order:

1. Store Informe del Comprador subscribers, preferences, and consent proof in Convex.
2. Ship public buyer pages and forms that feed the subscriber spine and inbox.
3. Improve `/app/newsletter` into the authenticated Informe del Comprador drafting surface for Casedra users.
4. Add Amazon SES dispatch through Lambda once the subscriber and draft contracts are stable.

Until the SES/Lambda workstream is implemented, Casedra must not claim that the product sends newsletters automatically.

## Repo ground truth

Verified on 2026-05-03:

- `/app/newsletter` exists at `apps/web/src/app/app/newsletter/page.tsx`.
- `/app/newsletter` is now an authenticated Informe del Comprador drafting surface. It persists drafts to Convex, creates the first three launch issue drafts for each agency, shows no-SES operational counts, and supports save, ready, copy, and export. It still does not send email directly from the UI.
- The authenticated app nav links to `/app/newsletter` through `apps/web/src/app/app/AppShellNav.tsx`.
- Public `/buyers`, `/buyers/foreign`, `/buyers/hidden-address`, `/buyers/mortgage-readiness`, and `/buyers/investors` routes exist with shared Spanish signup and property-question forms.
- `POST /api/buyers/subscribe` writes Informe del Comprador subscribers and consent proof; `POST /api/buyers/question` routes property questions through a verified `?agency=<slug>` link, with `BUYER_INTAKE_FALLBACK_AGENCY_SLUG` only as the no-agency fallback.
- The workflow model already supports `web_form` channels, buyer contacts, buyer inquiries, conversations, messages, source labels, and raw payload metadata in `convex/schema.ts` and `convex/workflow.ts`.
- `convex/newsletter.ts` owns subscriber, consent-event, draft, issue, delivery, suppression, and unsubscribe-token lifecycle.
- `convex/workflow.ts` exposes a dedicated public buyer web-form ingestion mutation that creates or reuses a `web_form` buyer inquiry conversation with source label `Consulta del Informe del Comprador`.
- Human inbox replies are recorded in workflow state, but external WhatsApp delivery belongs to `feat/integrations/whatsapp.md` and is not a prerequisite for buyer form intake.
- SES dispatch is now represented by Convex issue/delivery/suppression tables, `/api/newsletter/dispatch`, `/api/newsletter/ses-events`, and `/api/newsletter/unsubscribe`; it remains disabled unless AWS SES env vars and `NEWSLETTER_DISPATCH_SECRET` are configured.

## Strategic stance

The newsletter is the center of the buyer acquisition loop.

The durable acquisition asset is not scraped phone numbers or portal contacts. It is a first-party, consented audience that wants better buying intelligence before making a high-stakes property decision.

The loop has two conversions:

- **Default conversion**: join the Informe del Comprador.
- **High-intent conversion**: ask Casedra about a specific property with a listing URL, budget band, buying timeline, language, and preferred contact path.

The product must behave like a trust-building buyer intelligence system, not a cold-spam machine. Scraped portal contacts, WhatsApp group harvesting, random phone numbers, and protected-characteristic targeting are prohibited paths.

## Current market truth

Researched on 2026-05-03. The useful signal is not "who owns a phone number"; it is "who is actively trying to make a Madrid buying decision and lacks trustworthy facts."

- Madrid has a real demand imbalance. Fotocasa reported that 18% of madrilenos wanted to buy a home in H1 2025 while only 3% had put a property on the market; 15% had tried to buy and failed.
- Madrid is also a relative-demand hotspot in portal behavior. idealista/data ranked Madrid first for relative purchase demand in Q1 2025, with Alcala de Henares second.
- Foreign demand is small in absolute Madrid demand but commercially valuable. idealista reported that foreign purchase demand was 4.5% of province demand and 6% of city demand, with US-origin traffic representing about 18% of foreign purchase demand.
- Notariado data shows foreign buyers are still material in Spain: 71,155 purchases in H1 2025, 19.3% of all transactions. Foreign-buyer prices rose especially fast in Comunidad de Madrid, up 17.1% year over year.
- The Spanish purchase buyer profile is affluent and mid-life. Fotocasa puts purchase demand at an average age of 41, majority high or mid-high socioeconomic class, usually living with a partner or family.
- The investor buyer is explicit. Fotocasa's 2026 investor report describes a 44-year-old, high/mid-high income profile; Madrid and Catalonia concentrate investor presence, and 83% say high rents make mortgage payment more attractive.
- The market may be cooling at the margin while financing remains active. INE recorded 2025 national home sales up 11.5%; February 2026 registered housing sales were down 0.5% nationally and 3.0% in Comunidad de Madrid year over year, while February 2026 home mortgages were up 16.3% nationally and 36.9% in Comunidad de Madrid. That makes buyer education more valuable: people still want to buy, but need sharper confidence before bidding.

## Buyer signals

### Strong signals

1. **Search intent**
   - Spanish: `comprar piso madrid`, `hipoteca madrid`, `gastos comprar vivienda madrid`, `nota simple vivienda madrid`, `tasacion piso madrid`, `comprar vivienda alquilada madrid`, `comprar piso sin numero idealista`.
   - English: `buy apartment Madrid`, `buy property Madrid from US`, `Madrid property taxes`, `NIE buy house Spain`, `Madrid mortgage non resident`.
   - Use this for SEO and paid search pages, not cold contact.

2. **Portal-pressure geography**
   - Madrid capital, Alcala de Henares, and commuter towns around Madrid where demand pressure is high relative to available homes.
   - Use geography for content angles and landing-page relevance, not for scraping portal users.

3. **Mortgage readiness**
   - Searches and content engagement around pre-approval, down payment, FEIN, mortgage calculators, Euribor, fixed vs variable, bank requirements, and buying costs.
   - Mortgage brokers, relocation lawyers, and buyer agents can refer people into the newsletter when they ask for market or due-diligence help.

4. **Rental fatigue**
   - People comparing rent vs buy, facing rent increases, expiring temporary contracts, or wanting to stop competing in Madrid rental queues.
   - The compliant path is content and community participation. Do not harvest tenants from groups or listings.

5. **Foreign and relocation intent**
   - US, Latin American, UK, French, Italian, and other international buyers researching NIE, taxes, mortgages, neighborhoods, schools, residency, and buying remotely.
   - The angle is "Informe del Comprador: los hechos que un comprador extranjero necesita antes de confiar en un anuncio."

6. **Investor intent**
   - Searches around yield, rent caps, tourist-rental constraints, tenant-occupied homes, refurbishment, neighborhood liquidity, and rent-vs-mortgage math.
   - This fits Casedra when the newsletter shows official property facts, local constraints, and due-diligence checklists.

### Weak or prohibited signals

- Scraped emails or phone numbers from Idealista, Fotocasa, Facebook groups, WhatsApp groups, directories, or comments.
- Random phone numbers.
- "People who look like buyers" inferred from protected or sensitive characteristics.
- Hyper-personalized housing targeting based on age, gender, nationality, family status, ethnicity, religion, or similar attributes.
- Any signal we cannot explain in the contact record as consented, contextual, or platform-permitted.

## Public buyer surface

Ship these public pages with one shared component system and page-specific copy:

- `/buyers`
- `/buyers/foreign`
- `/buyers/hidden-address`
- `/buyers/mortgage-readiness`
- `/buyers/investors`

Every page needs:

- Informe del Comprador signup form.
- Property-question form.
- Clear privacy and consent copy.
- Spanish-only visible copy.
- UTM/campaign preservation.
- Empty, loading, success, and error states.
- Responsive layout in the Casedra brand system.

Primary CTA:

- `Recibe el Informe del Comprador`

Secondary CTA:

- `Pregunta a Casedra por una propiedad`

Lead magnets:

- **Buyer Checklist**: NIE, mortgage, taxes, nota simple, Catastro, ITE/IEE, community debt, energy certificate, flood/noise/risk checks.
- **Is This Listing Overpriced?**: lightweight page explaining how to compare asking price, official facts, and market context.
- **Guía de anuncios sin dirección**: qué comprobar cuando un anuncio oculta la dirección exacta.
- **Pack Madrid para comprador extranjero**: impuestos, documentos, financiación y errores habituales al comprar a distancia.
- **Lectura para inversores**: alquiler frente a hipoteca, regulación, riesgo de reforma y liquidez por zona.

## Convex subscriber and consent contract

Add Convex-owned newsletter data before adding any sender.

### `newsletterSubscribers`

Purpose:

- One canonical subscriber per owner, email, audience, and market.

Fields:

- `ownerType`: `casedra` or `agency`
- `agencyId`: optional Convex agency id for agency-owned audiences
- `email`
- `fullName`
- `language`: `es` or `en`
- `audience`: `buyers`, `sellers`, `investors`, `landlords`, or `past_clients`
- `market`: default `madrid`
- `status`: `subscribed`, `unsubscribed`, `bounced`, or `suppressed`
- `source`: `google_search`, `seo`, `linkedin`, `meta`, `partner`, `community`, `referral`, `manual`, or `app`
- `campaign`
- `signal`: `search_intent`, `mortgage_readiness`, `foreign_buyer`, `rental_fatigue`, `investor`, `hidden_address`, `area_heat`, or `unknown`
- `contactPreference`: `email`, `whatsapp`, `phone`, or `none`
- `firstSubscribedAt`
- `lastConsentAt`
- `unsubscribedAt`
- `createdAt`
- `updatedAt`

Indexes:

- by `ownerType`, `agencyId`, `email`
- by `ownerType`, `agencyId`, `status`, `market`, `audience`
- by `ownerType`, `agencyId`, `campaign`

### `newsletterConsentEvents`

Purpose:

- Append-only proof for consent, preference updates, unsubscribes, and suppressions.

Fields:

- `subscriberId`
- `event`: `subscribe`, `privacy_accept`, `preference_update`, `unsubscribe`, `suppress`, `manual_import`
- `source`
- `campaign`
- `formPath`
- `consentText`
- `privacyVersion`
- `ipHash`
- `userAgentHash`
- `occurredAt`
- `rawPayload`

Rules:

- Newsletter signup creates or reactivates a subscriber and appends a `subscribe` consent event.
- Privacy acceptance is stored as proof, not just as a boolean on the subscriber.
- La baja nunca elimina al suscriptor; cambia el estado y añade un evento.
- If consent proof is missing, the subscriber is ineligible for newsletter dispatch.
- Hash IP and user agent for abuse/debug proof; do not store raw IP unless there is a specific operational requirement.

## Public form endpoints

### `POST /api/buyers/subscribe`

Responsibilities:

- Validate email, language, market, audience, consent checkbox, privacy checkbox, source, campaign, and signal.
- Preserve UTM fields and landing-page path in `rawPayload`.
- If a verified `agency` URL parameter is present, store the subscriber as agency-owned; otherwise store the public Casedra-owned subscriber.
- Apply honeypot and lightweight rate limiting.
- Write `newsletterSubscribers` and `newsletterConsentEvents`.
- Return a success state that does not disclose whether the email already existed.

### `POST /api/buyers/question`

Responsibilities:

- Validate name, email or phone, language, property URL, question, budget band, buying timeline, contact preference, consent checkbox, privacy checkbox, source, campaign, and signal.
- Resolve `agency`, `agency_slug`, or `ref` URL parameters against active agency slugs before routing; never trust free-text agency names for routing.
- Create or update the newsletter subscriber when the user opts into Informe del Comprador. Verified agency links create agency-owned subscribers; public/fallback intake creates Casedra-owned subscribers.
- Create a workflow contact and `web_form` buyer lead through a dedicated Convex mutation.
- Create or reuse an open conversation, set state `new`, owner `unassigned`, and source label `Consulta del Informe del Comprador`.
- Store campaign, signal, property URL, budget band, buying timeline, consent proof id, landing-page path, requested agency slug, resolved agency slug, and routing mode in lead/message metadata.
- Return a clear success state and never expose internal workflow ids to the public client.

## Inbox routing contract

Newsletter signup only:

- No conversation required.

Property question:

- Contact kind: `buyer`.
- Lead kind: `buyer_inquiry`.
- Channel type: `web_form`.
- Conversation state: `new`.
- Owner: `unassigned`.
- Source label: `Consulta del Informe del Comprador`.

WhatsApp follow-up:

- Only if the user explicitly chooses WhatsApp.
- Store preference now.
- Actual WhatsApp delivery remains governed by `feat/integrations/whatsapp.md`.

## Authenticated Informe del Comprador composer

`/app/newsletter` should become the drafting surface for Casedra users, not a sender.

Keep:

- City selector: Madrid, Barcelona, València, Málaga.
- Audience selector: sellers, buyers, investors, landlords, past clients.
- Informe de mercado con fuentes trazables.
- Editable subject, preheader, body, and source list.

Add:

- Informe del Comprador mode as a first-class audience preset, not just generic "compradores".
- Save draft to Convex.
- Draft status: `draft`, `ready`, `archived`.
- Draft owner: current agency/user.
- Source list snapshot on save.
- Copy/export affordance for the current non-SES stage.
- Clear "not sent from Casedra yet" state until SES is wired.

Do not add:

- A fake send button.
- Subscriber upload.
- Bulk email scheduling.
- Native SES controls before the SES/Lambda workstream starts.

## Newsletter draft contract

### `newsletterDrafts`

Purpose:

- Guardar informes con fuentes trazables creados en `/app/newsletter`.

Fields:

- `agencyId`
- `createdByUserId`
- `market`
- `audience`
- `title`
- `subject`
- `preheader`
- `body`
- `sourceSnapshot`
- `status`: `draft`, `ready`, or `archived`
- `createdAt`
- `updatedAt`

Rules:

- Drafts are editable by agency members.
- Source snapshots should survive upstream source changes.
- A ready draft is eligible for the SES dispatch workstream, but readiness does not imply it has been sent.

## SES and Lambda workstream

This is part of the full outbound feature, but it comes after subscriber/consent ownership and draft persistence.

Use the existing Amazon SES account when implementation begins.

Add:

- `newsletterIssues`: the sendable issue created from a ready draft.
- `newsletterDeliveries`: one recipient-level delivery record per issue/subscriber.
- `newsletterSuppressionEvents`: bounce, complaint, unsubscribe, and manual suppression events.
- SES identity/domain configuration in setup docs.
- Lambda dispatcher that pulls eligible deliveries, sends through SES, and records SES message ids.
- Lambda event processor for SES bounces, complaints, and delivery events.
- Public unsubscribe route with a durable token.
- Suppression checks before every send.

Rules:

- Dispatch only to `subscribed` recipients with valid consent proof.
- Every commercial email must identify Casedra or the agency sender and include a simple free opt-out.
- Bounces and complaints suppress future sends.
- Complaint rate target is zero; any complaint must be visible operationally.

## Launch campaigns

### 1. Google Search

Use search ads and SEO pages for explicit purchase intent.

Ad angles:

- "¿Comprar en Madrid? Comprueba los hechos antes de pujar."
- "La lista del comprador para búsquedas serias."
- "¿Comprador extranjero en Madrid? Documentos, impuestos y riesgos del anuncio."
- "¿Has visto un anuncio sin dirección? Qué comprobar primero."

Conversion:

- Informe del Comprador opt-in.
- Optional property-question form.

### 2. LinkedIn

Use founder-led posts and sponsored content aimed at professional context, not protected housing attributes.

Useful contexts:

- relocation
- global mobility
- immigration
- private banking
- wealth advisory
- mortgage brokerage
- law
- architecture
- proptech
- investment
- Madrid-based professional networks

Post angles:

- "Buyers are not missing listings. They are missing trustable facts."
- "The hidden-address listing problem in Madrid."
- "What serious buyers should verify before making an offer."

Conversion:

- Informe del Comprador opt-in.
- Partner/referral conversations.

### 3. Meta and Instagram

Use broad, compliant creative-led campaigns only after confirming housing-category constraints in Ads Manager.

Creative does the targeting:

- checklist carousel
- "before you bid" short video
- informe de mercado por distrito
- foreign-buyer explainer in English and Spanish

Conversion:

- Informe del Comprador opt-in.
- Property-question form.

### 4. Community and partnership outbound

Do not scrape members. Participate with useful resources and explicit opt-in links.

Channels:

- Madrid expat groups
- Spain FIRE and personal-finance communities
- relocation-lawyer newsletters
- mortgage broker blogs
- buyer-agent/refurbishment partner lists
- university, MBA, and international professional communities where Madrid relocation is common

Offer:

- a useful guide, not a pitch
- "send us a listing if you want to know what to verify"

### 5. Retargeting

Allowed only after consent and cookie compliance.

Segments:

- visited buyer checklist
- used property-question form but did not subscribe
- clicked mortgage/foreign/investor content
- after SES is live: opened a newsletter and clicked "ask about a property"

Do not upload scraped lists. Do not retarget users who declined consent.

## Compliance rules

These are product constraints, not legal advice.

- Email, SMS, and WhatsApp marketing require prior request/authorization or a narrow prior-contract exception under LSSI Article 21.
- Every electronic commercial message must identify the sender and include a simple free opt-out.
- Cold commercial calls are only safe with prior consent or a tightly justified legal basis; random-number calling requires prior consent.
- Check Spanish advertising-exclusion systems before any permitted phone or postal campaign.
- Store consent evidence. If we cannot prove the source and consent state, we do not send.
- For housing ads, do not target or exclude people based on protected or sensitive characteristics. Market reports may describe buyer profiles, but campaigns must not use age, gender, nationality, family status, ethnicity, religion, or similar attributes as targeting criteria.
- Community posts must be value posts with opt-in links. No member scraping.

## First launch sequence

1. Add Convex subscriber, consent-event, and newsletter-draft tables.
2. Add public subscribe and property-question endpoints.
3. Ship `/buyers` with Informe del Comprador signup and one property-question form.
4. Publish `/buyers/hidden-address`, `/buyers/foreign`, `/buyers/mortgage-readiness`, and `/buyers/investors`.
5. Route property-question submissions into the existing workflow model as `web_form` buyer inquiries.
6. Verify agency-link routing with `?agency=<slug>` and keep the fallback agency slug as a server-side safety net, not the primary routing mechanism.
7. Upgrade `/app/newsletter` so users can craft, save, copy, and export Informe del Comprador drafts.
8. Run Google Search for the five strongest intent clusters.
9. Publish two LinkedIn posts per week from the founder account and boost only the best-performing post.
10. Run one broad Meta/Instagram checklist campaign after confirming housing-category constraints in Ads Manager.
11. Recruit five partners: one mortgage broker, one relocation lawyer, one tax/accounting advisor, one buyer agent, one refurbishment architect.
12. Draft the first three Informe del Comprador issues in `/app/newsletter`:
    - Issue 1: "La lista del comprador antes de pujar."
    - Issue 2: "Anuncios sin dirección: qué puede verificarse y qué no."
    - Issue 3: "Pack Madrid para comprador extranjero: NIE, impuestos, hipoteca y comprobaciones."
13. Implement the SES/Lambda dispatch workstream once the subscriber and draft contracts are stable.

## Success metrics

Measure launch success by buyer intent and consent quality, not list size.

Current no-SES stage:

- newsletter signup conversion from landing page: `>= 6%`
- property-question form conversion from landing page: `>= 1.5%`
- qualified property questions per week: `>= 10`
- partner-referred signups per week: `>= 15`
- consent-proof coverage: `100%`
- saved Informe del Comprador drafts per week: `>= 3`
- median first response to property questions: `< 4 business hours`

SES stage:

- unsubscribe rate per issue: `< 0.8%`
- spam complaint rate: `0`
- bounce and complaint suppression coverage: `100%`
- delivery records with SES message id: `100%`

## Sources

- Fotocasa, Madrid H1 2025 demand imbalance: https://prensa.fotocasa.es/informe-radiografia-en-el-mercado-de-la-vivienda-en-madrid-en-el-primer-semestre-de-2025/
- idealista/data, Q1 2025 relative demand ranking: https://www.idealista.com/news/inmobiliario/vivienda/2025/04/21/841132-la-demanda-en-la-compra-de-vivienda-sigue-interesada-en-las-capitales-en-el
- idealista, US-origin Madrid purchase demand: https://www.idealista.com/news/inmobiliario/vivienda/2025/11/23/873156-crece-la-demanda-desde-eeuu-por-comprar-casa-en-madrid-por-el-mayor-interes-de-los
- Consejo General del Notariado, H1 2025 foreign buyers: https://www.notariado.org/liferay/c/document_library/get_file?groupId=2289837&uuid=d356cf72-d1aa-4e1f-a8a9-c5858a8e3514
- INE, ETDP December 2025 and annual 2025: https://www.ine.es/dyngs/Prensa/en/ETDP1225.htm
- INE, ETDP February 2026: https://www.ine.es/dyngs/Prensa/en/ETDP0226.htm
- INE, mortgage statistics February 2026: https://www.ine.es/dyngs/Prensa/H0226.htm?print=1
- Fotocasa, 2025 buyer/renter profile: https://www.fotocasa.es/fotocasa-life/alquiler/perfil-demandante-vivienda-de-alquiler-2025/
- Fotocasa, 2026 investor buyer profile: https://prensa.fotocasa.es/hombre-de-44-anos-y-de-clase-media-alta-el-perfil-del-inversor-espanol-en-vivienda/
- BOE, LSSI Article 21: https://www.boe.es/eli/es/l/2002/07/11/34/con
- AEPD, unsolicited commercial calls: https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/la-aepd-publica-la-circular-sobre-el-derecho-de-los-usuarios
- LinkedIn Ads discrimination policy: https://www.linkedin.com/help/linkedin/answer/a416948
- Google Ads personalized advertising restrictions: https://support.google.com/adspolicy/answer/143465
