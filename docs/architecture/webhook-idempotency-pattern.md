---
title: "Webhook Idempotency -- återanvändbart pattern"
description: "Så hanterar vi at-least-once delivery från externa system (Stripe, Fortnox, ...). Dedup-tabell + terminal-state-guards."
category: architecture
status: active
last_updated: 2026-04-17
tags: [webhooks, idempotency, integration, stripe, pattern]
related:
  - docs/architecture/booking-flow.md
  - docs/operations/incident-runbook.md
sections:
  - När använda detta pattern
  - Problemet
  - Lösningen
  - Implementationssteg
  - Terminal-state-guards
  - Bevisad användning
  - När INTE använda
---

# Webhook Idempotency -- återanvändbart pattern

## När använda detta pattern

Använd detta pattern när ni integrerar med ett externt system som skickar webhooks med **at-least-once delivery**. Det inkluderar:

- Stripe (betalningar, prenumerationer)
- Fortnox (fakturering, framtida integration)
- GitHub (om vi någonsin får webhook-driven automation)
- Slack, Discord, Linear, Notion (om integreras)
- Alla SaaS som retryar failade webhooks

Pattern är UNIVERSELLT -- inte Stripe-specifikt. Kopiera strukturen, byt namn.

---

## Problemet

Externa system som skickar webhooks följer nästan alltid *at-least-once delivery*: de hellre skickar samma event flera gånger än att riskera att ni missar det. Det kan ske pga:

- Er server svarade långsamt (timeout hos avsändaren)
- Nätverket hickade till mellan avsändare och Vercel
- Vercel-funktionen kraschade precis efter processing men innan 200-svar

Konsekvensen utan skydd: webhook-handlern körs flera gånger. Även om själva databas-uppdateringen är idempotent (t.ex. `UPDATE booking SET status = 'paid'`), finns side effects som INTE är det:

- Bekräftelse-email skickas igen (kunden får 2 mail)
- Events triggas igen (downstream-services reagerar 2 ggr)
- Kvitton/fakturor genereras igen (dubblett i bokföringen)
- Analytics-events loggas igen (skev data)

Därför räcker det **inte** att göra databas-operationerna idempotenta. Vi behöver skydda HELA handler-körningen.

---

## Lösningen

**En dedup-tabell med UNIQUE constraint på event-ID + atomisk INSERT.**

```prisma
model StripeWebhookEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique  // <-- nyckeln (t.ex. "evt_1Abc2Def")
  eventType   String             // "payment_intent.succeeded"
  processedAt DateTime @default(now())

  @@index([processedAt])
}
```

**Logiken:**

```typescript
// 1. Försök INSERT -- databasens UNIQUE-constraint gör det atomiskt
const inserted = await prisma.stripeWebhookEvent.createMany({
  data: [{ eventId: event.id, eventType: event.type }],
  skipDuplicates: true,  // <-- om redan finns: skippa tyst
})

// 2. Om inget lades till = redan processat
if (inserted.count === 0) {
  logger.info("Duplicate webhook skipped", { eventId: event.id })
  return NextResponse.json({ received: true, duplicate: true })
}

// 3. Första gången -- processa eventet
await processEvent(event)
```

**Varför fungerar detta?**

Databasens `UNIQUE`-constraint är atomisk. Om 100 instanser av Vercel-funktionen försöker INSERT samma eventId samtidigt -- **bara en lyckas**. De andra får ett constraint violation error, och `skipDuplicates: true` översätter det till "0 rows inserted".

Det är inte kod-logik som skyddar (race condition-risk). Det är databasens garantier.

---

## Implementationssteg

1. **Skapa dedup-tabell** med `eventId String @unique` + eventType + processedAt.
2. **Lägg INSERT som första steg** i webhook-handlern (innan signaturverifiering är redan gjord).
3. **Om `count === 0`**: returnera `{ received: true, duplicate: true }` och gör INGET annat.
4. **Logga duplikater med `logger.info`** (inte `warn`) -- de är normala, inte fel.
5. **Index på `processedAt`** så ni senare kan rensa gamla events (t.ex. >90 dagar).

**OBS om signatur-verifiering:** Verifiera avsändarens signatur FÖRE dedup-check. Ni vill inte lagra falska events i dedup-tabellen.

---

## Terminal-state-guards (belt-and-suspenders)

Dedup-tabellen skyddar mot 99% av retry-fallen. Men det finns ett fönster där den kan missa:

- Webhook tas emot, processas, databas uppdateras
- Servern kraschar **precis före** INSERT i dedup-tabellen
- Avsändaren retryar, samma event kommer igen
- Dedup-tabellen vet inget, koden processar igen

För state machines (Booking.status, Subscription.status) är lösningen **terminal-state-guards**: operationen vägrar om entiteten redan är i ett slutläge.

```typescript
// I domain service, innan state-change:
const TERMINAL_STATES = new Set(['canceled', 'expired', 'refunded'])

if (TERMINAL_STATES.has(existing.status)) {
  logger.info("Skipping update to terminal state", {
    id: existing.id,
    current: existing.status,
    attempted: newStatus,
  })
  return  // tyst skippa
}
```

Det räddar er från "gammalt event anländer sent". Exempel: en kund cancelar en prenumeration, status sätts till `canceled`. Tio minuter senare levereras ett försenat `subscription.updated` med `status: active`. Utan guard skulle prenumerationen zombifieras. Med guard: ingenting händer.

**Referens i koden:** `src/domain/subscription/SubscriptionService.ts` har detta mönster.

---

## Bevisad användning

| Integration | Dedup-tabell | Terminal-state-guards | Status |
|-------------|--------------|----------------------|--------|
| Stripe Payments | `StripeWebhookEvent` | `PaymentWebhookService.guardNotInStatus` | Live |
| Stripe Subscriptions | `StripeWebhookEvent` (samma tabell) | `SubscriptionService` TERMINAL_STATES | Live |
| Fortnox | -- | -- | Planerad (backlog) |
| Apple Pay / App Store | -- | -- | Ej relevant |

**Framtida integrationer** ska ha:
1. Egen dedup-tabell med UNIQUE på avsändarens event-ID (t.ex. `FortnoxWebhookEvent`)
2. Terminal-state-guards på state machines (om applicerbart)
3. Signaturverifiering FÖRE dedup-check

---

## När INTE använda

- **Egna interna anrop** -- om ni kontrollerar både avsändare och mottagare, använd request-IDs eller transaktioner istället.
- **Fire-and-forget utan state** -- om operationen är ren läsning eller skickar en notifikation utan bestående state, är en enkel email-dedup-check enklare.
- **Kritiska finansiella operationer** -- för riktiga pengar, lägg till audit-logg + human-in-the-loop review utöver dedup.

---

## Sammanfattning i en mening

**Externa system retryar -- skydda er hela handler, inte bara databasen, med en UNIQUE-constraint på avsändarens event-ID plus terminal-state-guards på statemachines.**
