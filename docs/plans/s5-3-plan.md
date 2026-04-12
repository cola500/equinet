---
title: "S5-3: Stripe webhook-route for payments"
description: "Utoka webhook-routen att hantera payment_intent events"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Approach
  - Filer
  - Risker
---

# S5-3: Stripe webhook-route for payments

## Bakgrund

Webhook-route (`/api/webhooks/stripe`) finns redan och hanterar subscription-events.
Den använder `SubscriptionGateway.verifyWebhookSignature()` for signaturverifiering.
Vi behover utoka routen att ocksa hantera `payment_intent.succeeded` och
`payment_intent.payment_failed` genom att delegera till en ny `PaymentWebhookService`.

## Approach

### Fas 1: RED -- Tester forst

1. Skapa `PaymentWebhookService.test.ts`:
   - `handlePaymentIntentSucceeded`: uppdaterar Payment-status till "succeeded"
   - `handlePaymentIntentFailed`: uppdaterar Payment-status till "failed"
   - Returnerar tidigt om Payment inte hittas (bookingId fran metadata)
   - Genererar invoiceNumber vid succeeded

2. Uppdatera webhook route-test:
   - `payment_intent.succeeded` delegerar till PaymentWebhookService
   - `payment_intent.payment_failed` delegerar till PaymentWebhookService
   - Subscription-events fungerar som forut

### Fas 2: GREEN -- Implementation

1. Skapa `PaymentWebhookService` i `src/domain/payment/`:
   - `handlePaymentIntentSucceeded(paymentIntentId, metadata)`:
     Hittar Payment via `providerPaymentId`, uppdaterar status/paidAt/invoiceNumber
   - `handlePaymentIntentFailed(paymentIntentId, metadata)`:
     Hittar Payment, uppdaterar status till "failed"

2. Uppdatera webhook-route:
   - Routar `payment_intent.*` events till PaymentWebhookService
   - Routar subscription-events till SubscriptionService (som forut)
   - Loggar okanda event-typer (info, inte error)

### Fas 3: REFACTOR + VERIFY

## Filer

| Fil | Ändring |
|-----|---------|
| `src/domain/payment/PaymentWebhookService.ts` | NY -- webhook event handler |
| `src/domain/payment/PaymentWebhookService.test.ts` | NY -- tester |
| `src/app/api/webhooks/stripe/route.ts` | Utoka med payment event routing |
| `src/app/api/webhooks/stripe/route.test.ts` | Nya tester for payment events |
| `src/domain/payment/index.ts` | Exportera PaymentWebhookService |

## Risker

- **Delad signaturverifiering**: Subscription-gateway ager signaturverifieringen.
  Payment-events använder samma webhook-secret. Ingen ny verifiering behovs.
- **Race condition**: PaymentIntent kan confirma innan Payment-raden skapats.
  Hantera: om Payment inte hittas, logga warning och returnera 200 (Stripe retryar).
