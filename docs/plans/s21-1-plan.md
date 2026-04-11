---
title: "S21-1: Stripe webhook idempotens"
description: "Event-ID dedup-tabell + terminal-state-guards i SubscriptionService"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Bakgrund
  - Approach
  - Filer som andras
  - TDD-plan
  - Risker
---

# S21-1: Stripe webhook idempotens (event-ID dedup)

## Bakgrund

Stripe kan skicka samma event flera ganger vid retry. Nuvarande skydd:
- **PaymentWebhookService**: Har terminal-state pre-check + atomisk WHERE-guard. Bra.
- **SubscriptionService**: Har INGET replay-skydd. `handleSubscriptionUpdated` kan skriva tillbaka en `canceled` subscription till `active` vid out-of-order delivery.
- **Route-niva**: Inget event-ID sparas -- ingen global dedup.

## Approach

### 1. StripeWebhookEvent Prisma-modell (dedup-tabell)

```prisma
model StripeWebhookEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique        // Stripe event ID (evt_xxx)
  eventType   String                  // t.ex. "payment_intent.succeeded"
  processedAt DateTime @default(now())

  @@index([processedAt])              // for framtida cleanup
}
```

### 2. Dedup i webhook-routen (route-niva)

I `route.ts`, EFTER signatur-verifiering, FORE dispatch:

```typescript
const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({
  where: { eventId: event.id }
})
if (alreadyProcessed) {
  logger.info("Duplicate Stripe event skipped", { eventId: event.id })
  return NextResponse.json({ received: true }) // 200 sa Stripe slutar retria
}
await prisma.stripeWebhookEvent.create({
  data: { eventId: event.id, eventType: event.type }
})
```

Race condition: tva samtida requests kan passera `findUnique` samtidigt. `create` med UNIQUE constraint kastar -- fanga med try/catch, returnera 200.

### 3. Terminal-state-guards i SubscriptionService

Lagg till guards i `handleSubscriptionUpdated` och `handleInvoicePaid`:

- `handleSubscriptionUpdated`: Om nuvarande status ar `canceled`, avvisa uppdatering (canceled ar terminal).
- `handleSubscriptionDeleted`: Redan implicit OK (satter canceled).
- `handleInvoicePaid`: Om nuvarande status ar `canceled`, avvisa (forhindra att canceled -> active).

Terminal states for subscription: `canceled`.

### 4. Injicera Prisma-access i routen

Routen anvander redan `prisma` indirekt via factories. For dedup-tabellen kan vi anvanda Prisma direkt i routen (det ar infra, inte domanlogik) via en tunn helper:
- `src/infrastructure/persistence/stripe/stripeWebhookEventRepository.ts` med `isProcessed(eventId)` + `markProcessed(eventId, eventType)`.

## Filer som andras/skapas

| Fil | Andring |
|-----|---------|
| `prisma/schema.prisma` | Ny modell `StripeWebhookEvent` |
| `src/infrastructure/persistence/stripe/stripeWebhookEventRepository.ts` | NY: isProcessed + markProcessed |
| `src/app/api/webhooks/stripe/route.ts` | Dedup fore dispatch |
| `src/domain/subscription/SubscriptionService.ts` | Terminal-state-guards |
| `src/app/api/webhooks/stripe/route.test.ts` | Tester for dedup |
| `src/app/api/webhooks/stripe/route.integration.test.ts` | Integrationstester for dedup |
| `src/domain/subscription/SubscriptionService.test.ts` | Tester for terminal-state |
| Migration: `YYYYMMDD_stripe_webhook_event` | Ny tabell |

## TDD-plan

### Fas 1: RED -- SubscriptionService terminal-state-guards
1. Test: "handleSubscriptionUpdated skips update when status is canceled" -> FAIL
2. Test: "handleInvoicePaid skips update when status is canceled" -> FAIL

### Fas 2: GREEN -- SubscriptionService guards
3. Implementera guards, tester grona

### Fas 3: RED -- Webhook route dedup
4. Test: "returns 200 and skips processing for duplicate event" -> FAIL
5. Test: "processes new event and records it" -> FAIL
6. Test: "handles race condition (concurrent duplicate)" -> FAIL

### Fas 4: GREEN -- Route dedup
7. Skapa Prisma-modell + migration
8. Skapa stripeWebhookEventRepository
9. Uppdatera route med dedup-logik

### Fas 5: REFACTOR + verify
10. `npm run check:all`

## Risker

- **Migration**: Ny tabell, ingen datamigration -- lag risk.
- **Race condition**: UNIQUE constraint + try/catch hanterar detta.
- **Tabellstorlek**: `processedAt`-index mojliggor framtida cleanup-cron. Inte i scope for denna story.
