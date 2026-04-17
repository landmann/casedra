# Responde — Phase 0 Technical Build Plan

Engineering spec for Casablanca's AI Speed-to-Lead bot. Scope: **Weeks 2–4 of Phase 0** (May 1 → May 17, 2026), shipping alongside the Media Studio from weeks 1–2.

**Companion docs:** `MASTERPLAN.md` §3, `PRODUCT-ROADMAP.md` Phase 0, `COMPETITIVE-LANDSCAPE.md` §1.2.

**Date:** 2026-04-17.

---

## 1. What Responde is, exactly

A headless AI agent that does three things for a Spanish real estate agent:

1. **Auto-reply on WhatsApp in <60s**, 24/7, in Spanish, to any new inbound lead.
2. **Run a qualification conversation** (budget, timeline, property type, neighborhood, contact preference) and score the lead.
3. **Hand back to the agent** at the right moment with a summary + next-action prompt.

Lead sources wired in Phase 0:
- Inbound WhatsApp message from a new number
- Portal lead email (Idealista, Fotocasa, Habitaclia) forwarded to a Casablanca inbox → outbound WhatsApp initiated
- Missed call to the agent's line → outbound WhatsApp initiated

Out of scope for Phase 0: Instagram DM, web chat widget, voice calls, multilingual, agent-takeover UI in the mobile app (Phase 1).

---

## 2. Provider choice: 360dialog (primary), Meta Cloud API (fallback)

**Decision: start with 360dialog.**

| Provider | Why / why not |
|---|---|
| **360dialog** | Berlin-based, EU-primary, Meta BSP Tier 1, no per-message markup (you pay Meta direct rates), fastest Spanish-business onboarding (~3–7 days typical), strong docs. **Our pick.** |
| **Meta WhatsApp Cloud API (direct)** | Cheapest per message, but we handle all Business Manager + display name verification + template approval ourselves. Slower onboarding for each agency. **Keep as fallback** — the provider abstraction must allow a swap. |
| **Twilio WhatsApp** | Mature SDK, US-first pricing, ~2–3× cost per message vs. 360dialog. Use only if 360dialog blocks us. |

**Action: open the 360dialog partner account this week (2026-04-17).** Onboarding lead time is the critical path — every agency we sign needs a verified WhatsApp Business profile, and the clock starts on the day they submit Meta Business verification.

### Phone number strategy per agency

Two modes, agent chooses at signup:

- **BYON (Bring Your Own Number):** agent migrates their existing business WhatsApp to 360dialog. Cleanest UX (customers see the number they already know). ~3–7 day verification. **Requires them to stop using WhatsApp consumer app on that number.**
- **Casablanca-provisioned number:** we rent a Spanish number (+34) via 360dialog and put it on their microsite / Idealista listing. Live in <1 day. Downside: new number customers haven't seen before. Best for brand-new agents and for Responde-only tier.

Most friend-agencies will pick BYON. Default the signup flow to BYON; offer Casablanca-provisioned as a toggle.

### Consent + Ley de Protección de Datos (LOPD/GDPR)

- First outbound message to a new lead must be a Meta-approved **Utility or Marketing template** (not free-form). Template: *"Hola, soy [Agent Name]. Vi tu interés en [propiedad]. ¿Te contesto por aquí?"*
- Store explicit opt-in when the lead replies. Log timestamp + conversation ID + message body.
- Persist an LOPD-compliant data map per agency (where lead data lives, retention, deletion endpoint).
- Include a one-line disclosure in the first bot message: *"Te responde un asistente virtual supervisado por [Agent Name]."* Required under Spanish consumer-protection practice and Ley de Servicios Digitales.

---

## 3. Architecture (in the existing Convex + Next.js stack)

```
┌─────────────────────────────────────────────────────────────┐
│  Lead Sources                                               │
│                                                             │
│  WhatsApp inbound ─┐                                        │
│  Portal lead email ┼──► Next.js webhook routes              │
│  Missed call       ─┘   (/api/whatsapp/webhook,             │
│                          /api/email/inbound,                │
│                          /api/voice/missed-call)            │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Convex (data + orchestration)                              │
│                                                             │
│  Tables: leads, conversations, messages,                    │
│          qualificationState, agencyChannels                 │
│                                                             │
│  Functions:                                                 │
│    - ingestInboundMessage (mutation)                        │
│    - runQualifier (action, calls LLM)                       │
│    - sendOutboundMessage (action, calls 360dialog)          │
│    - checkHandbackTriggers (query)                          │
│    - notifyAgent (action)                                   │
│                                                             │
│  Scheduled: handbackWatchdog (every 60s) — escalates stale  │
│  conversations to the agent if bot hasn't made progress.    │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent-side surfaces                                        │
│                                                             │
│  - WhatsApp summary to agent's personal number              │
│  - Web inbox (apps/web): live thread + "take over" button  │
│  - Mobile push (Phase 1)                                    │
└─────────────────────────────────────────────────────────────┘
```

**Why webhooks live in Next.js routes, not Convex HTTP actions:** 360dialog's webhook signing expects stable HTTPS + immediate 200 return. Next.js route is easier to lock down. The route does minimal work — signature verify, enqueue to a Convex mutation, return 200. The Convex mutation kicks off the Convex action that calls the LLM.

---

## 4. Data model

All tables live in `convex/schema.ts`. Namespace: `responde.*` to keep separable from Media Studio.

```ts
// convex/schema.ts (additions)

leads: defineTable({
  agencyId: v.id("agencies"),
  phone: v.string(),               // E.164 normalized
  name: v.optional(v.string()),
  source: v.union(
    v.literal("whatsapp_inbound"),
    v.literal("idealista_email"),
    v.literal("fotocasa_email"),
    v.literal("habitaclia_email"),
    v.literal("missed_call"),
    v.literal("manual"),
  ),
  sourceRef: v.optional(v.string()),  // e.g. Idealista listing ID
  status: v.union(
    v.literal("new"),
    v.literal("qualifying"),
    v.literal("qualified"),
    v.literal("handed_back"),
    v.literal("cold"),
    v.literal("closed_won"),
    v.literal("closed_lost"),
  ),
  qualificationScore: v.optional(v.number()),  // 0–100
  assignedAgentId: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_agency_phone", ["agencyId", "phone"])
  .index("by_status", ["agencyId", "status"]),

conversations: defineTable({
  leadId: v.id("leads"),
  agencyId: v.id("agencies"),
  channel: v.literal("whatsapp"),     // sms/ig in Phase 1+
  providerConversationId: v.string(), // 360dialog conversation id
  state: v.union(
    v.literal("bot_active"),
    v.literal("awaiting_agent"),
    v.literal("agent_active"),
    v.literal("closed"),
  ),
  lastInboundAt: v.optional(v.number()),
  lastOutboundAt: v.optional(v.number()),
}).index("by_lead", ["leadId"])
  .index("by_agency_state", ["agencyId", "state"]),

messages: defineTable({
  conversationId: v.id("conversations"),
  direction: v.union(v.literal("in"), v.literal("out")),
  senderType: v.union(
    v.literal("lead"),
    v.literal("bot"),
    v.literal("agent"),
    v.literal("system"),
  ),
  body: v.string(),
  mediaUrl: v.optional(v.string()),
  providerMessageId: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_conversation", ["conversationId", "createdAt"]),

qualificationState: defineTable({
  conversationId: v.id("conversations"),
  slots: v.object({
    intent: v.optional(v.string()),           // comprar / alquilar / vender
    propertyType: v.optional(v.string()),     // piso / casa / local / ...
    neighborhood: v.optional(v.string()),
    budget: v.optional(v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
    })),
    timeline: v.optional(v.string()),         // ASAP / 1-3mo / 3-6mo / +6mo
    contactPref: v.optional(v.string()),      // whatsapp / phone / email
    name: v.optional(v.string()),
  }),
  currentSlot: v.string(),
  attemptsCurrentSlot: v.number(),
  lastLlmCallAt: v.optional(v.number()),
}).index("by_conversation", ["conversationId"]),

agencyChannels: defineTable({
  agencyId: v.id("agencies"),
  channelType: v.literal("whatsapp"),
  providerId: v.literal("360dialog"),       // extensible
  providerPhoneId: v.string(),
  phoneE164: v.string(),
  displayName: v.string(),
  verificationStatus: v.union(
    v.literal("pending"),
    v.literal("verified"),
    v.literal("failed"),
  ),
  webhookSecret: v.string(),
  createdAt: v.number(),
}).index("by_agency", ["agencyId"])
  .index("by_phone", ["phoneE164"]),
```

No new Postgres, no new Redis. Everything is Convex.

---

## 5. Qualification script — LLM-orchestrated, not rigid

**Decision: do not hardcode a decision tree.** A rigid tree breaks on the first unexpected Spanish phrasing. Instead: a slot-filling LLM loop with a strict tool/function interface.

### Slots to fill (priority order)

1. `intent` — comprar / alquilar / vender / captación / información
2. `propertyType` — piso / ático / casa / chalet / local / oficina / garaje / trastero
3. `neighborhood` — free text, resolved against a Spanish neighborhood gazetteer post-hoc
4. `budget` — free text → `{min, max}` euros; accept "hasta 300k", "entre 200 y 250", "no sé todavía"
5. `timeline` — ASAP / 1–3 meses / 3–6 meses / +6 meses / exploring
6. `contactPref` — whatsapp / phone / email + best-time window
7. `name` — free text; if not given by slot 5, probe once

### The LLM loop (pseudocode)

```ts
// convex/responde/qualifier.ts
export const runQualifier = action({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const state = await ctx.runQuery(api.responde.getState, { conversationId });
    const history = await ctx.runQuery(api.responde.getHistory, { conversationId });
    const agency = await ctx.runQuery(api.responde.getAgencyProfile, { agencyId: state.agencyId });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // cheap, fast, good Spanish
      messages: buildPrompt({
        systemPrompt: SPANISH_AGENT_SYSTEM_PROMPT,
        agencyContext: agency,   // name, neighborhoods served, typical listings
        slotsFilled: state.slots,
        currentSlot: state.currentSlot,
        history,
      }),
      tools: [
        updateSlotTool,          // { slot, value }
        askClarifyingTool,       // { question }
        handbackTool,            // { reason }
        sendListingLinkTool,     // { listingId }
      ],
      tool_choice: "required",
    });

    return await handleToolCall(ctx, conversationId, response);
  },
});
```

**Why gpt-4o-mini, not GPT-4o:** 10× cheaper, ~200ms faster, good enough for slot-filling in Spanish. We log every call; if we see quality drops we upgrade the harder slots (budget parsing especially).

**Why tools not free-form:** we never let the model send a message directly. Every outbound message goes through the `updateSlot` or `askClarifying` tool so we can enforce: max 1 question per turn, no promises about pricing, no legal advice, the disclosure line is always appended to the first message.

### System prompt anchors (Spanish, shortened)

```
Eres un asistente virtual de la inmobiliaria {agency.name}. 
Tu única tarea: entender qué busca el lead en máximo 6 mensajes, 
sin agobiar. Responde siempre en español neutro de España.

Reglas inquebrantables:
- Una sola pregunta por mensaje.
- Si el lead pide hablar con una persona, llama a la función handback.
- Nunca confirmes precios, disponibilidad, ni pactes visitas. 
  Eso siempre lo hace el agente humano.
- Nunca inventes propiedades.
- Si detectas otro idioma, llama a handback con reason="idioma_no_español".
- Si el lead está agresivo o insultante, llama a handback con 
  reason="tono_negativo".
```

### Prompt caching + cost

- System prompt is stable → Anthropic prompt caching or OpenAI static system messages cut cost ~40%.
- Estimate: ~2.5k input tokens × 6 turns × €0.00015/1k = ~€0.002 per conversation. Round to €0.01 per lead with output + tool overhead. Budget 5,000 leads/agency/month = €50/agency/month LLM cost at worst. Well inside Responde's €99 price.

---

## 6. Handback UX

Handback is the single most important UX decision in the bot. Get it wrong and the agent distrusts the system forever.

### Automatic handback triggers (in order of urgency)

| Trigger | Behavior |
|---|---|
| Lead types *"quiero hablar con una persona"*, *"pásame con un agente"*, *"humano por favor"* (or LLM detects equivalent) | Immediate handback. Send lead: *"Claro, te paso con [Agent Name] ahora mismo."* Ping agent. |
| Lead asks about a specific listing we don't have in the agency's inventory | Handback: *"Dame un segundo, se lo confirmo a [Agent Name]."* |
| Tone negative / insulting | Silent handback — no message to lead, urgent ping to agent. |
| Non-Spanish language detected | Handback with translated summary for the agent. |
| All 6 slots filled (qualified) | Normal handback: summary message to agent, friendly wrap message to lead. |
| 3 failed attempts on the same slot | Handback: *"Prefiero que te conteste [Agent Name] directamente."* |
| No lead reply for 5 min mid-conversation | Do NOT handback yet. Send 1 follow-up at 30 min. If still silent at 24h, mark cold. |
| Agent manually clicks "take over" in web inbox | Bot muted immediately. Any in-flight LLM call is discarded. |

### The handback message (to the agent)

On WhatsApp, to the agent's personal number. Format:

```
🏠 Lead nuevo — [Source: Idealista listing "Piso 2h Chamberí"]

Nombre: Ana García
Teléfono: +34 612 345 678
Intención: Comprar
Tipo: Piso 2–3 hab
Zona: Chamberí o Chamartín
Presupuesto: 350–400k
Plazo: 2–3 meses
Contacto preferido: WhatsApp, tardes

Resumen: Ana vio tu listing de Chamberí esta tarde. Busca para mudarse 
con su pareja en verano. Dice que ya tiene preaprobación hipotecaria.

👉 Para tomar la conversación, responde "sigo yo" o entra en 
casablanca.ai/inbox/[id]
```

The *"sigo yo"* reply flips conversation state to `agent_active` and kills the bot. Any WhatsApp message the agent sends from their phone to the lead's number from that point is mirrored into the Casablanca inbox (via 360dialog webhook).

### The "take over" web flow

In `apps/web/src/app/app/inbox/[conversationId]`:
- Live transcript (Convex subscription).
- Sticky header: lead summary + qualification score + source.
- One-click **"Tomar conversación"** button → mutation flips state, bot goes silent. The button is a panic button — large, red, unambiguous.
- One-click **"Devolver al bot"** button (Phase 1 addition) to re-engage for follow-up scheduling.

### The silent-handback case (tone negative)

When the lead is abusive or a troll, we do NOT send a "paso con el agente" message (that rewards the behavior). We just mute the bot and flag the conversation as `awaiting_agent` with tag `negative_tone`. The agent sees it in their queue and decides whether to reply.

---

## 7. Lead source adapters

### 7.1 WhatsApp inbound

- 360dialog POSTs to `/api/whatsapp/webhook`.
- Verify HMAC signature.
- Resolve `agencyChannels` by `providerPhoneId`.
- If the sender phone is not in `leads` for this agency → create lead, create conversation, enqueue `runQualifier`.
- If existing conversation in `agent_active` state → just persist the message, do not trigger bot.

### 7.2 Portal lead email (Idealista, Fotocasa, Habitaclia)

- Each agency gets a unique forwarding address: `leads+<agencyId>@mail.casablanca.ai` (via Resend inbound or Cloudflare Email Workers).
- Agent configures this address in Idealista/Fotocasa/Habitaclia agent dashboard as the notification destination.
- Inbound-email parser extracts: lead name, phone, listing URL, portal source. Each portal has a different format; we maintain 3 parsers with regex + fallback LLM extraction for unknown formats.
- Pseudocode:

```ts
// apps/web/src/app/api/email/inbound/route.ts
export async function POST(req: Request) {
  const payload = await verifyAndParse(req);
  const agencyId = extractAgencyId(payload.to);  // from alias
  const { phone, name, listingRef, portal } = parsePortalEmail(payload.body);
  
  await convex.mutation(api.responde.ingestPortalLead, {
    agencyId, phone, name, listingRef, source: `${portal}_email`,
  });
  
  return new Response(null, { status: 200 });
}
```

- After lead created: send outbound WhatsApp **template message** (Meta pre-approved) from the agency's channel: *"Hola {name}, soy {agent}. Vi tu interés en {listing}. ¿Te contesto por aquí?"*
- This opens the 24-hour messaging window. Once the lead replies, we're in free-form mode.

### 7.3 Missed-call rescue

- Two options, agent chooses:
  - **Call forwarding to Casablanca number** — cleaner, but requires operator configuration. Skip in Phase 0.
  - **Twilio/360dialog SIM-watch** — infeasible short-term.
  - **Manual missed-call entry via mobile shortcut** — Phase 0 fallback. Agent long-presses a missed call in their phone, shares to "Casablanca Responde" (Expo deep link), the app captures number + timestamp and fires `ingestMissedCall`.
- For Phase 0, ship only the mobile-shortcut path. Call-forwarding is Phase 1.

---

## 8. Outbound message send path

All outbound messages go through `sendOutboundMessage` action:

1. Check conversation state — refuse if `agent_active`.
2. Check 24-hour window — if outside, require a template message and the right template ID.
3. Rate limit — max 1 outbound per conversation per 10s.
4. Call 360dialog API.
5. Persist message with `providerMessageId`.
6. Update `conversations.lastOutboundAt`.

The rate limit prevents a runaway LLM loop from spamming a lead (real risk — have seen it in early Intercom-style products).

---

## 9. Observability

Every Responde agency sees a dashboard at `casablanca.ai/app/responde`:

- Leads today / this week / this month
- Median first-reply time (target: <60s; alert if >120s)
- Qualification rate (leads reaching `qualified` state / total leads)
- Handback rate by reason (healthy: 60–70% qualified handbacks, <10% negative-tone)
- Deals attributed (manually marked by agent as `closed_won`)

Internally (PostHog):
- `responde.lead_created` — source, latency, agencyId
- `responde.bot_message_sent` — conversationId, slot, tokens, latency
- `responde.handback_triggered` — reason
- `responde.agent_takeover` — conversationId, time_in_bot

Set alarms: if median reply latency >120s for 5 min, page an engineer.

---

## 10. Four-week build schedule

### Week 1 (2026-04-17 → 2026-04-24) — foundations, demo path
- Open 360dialog partner account (day 1 — critical path)
- Provision one Casablanca test WhatsApp number
- Convex schema for responde tables
- Next.js `/api/whatsapp/webhook` route with signature verify
- Simple echo bot end-to-end (no LLM yet) — message in, message out, persisted
- Agency onboarding wizard: connect WhatsApp (BYON or provisioned)
- Legal review of consent + disclosure copy

### Week 2 (2026-04-24 → 2026-05-01) — qualifier live on friend agency #1
- LLM qualifier (OpenAI gpt-4o-mini) with tool-calling
- Slot-filling loop + state persistence
- Spanish system prompt + eval set (20 sample conversations)
- Handback message to agent's WhatsApp
- First live agency (friend #1) on Responde, receiving real leads
- **Gate G0 target:** 5 paying agencies, €300 MRR by 2026-05-01

### Week 3 (2026-05-01 → 2026-05-08) — portal-lead bridge
- Resend inbound setup + per-agency aliases
- Idealista email parser + Fotocasa parser + Habitaclia parser (regex + LLM fallback)
- Template message for outbound cold-open
- Meta template approval (submit week 1; approval by now)
- Web inbox MVP in `apps/web/src/app/app/inbox` with "take over" button
- Friend agencies #2 and #3 onboarded

### Week 4 (2026-05-08 → 2026-05-17) — missed-call + scale to 20
- Mobile missed-call share flow (Expo deep link)
- Observability dashboard for agencies
- LLM eval on 200 real conversations — iterate prompt
- Rate limits + safety switches battle-tested
- **Gate G1 target:** 20 paying agencies, €2,000 MRR, 70%+ on Responde tier

---

## 11. Risks and how we kill them

| Risk | Mitigation |
|---|---|
| 360dialog onboarding slower than 3–7 days for some agencies | Start verification for the 3 friend-agencies now, before product is ready. Casablanca-provisioned number as day-1 fallback. |
| Meta template rejection delays cold-open messaging | Submit 3 template variants week 1. Have plain "Utility" variants ready, not marketing-heavy. |
| LLM responds incorrectly, agent loses trust | Every response logged, every handback tagged. First 200 conversations reviewed manually by a founder daily. Prompt iterated weekly. |
| WhatsApp 24-hour window surprises agents | UI surfaces the window clearly; if expired, auto-suggests a template. |
| Lead spams the bot / bot loops | Rate limits per conversation; attempt counter triggers handback; hard cap of 10 outbound messages per conversation without agent touch. |
| GDPR complaint | Disclosure line on first message. Explicit opt-in logging. Data-deletion endpoint per lead. Legal review before week 2 ship. |
| Bot books a viewing or quotes a price by hallucination | Forbidden by system prompt AND enforced by tool interface — bot has no `scheduleViewing` or `quotePrice` tools, so it physically cannot. |
| Agent doesn't see handback in time | Redundant notification: WhatsApp to personal number + SMS fallback if WhatsApp read receipt not fired in 10 min + mobile push (Phase 1). |

---

## 12. What we do NOT build in Phase 0

- Agent-side mobile app for inbox (web only — Phase 1)
- Auto-scheduling of viewings
- Calendar integrations
- Voice / IVR
- Multi-language (Spanish only, es-ES)
- Fine-tuned models (buy off-the-shelf for 12 months)
- Agent personality / voice cloning
- AI-generated voice notes (big LLM risk, low value)
- Group chats
- Re-engagement drips (Phase 1)

Every item above is a reasonable feature request. Every one of them dies in Phase 0.

---

## 13. The one thing to remember while building this

The product is not the bot.

The product is the agent's **first night of sleep** after installing Casablanca — the first evening they don't have to check their phone at 22:30 because the bot already replied to the kid browsing Idealista in bed.

Every design decision — latency budget, handback copy, disclosure tone, the "take over" button — serves that feeling.

Ship that feeling by 2026-05-17.
