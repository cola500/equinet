---
title: "Stripe-webhook-arkitektur (beslut)"
description: "Varför Stripe-webhooken verifieras provider-oberoende och routar både betalnings- och prenumerations-events via en endpoint."
category: architecture
status: active
last_updated: 2026-06-07
tags: [stripe, webhooks, payment, subscription, architecture, decision]
related:
  - docs/architecture/webhook-idempotency-pattern.md
  - docs/payment-domain-review.md
  - docs/retrospectives/2026-06-06-stripe-test-mode-retro.md
  - docs/retrospectives/2026-06-06-payment-hardening-wrapup.md
sections:
  - Beslut i en mening
  - Kontext
  - Problemet (rotorsak)
  - Beslut
  - Flöde
  - Konsekvenser
  - Relaterat
---

# Stripe-webhook-arkitektur (beslut)

> Beslut taget 2026-06-06 (PR #365) under betalnings-hardeningen. Dokumenterar **varför** webhooken ser ut som den gör — för **hur** idempotensen fungerar, se [webhook-idempotency-pattern.md](webhook-idempotency-pattern.md).

## Beslut i en mening

En enda endpoint (`POST /api/webhooks/stripe`) tar emot **både** betalnings- och prenumerations-events, och signaturen verifieras **alltid via Stripe SDK + `STRIPE_WEBHOOK_SECRET` — oberoende av `PAYMENT_PROVIDER`/`SUBSCRIPTION_PROVIDER`**.

## Kontext

Equinet har två frikopplade betalningsdomäner (se [payment-domain-review.md](../payment-domain-review.md)):

- **Payment** — kund betalar för en bokning (`payment_intent.*`).
- **Subscription** — leverantör prenumererar på plattformen (checkout/subscription-events).

Stripe levererar alla events till **en** webhook-endpoint. Vilken gateway-implementation appen kör (Mock vs Stripe) styrs av env (`PAYMENT_PROVIDER`, `SUBSCRIPTION_PROVIDER`) — bra för test/lokal utveckling.

## Problemet (rotorsak)

Tidigare verifierades **alla** webhooks via `getSubscriptionGateway()`. När `SUBSCRIPTION_PROVIDER ≠ "stripe"` returnerades `MockSubscriptionGateway`, som:

1. **inte** verifierade signaturen, och
2. returnerade `data: parsed.data` i stället för Stripe-eventets `data.object`.

Följd: `event.data.id` blev `undefined` → en betalning kunde **aldrig** bli `succeeded` via webhooken. Buggen var osynlig tills en riktig Stripe-test-mode-betalning kördes end-to-end. (Detaljer: [stripe-test-mode-retro.md](../retrospectives/2026-06-06-stripe-test-mode-retro.md).)

**Lärdom:** webhook-verifiering är en säkerhets- och korrekthetsgräns och får **inte** vara beroende av provider-konfiguration som finns för test-bekvämlighet.

## Beslut

1. **Provider-oberoende verifiering.** `verifyStripeWebhook()` (`src/domain/payment/StripeWebhookVerifier.ts`) använder alltid Stripe SDK + `STRIPE_WEBHOOK_SECRET`, oavsett `PAYMENT_PROVIDER`/`SUBSCRIPTION_PROVIDER`. Saknas secrets eller är signaturen ogiltig → `null` → routen svarar `400`.
2. **Normaliserat event.** Verifieraren returnerar ett `WebhookEvent` där `data` är Stripe-eventets `data.object` (t.ex. PaymentIntent för `payment_intent.succeeded`).
3. **En endpoint, två domäner.** Routen dispatchar på event-typ: `payment_intent.*` → `PaymentWebhookService`, övriga → `SubscriptionService`.
4. **Idempotens.** Atomisk dedup på event-ID innan processning; dedup-raden släpps vid processfel så Stripe kan retrya. Mekanismen beskrivs i [webhook-idempotency-pattern.md](webhook-idempotency-pattern.md).

## Flöde

```
POST /api/webhooks/stripe
  raw body + stripe-signature
  -> verifyStripeWebhook()                 provider-oberoende; ogiltig -> 400
  -> stripeWebhookEventRepository
       .tryRecordEvent(id, type)           atomisk insert-or-ignore; dubblett -> { received: true }
  -> route per event-typ:
       payment_intent.succeeded/payment_failed -> PaymentWebhookService
       (checkout/subscription.*)                -> SubscriptionService
  -> vid processfel: deleteEvent(id) + throw  -> 500, Stripe retryar
  -> { received: true }
```

## Konsekvenser

- **`SUBSCRIPTION_PROVIDER=stripe` krävs inte längre** för att betalnings-webhooks ska verifieras/processas. Webhook-verifieringen styrs enbart av `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
- Verifieringslogiken bor i payment-domänen (`StripeWebhookVerifier`) men används av båda domänernas events — medvetet, eftersom det är **Stripe-signaturen** (inte domänen) som verifieras.
- Två domäner delar en endpoint → dispatch-logiken måste hållas tydlig. Nya event-typer läggs till i route-dispatchen, inte i verifieraren.
- Test: `StripeWebhookVerifier.test.ts` + `PaymentWebhookService.test.ts` + route-integrationstester täcker verifiering, dedup och dispatch.

## Relaterat

- [webhook-idempotency-pattern.md](webhook-idempotency-pattern.md) — dedup-tabell + terminal-state-guards (återanvändbart mönster).
- [payment-domain-review.md](../payment-domain-review.md) — domängenomlysning (Use case #5).
- [gateway-abstraction-pattern.md](gateway-abstraction-pattern.md) — gateway-abstraktionen som verifieringen medvetet INTE går igenom.
- Retros 2026-06-06: [stripe-test-mode](../retrospectives/2026-06-06-stripe-test-mode-retro.md), [payment-hardening-wrapup](../retrospectives/2026-06-06-payment-hardening-wrapup.md).
</content>
