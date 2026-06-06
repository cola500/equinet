---
title: Betalnings-spåret — sammanfattning (2026-06)
description: Kort översikt av hela betalnings-hardeningen — från grön mock-E2E till verifierad och städad Stripe test-mode på staging. Faser, PR:er, verifiering, lärdomar och öppna trådar med länkar.
category: operations
status: active
last_updated: 2026-06-06
tags: [payment, stripe, e2e, hardening, summary, index]
related:
  - docs/operations/provider-e2e-payment-readiness-2026-06.md
  - docs/operations/provider-e2e-payment-runbook-2026-06.md
  - docs/architecture/spike-stripe-checkout-sessions.md
  - docs/retrospectives/2026-06-06-payment-hardening-wrapup.md
sections:
  - Resa
  - Faser
  - PR-leverans
  - Config
  - Verifiering
  - Lärdomar
  - Dokumentation
  - Öppna trådar
  - Status
---

# Betalnings-spåret — sammanfattning (2026-06)

## Resa

Från grön **mock-E2E** → verifierad, demo-redo och arkitektoniskt städad **Stripe test-mode** på staging. Inget gick live; allt på `staging`, inget rör prod/main.

## Faser

1. **Readiness + mock-config** — kartlade flödet, satte staging till mock-gateway, bevisade hela värdekedjan E2E (kund bokar → leverantör accepterar → genomför → betalar → kvitto).
2. **Stripe test-mode** — aktiverade riktig Stripe (test-nycklar, webhook, flagga). Det avslöjade **fem dolda buggar** som mock-läget maskerat.
3. **Hardening + cleanup** — gjorde den temporära config-workarounden till en riktig arkitektur-fix, städade och dokumenterade.

## PR-leverans

| PR | Fix | Typ |
|----|-----|-----|
| #361 | `@stripe/stripe-js/pure` — Stripe.js laddas inte eagerly | bugfix |
| #362 | Service Worker NetworkOnly-passthrough för Stripe | bugfix |
| #363 | CSP `connect-src` += `js.stripe.com` | bugfix |
| #364 | Betalningsdialog scrollbar (Betala-knappen nåbar) | UX-fix |
| #365 | Webhook-verifiering frikopplad från `SUBSCRIPTION_PROVIDER` (`verifyStripeWebhook`) | hardening |
| #366 | Spike-notering: Checkout Sessions | docs |

## Config

`PAYMENT_PROVIDER=stripe`, `STRIPE_WEBHOOK_SECRET` (satt), `stripe_payments=true`, webhook registrerad i Stripe test-sandbox. Temporär `SUBSCRIPTION_PROVIDER=stripe`-workaround **borttagen** efter #365 och bevisad onödig.

## Verifiering

Full E2E med riktigt testkort `4242` på städad config: Elements → `confirmPayment` → `payment_intent.succeeded`-webhook → `Payment.status=succeeded` (~3s) → kvitto (HTTP 200). Plus:
- 24 webhook- + 92 payment/subscription-tester gröna.
- Webhook-smoke: ogiltig signatur → 400.
- Säkerhets-gate: ownership/IDOR, server-side amount, idempotens (Payment-rad + webhook-dedup), signaturverifiering.

## Lärdomar

- **En workaround är skuld, inte lösning** — band-aid (`SUBSCRIPTION_PROVIDER=stripe`) → root-fix → borttagen workaround → bevisad onödig.
- **Mock-först bevisar produkten, inte integrationen** — verifiera den riktiga gatewayen separat.
- **Hård browser-data slår resonemang** — CSP-felet i konsolen var genombrottet; rotorsak misattribuerades två gånger innan dess.
- **Cross-origin + Service Worker + CSP är ett trippelt minfält** — `<script src>` styrs av `script-src`, men SW:ns re-fetch styrs av `connect-src`.

## Dokumentation

- Readiness: [provider-e2e-payment-readiness-2026-06.md](provider-e2e-payment-readiness-2026-06.md)
- Runbook: [provider-e2e-payment-runbook-2026-06.md](provider-e2e-payment-runbook-2026-06.md)
- E2E-körningar: `docs/operations/e2e-runs/provider-payment-2026-06-06-*`
- Retros: [mock-track](../retrospectives/2026-06-06-payment-track-retro.md), [5-lager test-mode](../retrospectives/2026-06-06-stripe-test-mode-retro.md), [wrap-up](../retrospectives/2026-06-06-payment-hardening-wrapup.md)
- Spike: [Checkout Sessions](../architecture/spike-stripe-checkout-sessions.md)

## Öppna trådar

Se backlog-sektionerna **Production Readiness** och **Platform Hardening** i [status.md](../sprints/status.md): Checkout Sessions-spike, idempotency keys, restricted keys, 3DS, SW-update-strategi, payment security review, production monitoring.

## Status

Betalflödet är **tekniskt grönt och demo-redo i test-mode på staging**. Återstår före live: de öppna trådarna ovan.
