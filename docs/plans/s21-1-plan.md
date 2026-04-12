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
// Atomisk insert-or-ignore via createMany + skipDuplicates
const result = await prisma.stripeWebhookEvent.createMany({
  data: [{ eventId: event.id, eventType: event.type }],
  skipDuplicates: true,
})
if (result.count === 0) {
  // Event redan bearbetat (av annan request eller retry)
  logger.info("Duplicate Stripe event skipped", { eventId: event.id })
  return NextResponse.json({ received: true })
}
// Forsta requesten -- fortsatt till dispatch
```

**Varfor `createMany` + `skipDuplicates`**: Atomisk INSERT ON CONFLICT DO NOTHING i PostgreSQL. Inget TOCTOU-fonster, inget try/catch for kontrollflode. `count === 0` = duplicat, `count === 1` = ny event.

**Failure-hantering**: Om processing kastar EFTER dedup-insert, returneras 500 -> Stripe retriar -> dedup blockar retry -> permanent event-forlust. Lösning: wrappa dispatch i try/catch, radera dedup-raden vid failure sa retry fungerar:

```typescript
try {
  await dispatch(event)
} catch (error) {
  // Radera dedup sa Stripe kan retria
  await prisma.stripeWebhookEvent.deleteMany({ where: { eventId: event.id } })
  throw error // 500 -> Stripe retriar
}
```

### 3. Terminal-state-guards i SubscriptionService

Lagg till guards i `handleSubscriptionUpdated`, `handleInvoicePaid` och `handleCheckoutCompleted`:

```typescript
const TERMINAL_STATES = new Set(["canceled", "incomplete_expired"])
```

- `handleSubscriptionUpdated`: Om nuvarande status ar i `TERMINAL_STATES`, avvisa uppdatering.
- `handleSubscriptionDeleted`: Redan implicit OK (satter canceled).
- `handleInvoicePaid`: Om nuvarande status ar i `TERMINAL_STATES`, avvisa (forhindra att canceled/incomplete_expired -> active).
- `handleCheckoutCompleted`: Medvetet undantag -- ny checkout TILLATS skapa/ateraktivera (Stripe skapar ny subscription vid ny checkout).

### 4. Injicera Prisma-access i routen

Routen använder redan `prisma` indirekt via factories. For dedup-tabellen kan vi använde Prisma direkt i routen (det ar infra, inte domanlogik) via en tunn helper:
- `src/infrastructure/persistence/stripe/stripeWebhookEventRepository.ts` med `isProcessed(eventId)` + `markProcessed(eventId, eventType)`.

## Filer som andras/skapas

| Fil | Ändring |
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
2. Test: "handleSubscriptionUpdated skips update when status is incomplete_expired" -> FAIL
3. Test: "handleInvoicePaid skips update when status is canceled" -> FAIL
4. Test: "handleCheckoutCompleted allows reactivation of canceled subscription" -> FAIL (om inte redan green)

### Fas 2: GREEN -- SubscriptionService guards
5. Implementera TERMINAL_STATES Set + guards, tester grona

### Fas 3: RED -- Webhook route dedup
6. Test: "returns 200 and skips processing for duplicate event" -> FAIL
7. Test: "processes new event and records it" -> FAIL
8. Test: "deletes dedup record and returns 500 on processing failure" -> FAIL

### Fas 4: GREEN -- Route dedup
9. Skapa Prisma-modell + migration
10. Skapa stripeWebhookEventRepository (createMany skipDuplicates + delete)
11. Uppdatera route med dedup-logik + failure-rollback

### Fas 5: REFACTOR + verify
12. `npm run check:all`

## Risker

- **Migration**: Ny tabell, ingen datamigration -- lag risk.
- **Race condition**: `createMany` + `skipDuplicates` = atomisk INSERT ON CONFLICT DO NOTHING. Inget TOCTOU-fonster.
- **Processing failure**: Dedup-raden raderas vid failure sa Stripe kan retria.
- **Tabellstorlek**: `processedAt`-index mojliggor framtida cleanup-cron. Inte i scope for denna story.
