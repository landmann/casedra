# Feature: WhatsApp Integration

## One-line pitch

Connect real WhatsApp traffic to Casedra's workflow kernel so the inbox controls the channel that actually matters in the field.

## Why This Matters Now

- The company plan is explicit: Casedra is a WhatsApp-first, inbox-first workflow product.
- An account only really counts once a live channel is connected and the inbox is used weekly.
- The repo now has the workflow foundation needed to support real messaging traffic.
- The largest remaining product gap is not more internal UI or media work. It is the absence of a live WhatsApp path.

## Current Repo Truth

- The workflow schema already supports `whatsapp` channels through `channels.type`, plus leads, conversations, messages, assignments, and handoff history.
- Portal email ingestion is live through `apps/web/src/app/api/workflow/portal-email/route.ts` and `convex/workflow.ts`.
- `/app/inbox` is now a real operational surface, not just preview UI.
- Human replies are currently recorded in workflow state, but they are not yet delivered to a real external messaging provider.
- Onboarding is still too brand/listing/media oriented for the current company phase.
- The environment surface does not yet include WhatsApp provider credentials.

## Decision

- Build a provider abstraction first.
- Implement Twilio first for speed of deployment.
- Keep the abstraction clean so direct Meta Cloud API can replace or coexist with Twilio later.
- Do not let Twilio-specific assumptions leak into the core workflow model.
- Use Twilio for the first Casedra-owned test sender and early design-partner rollout if speed is the priority.
- Revisit direct Meta once sender count, monthly volume, or margin pressure makes the Twilio tax feel real.

## Commercial Analysis

Date checked: `2026-04-24`

- Twilio's official WhatsApp pricing is `$0.005` per message, inbound or outbound.
- Twilio also passes Meta's template fees through on top of that.
- Twilio lists a `$0.001` failed-message processing fee for messages that terminate in `Failed`.
- Direct Meta Cloud API avoids the Twilio `$0.005` markup, but Meta's own fees still apply.

Implication:

- Cheapest long-term path: direct Meta.
- Fastest low-friction path: Twilio.
- Twilio adds about `$50` per `10,000` messages before failed-message fees or add-ons.
- That extra cost matters because support-style traffic inside the 24-hour customer service window may still cost `$0.005` per message on Twilio even when Meta itself is not charging a template fee.

My interpretation:

- Twilio is acceptable for the first live integration.
- Twilio should not become a permanent architectural assumption.
- The right discipline is to spend a small amount of money to get real traffic live quickly, then keep the option to remove the markup later.

## Twilio Versus Direct Meta

### Twilio advantages

- Faster to get working.
- Sandbox exists for immediate testing.
- Sender self-sign-up is easier for the first direct-customer style setup.
- Webhook and send APIs are straightforward.
- Good fit for a product team that still needs to prove workflow trust before optimizing channel cost.

### Twilio disadvantages

- Higher per-message cost.
- Another provider between Casedra and WhatsApp.
- If Casedra later becomes an ISV onboarding many agency-owned senders, the long-term setup gets more nuanced.

### Direct Meta advantages

- Lower unit cost.
- Fewer provider layers.
- Better long-term economics once traffic volume is real.

### Direct Meta disadvantages

- More setup friction now.
- Slightly slower path to first real design-partner traffic.
- Higher implementation and onboarding burden before we have enough live proof.

## Important Provider Note

- Twilio's direct self-sign-up flow is appropriate for the first Casedra-owned sender and small direct-customer style setup.
- Twilio's docs also say that ISVs onboarding customers at scale should use the Tech Provider path instead of pretending to be a simple direct customer.
- That means our early build should assume a future where senders may be owned per agency and registered through a more structured partner flow.

## Product Contract

The first WhatsApp integration must guarantee all of the following:

1. Every inbound WhatsApp message becomes a durable workflow record.
2. Every inbound event is idempotent.
3. Every conversation keeps explicit state and explicit owner.
4. A human can reply from the inbox and have the message actually delivered to WhatsApp.
5. Provider message identifiers are recorded for auditability.
6. The system respects opt-in requirements and the 24-hour customer service window.
7. The system distinguishes free-form replies from template-driven outbound sends.
8. Handoff remains explicit and legible.
9. The workflow model remains provider-agnostic.

## Architecture Stance

Provider I/O should terminate in the Next.js server layer, not directly inside Convex.

Reasoning:

- This matches the current portal-email ingestion pattern.
- Webhook authentication and provider signatures belong in the server edge.
- Provider secrets should stay in the server app env surface.
- Convex should remain the workflow source of truth and the idempotent persistence layer.

Practical split:

- Next route handles Twilio webhook verification and request normalization.
- Next server helpers handle outbound Twilio API calls.
- Convex mutations create or update workflow records from normalized events.

## Good News On Schema

The current workflow schema is already close to sufficient for the first WhatsApp slice.

- `channels.provider` and `channels.externalChannelId` can identify the sender or channel mapping.
- `contacts.phone` can store the lead number.
- `messages.providerMessageId` can store the Twilio message SID.
- `messages.metadata` can hold provider-specific payload details for the first version.
- `leads.rawPayload` can preserve the upstream webhook body where useful.

This means the first slice should aim for minimal schema expansion.

Possible additions only if they become necessary:

- explicit delivery status tracking
- message send failure state
- opt-in evidence records
- template usage metadata that deserves first-class fields

## Recommended Implementation Order

### 1. Provider abstraction

- Add a small WhatsApp provider interface with methods like:
- `verifyInboundRequest`
- `normalizeInboundMessage`
- `sendMessage`
- `sendTemplateMessage`

### 2. Twilio server helper

- Create a dedicated Twilio helper in `apps/web/src/server`.
- Keep Twilio parsing and response semantics out of Convex mutations.

### 3. Inbound webhook

- Add a route such as `apps/web/src/app/api/workflow/whatsapp/twilio/route.ts`.
- Verify the Twilio signature.
- Normalize the inbound payload.
- Call a new Convex mutation like `ingestWhatsAppMessage`.

### 4. Inbound Convex mutation

- Find or create the agency's WhatsApp channel.
- Find or create the contact by normalized E.164 phone number.
- Find or create the open conversation for that contact and channel.
- Insert the inbound message idempotently.
- Reopen a closed thread on new inbound activity where appropriate.

### 5. Outbound delivery

- Update the server-side message flow so a reply from `/app/inbox` both sends the message and records it.
- Record provider SID and metadata after a successful send.
- Fail clearly if provider delivery fails instead of pretending the message was sent.

### 6. Template support

- First support free-form replies inside the 24-hour customer service window.
- Add template sending next for business-initiated opens or re-engagement outside the window.
- Do not overbuild a full template CMS before the first live numbers are working.

### 7. Health and observability

- Instrument webhook acceptance, dedupe hits, send success, send failure, template usage, and handoff after inbound.
- Track per-agency channel health so rollout issues are visible quickly.

## Onboarding Changes Required

The onboarding flow should move closer to the actual wedge.

Add:

- WhatsApp sender setup
- sender verification status
- phone number readiness checks
- routing owner defaults
- basic opt-in capture guidance
- test inbound and test outbound checks

De-emphasize for this phase:

- brand polish
- media planning
- non-essential listing setup depth

## Compliance And Channel Rules

- Explicit user opt-in is required for production messaging.
- Free-form outbound messages are limited to the 24-hour customer service window after user activity.
- Business-initiated messages outside that window need approved templates.
- Casedra should keep proof of opt-in and treat opt-out seriously even if WhatsApp handles blocking natively.

## Risks

### Risk 1: Twilio becomes permanent by accident

- Mitigation: start with a provider abstraction and keep Twilio-specific logic isolated.

### Risk 2: We send messages that the channel should reject

- Mitigation: model the 24-hour window and template requirements explicitly.

### Risk 3: We optimize cost too early and delay go-live

- Mitigation: accept Twilio for the first production path, but set a review trigger for direct Meta.

### Risk 4: We optimize AI behavior before basic delivery trust exists

- Mitigation: ship clean inbound, clean outbound, clear ownership, and clear handoff before heavier autonomy.

### Risk 5: Multi-agency sender ownership gets messy later

- Mitigation: assume the long-term product may need per-agency sender registration and likely an ISV-compatible onboarding model.

## Review Trigger For Direct Meta

We should revisit direct Meta if any of these become true:

- WhatsApp volume is high enough that the Twilio markup is annoying every month.
- Agency-owned senders become the default onboarding pattern.
- We need deeper provider control than Twilio conveniently exposes.
- Gross margin sensitivity starts to matter more than initial integration speed.

Heuristic:

- At `25,000` to `50,000` messages per month, Twilio's markup alone is roughly `$125` to `$250` monthly. That is a reasonable point to re-open the direct Meta question.

## Proposed Next Code Slice

1. Add Twilio env vars and server helper.
2. Add a verified inbound Twilio webhook route.
3. Add a Convex WhatsApp ingestion mutation.
4. Wire inbox replies to actually send through Twilio and record the provider result.
5. Add a minimal channel-setup surface in onboarding.
6. Add lightweight instrumentation for send and ingest health.

## TODO List

### Provider and account setup

- [ ] Create and upgrade the Twilio account used for Casedra's first WhatsApp integration.
- [ ] Enable the Twilio WhatsApp Sandbox for immediate local testing.
- [ ] Register the first real WhatsApp sender through Twilio Self Sign-up.
- [ ] Ensure the chosen phone number is not already registered with WhatsApp and can receive OTP verification.
- [ ] Create or select the correct Meta Business Portfolio and WABA during sender signup.
- [ ] Complete Meta business verification for production readiness.
- [ ] Decide whether the first production sender is Casedra-owned or agency-owned.
- [ ] Record the long-term assumption that multi-agency rollout may require the Twilio ISV / Tech Provider path later.

### Environment and dependencies

- [ ] Add `TWILIO_ACCOUNT_SID` to `apps/web/src/env.ts`.
- [ ] Add `TWILIO_AUTH_TOKEN` to `apps/web/src/env.ts`.
- [ ] Add `TWILIO_WHATSAPP_FROM` to `apps/web/src/env.ts`.
- [ ] Add `TWILIO_MESSAGING_SERVICE_SID` as an optional env var if we want Messaging Service support from the start.
- [ ] Add `TWILIO_WEBHOOK_AUTH_TOKEN` only if we choose to separate webhook verification config from the main auth token.
- [ ] Update `SETUP.md` with the Twilio and WhatsApp setup steps once the implementation is real.
- [ ] Add the Twilio SDK dependency in the workspace that owns outbound sends and webhook verification.

### Provider abstraction

- [ ] Define a small provider-agnostic WhatsApp interface in the server layer.
- [ ] Add normalized inbound event types that do not leak Twilio field names into workflow code.
- [ ] Add normalized outbound result types that capture provider message id, status, and error details.
- [ ] Make the abstraction explicit enough that direct Meta Cloud API can be added later without rewriting workflow logic.

### Twilio server implementation

- [ ] Add a Twilio helper module under `apps/web/src/server`.
- [ ] Implement Twilio request signature verification for inbound webhooks.
- [ ] Implement Twilio inbound payload normalization.
- [ ] Implement Twilio outbound free-form message sending.
- [ ] Implement Twilio outbound template sending for messages outside the 24-hour window.
- [ ] Normalize Twilio errors into a shape the app can surface clearly.

### Inbound WhatsApp webhook

- [ ] Add a dedicated route such as `apps/web/src/app/api/workflow/whatsapp/twilio/route.ts`.
- [ ] Verify the webhook signature before processing payloads.
- [ ] Reject malformed or unsupported payloads with clear server-side logging.
- [ ] Parse agency routing information from the sender configuration or request mapping.
- [ ] Generate or capture a stable dedupe key for inbound events.
- [ ] Support at least inbound text messages in v1.
- [ ] Decide how to handle media, location, contacts, and other non-text payloads in v1:
- [ ] Either ingest them as metadata with a visible placeholder in the thread
- [ ] Or explicitly reject them with clear logging until supported

### Workflow ingestion in Convex

- [ ] Add a dedicated `ingestWhatsAppMessage` mutation in `convex/workflow.ts`.
- [ ] Find or create the agency's WhatsApp channel record.
- [ ] Use `channels.externalChannelId` consistently for sender/channel mapping.
- [ ] Find or create the contact using normalized E.164 phone numbers.
- [ ] Decide the conversation matching rule for WhatsApp:
- [ ] Reuse the latest open thread for the same contact and channel
- [ ] Or create a new thread only when the existing one is definitively closed
- [ ] Insert inbound messages idempotently.
- [ ] Update `leads`, `conversations`, and `messages` consistently from the same mutation.
- [ ] Reopen closed conversations on new inbound activity where appropriate.
- [ ] Preserve raw provider payloads in metadata or raw payload fields for auditability.

### Outbound delivery from the inbox

- [ ] Refactor the current reply flow so a reply is not only recorded internally but actually sent via the provider.
- [ ] Decide the ordering model for outbound send:
- [ ] Provider send first, then persist success
- [ ] Or persist pending intent, then reconcile after send
- [ ] Record Twilio message SIDs in `messages.providerMessageId`.
- [ ] Record useful provider metadata such as delivery direction, sender, recipient, and provider status.
- [ ] Surface outbound failures clearly in the inbox instead of silently pretending delivery succeeded.
- [ ] Keep ownership and first-response timing behavior aligned with actual delivery, not just compose intent.
- [ ] Ensure the first successful human outbound message sets `firstResponseAt` when appropriate.

### 24-hour window and template rules

- [ ] Model whether a conversation is currently inside the customer service window.
- [ ] Allow free-form outbound replies only when the window is open.
- [ ] Block or reroute business-initiated sends outside the window to template sends.
- [ ] Add the first minimal template-send primitive for reopening or initiating contact outside the window.
- [ ] Decide where approved template identifiers live in configuration.
- [ ] Avoid building a full template management system before we need it.

### Onboarding and channel setup UX

- [ ] Add a WhatsApp setup step to onboarding.
- [ ] Capture sender status, display name, and registered number.
- [ ] Show whether the sender is sandbox, pending, or production-ready.
- [ ] Capture team routing defaults for WhatsApp leads.
- [ ] Capture handoff defaults and fallback owner behavior.
- [ ] Add a guided "send test message / receive test message" setup flow.
- [ ] Add opt-in guidance to onboarding so agencies understand what they are allowed to send.
- [ ] De-emphasize media/listing-heavy setup in the current Phase 0 onboarding flow.

### Inbox UX changes

- [ ] Show the channel as WhatsApp clearly in the conversation header and queue.
- [ ] Display normalized phone identity cleanly in the thread.
- [ ] Make unsupported inbound payloads legible instead of dropping them silently.
- [ ] Show outbound send state or failure feedback when a provider call fails.
- [ ] Distinguish internal notes from real WhatsApp outbound messages more clearly if needed.
- [ ] Add minimal thread affordances for template sends when the service window is closed.

### Opt-in and compliance

- [ ] Decide where opt-in evidence is stored for each contact or lead.
- [ ] Add a minimal field or metadata convention for recording opt-in source and timestamp.
- [ ] Decide how agents mark a contact as not eligible for outbound WhatsApp messaging.
- [ ] Ensure onboarding and docs explain explicit opt-in requirements.
- [ ] Keep enough operational evidence that Casedra can answer provider questions if message consent is challenged.

### Observability and rollout

- [ ] Instrument inbound webhook accepted counts.
- [ ] Instrument webhook rejection counts and rejection reasons.
- [ ] Instrument dedupe hits.
- [ ] Instrument outbound send success and failure counts.
- [ ] Instrument template send usage separately from free-form replies.
- [ ] Instrument per-agency channel health.
- [ ] Add a workflow-specific rollout gate so WhatsApp can be enabled agency by agency.
- [ ] Add internal logging that makes webhook debugging possible without spelunking raw provider payloads every time.

### Documentation and operations

- [ ] Document the first production onboarding path for a new sender.
- [ ] Document sandbox setup for local development.
- [ ] Document how to rotate Twilio credentials safely.
- [ ] Document the difference between sandbox, first production sender, and later multi-agency rollout.
- [ ] Document the future migration path to direct Meta if we decide to remove Twilio markup later.

### Manual verification before calling it live

- [ ] Verify inbound sandbox messages create contacts, leads, conversations, and messages correctly.
- [ ] Verify repeated inbound webhook deliveries dedupe correctly.
- [ ] Verify a closed thread reopens correctly on new inbound WhatsApp activity.
- [ ] Verify an inbox reply actually sends to WhatsApp and records provider identifiers.
- [ ] Verify ownership and first-response timing stay correct after real sends.
- [ ] Verify unsupported payloads fail safely and visibly.
- [ ] Verify behavior inside and outside the 24-hour window.
- [ ] Verify at least one end-to-end agency setup flow from sender registration to first live message.

## Sources

- Twilio WhatsApp pricing: https://www.twilio.com/en-us/whatsapp/pricing
- Twilio pricing overview: https://www.twilio.com/en-us/pricing/current-rates
- Twilio WhatsApp pricing change notice: https://help.twilio.com/articles/30304057900699-Notice-Changes-to-WhatsApp-s-Pricing-April-2025
- Twilio WhatsApp quickstart: https://www.twilio.com/docs/whatsapp/quickstart
- Twilio WhatsApp self sign-up: https://www.twilio.com/docs/whatsapp/self-sign-up
- Twilio WhatsApp overview and opt-in requirements: https://www.twilio.com/docs/sms/whatsapp/api
- Twilio WhatsApp product overview: https://www.twilio.com/docs/whatsapp
- Twilio ISV sender registration: https://www.twilio.com/docs/whatsapp/isv/register-senders
