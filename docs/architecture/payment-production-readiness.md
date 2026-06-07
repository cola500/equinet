---
title: "Betalningar -- production readiness (go-live-gate)"
description: "Konsoliderad checklista för vad som krävs innan Equinet tar emot riktiga betalningar. Test-mode är verifierat; live-mode är gated."
category: architecture
status: active
last_updated: 2026-06-07
tags: [payment, stripe, production-readiness, go-live, checklist]
related:
  - docs/architecture/stripe-webhook-architecture.md
  - docs/architecture/webhook-idempotency-pattern.md
  - docs/architecture/spike-stripe-checkout-sessions.md
  - docs/payment-domain-review.md
  - docs/retrospectives/2026-06-06-payment-hardening-wrapup.md
  - NFR.md
sections:
  - Syfte
  - Nuläge
  - Klart (verifierat)
  - Pre-live-checklista
  - Hårda blockerare
  - Beslutsregel (gate)
  - Relaterat
---

# Betalningar -- production readiness (go-live-gate)

> **Syfte:** ett ställe som svarar på "är vi redo att ta emot riktiga pengar?". Konsoliderar de öppna trådarna från betalnings-hardeningen (2026-06-06) till en gate. **Detta dokument spårar inte arbete** — det är beslutskriterierna. Själva items spåras i [backlog.md](../sprints/backlog.md) under "Live-betalningar (Production Readiness)" + "Plattformshärdning".

## Nuläge

- **Test-mode: verifierat end-to-end** på staging (riktigt testkort `4242`): Elements → `confirmPayment` → `payment_intent.succeeded`-webhook → `Payment.status=succeeded` → kvitto. Se [wrap-up-retro](../retrospectives/2026-06-06-payment-hardening-wrapup.md).
- **Live-mode: gated.** Enda hårda blockern är **Stripe företagsverifiering** (config, inte kod) — se [Hårda blockerare](#hårda-blockerare). Innan live ska checklistan nedan vara grön.

## Klart (verifierat)

| Klart | Bevis |
|-------|-------|
| Betalningskedjan i test-mode (Elements → webhook → status → kvitto) | E2E på staging, 2026-06-06 |
| Provider-oberoende webhook-verifiering | [stripe-webhook-architecture.md](stripe-webhook-architecture.md) (`StripeWebhookVerifier`) |
| Webhook-idempotens (dedup + retry-on-error) | [webhook-idempotency-pattern.md](webhook-idempotency-pattern.md) (`stripeWebhookEventRepository`) |
| Säkerhets-gate på betalflödet (ownership, server-side amount, signatur) | Kodgranskning före grönmarkering, 2026-06-06 |
| Stripe.js/SW/CSP-fixar (Betala nåbar i test) | PR #361–364 |

## Pre-live-checklista

> Status: ⬜ = återstår. Varje rad länkar till backlog-item.

### Stripe-konfiguration & nycklar
- ⬜ **Webhook registrerad i prod-kontot** med korrekt `STRIPE_WEBHOOK_SECRET` (prod).
- ⬜ **Restricted key (`rk_`)** med least-privilege per miljö, i stället för `sk_` (Stripe best practice).
- ⬜ **`check-prod-env` non-empty-guard** för Stripe-vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) — tom string ska faila build.

### Kodhärdning
- ⬜ **Idempotency key på `StripePaymentGateway.initiatePayment`** — i dag skapar varje Betala-klick en ny PaymentIntent (övergivna PIs).
- ⬜ **3DS-stöd:** `frame-src https://hooks.stripe.com` i CSP + testa SCA-kort (testkortet `4242` är non-3DS; riktiga EU-kort triggar ofta 3DS).

### Plattformshärdning
- ⬜ **Service Worker update-strategi** — användare fastnade på gammal SW efter deploy (risk att fixar inte når användare).
- ⬜ **Production monitoring/alerting** för betalningar (failed payments, webhook-fel, dedup-anomalier).
- ⬜ **Formell payment security review** (oberoende, pre-live) — IDOR, server-side amount, webhook-signatur, ownership, idempotens.

### Verifiering & beslut
- ⬜ **Checkout Sessions-spike** utvärderad — välj `ui_mode=elements` vs nuvarande direkt-PaymentIntents *innan* live. Se [spike](spike-stripe-checkout-sessions.md).
- ⬜ **Live-mode E2E** med riktigt (men eget) kort efter att blockern lösts.

## Hårda blockerare

| Blocker | Ägare | Påverkar |
|---------|-------|----------|
| Stripe företagsverifiering | Stripe / Johan | Live-mode, Swish |

(Apple Developer + Vercel Pro är blockerare för andra spår, inte för betalningar — se [backlog.md](../sprints/backlog.md).)

## Beslutsregel (gate)

**Gå INTE live förrän:** den hårda blockern är löst **och** hela pre-live-checklistan är grön **och** en live-mode-E2E har körts framgångsrikt. Test-mode-grönt räcker inte — mock/test maskerar live-specifika lager (lärdom från 2026-06-06: mock dolde fem buggar).

## Relaterat

- [payment-domain-review.md](../payment-domain-review.md) — domängenomlysning.
- [stripe-webhook-architecture.md](stripe-webhook-architecture.md) — webhook-beslutet.
- [webhook-idempotency-pattern.md](webhook-idempotency-pattern.md) — dedup-mönstret.
- [spike-stripe-checkout-sessions.md](spike-stripe-checkout-sessions.md) — framtida designval.
- Retros 2026-06-06: [wrap-up](../retrospectives/2026-06-06-payment-hardening-wrapup.md), [stripe-test-mode](../retrospectives/2026-06-06-stripe-test-mode-retro.md).
- [NFR.md](../../NFR.md) NFR-01.
</content>
