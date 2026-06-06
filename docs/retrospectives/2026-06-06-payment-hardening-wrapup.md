---
title: Retro — Betalnings-hardening-spåret (wrap-up)
description: Avslutande retro för hela betalnings-hardeningen 2026-06-06 — från grön mock-E2E till verifierad Stripe test-mode, fem fixade lager, arkitektur-decoupling, config-cleanup och Checkout Sessions-spike. Tre delretros sammanfattade.
category: retro
status: active
last_updated: 2026-06-06
tags: [payment, stripe, hardening, e2e, webhook, csp, service-worker, wrapup]
related:
  - docs/retrospectives/2026-06-06-payment-track-retro.md
  - docs/retrospectives/2026-06-06-stripe-test-mode-retro.md
  - docs/architecture/spike-stripe-checkout-sessions.md
sections:
  - Mål och omfattning
  - Hela leveransen
  - Vad gick bra
  - Vad gick mindre bra
  - Lärdomar
  - Öppna trådar
---

# Retro — Betalnings-hardening-spåret (wrap-up), 2026-06-06

## Mål och omfattning

Ta betalflödet från "grön mock-E2E" till **verifierat, demo-redo och arkitektoniskt hållbart** Stripe test-mode på staging — och åtgärda allt som mock-läget dolt, utan att gå live.

Detta är en wrap-up. Två delretros täcker detaljerna:
- [payment-track-retro](2026-06-06-payment-track-retro.md) — mock-spåret, beslutet mock-först.
- [stripe-test-mode-retro](2026-06-06-stripe-test-mode-retro.md) — de fem lagren av rotorsaker, skrivet mitt i spåret.

Denna wrap-up fokuserar på **helheten** och på **följdarbetet** efter test-mode-retron (decoupling, cleanup, spike) som den inte täckte.

## Hela leveransen

| Leverans | PR / åtgärd | Typ |
|----------|-------------|-----|
| Stripe.js laddas inte eagerly i mock | #361 (`/pure`) | bugfix |
| SW intercepterade js.stripe.com | #362 (NetworkOnly-passthrough) | bugfix |
| CSP `connect-src` saknade js.stripe.com | #363 | bugfix |
| Betalningsdialog ej scrollbar (Betala onåbar) | #364 | UX-fix |
| Webhook-verifiering kopplad till `SUBSCRIPTION_PROVIDER` | #365 (`verifyStripeWebhook`) | hardening/refactor |
| Stripe test-mode-config (test-nycklar, webhook, flagga) | config (REST API) | config |
| `SUBSCRIPTION_PROVIDER`-workaround borttagen | config-cleanup | config |
| Checkout Sessions-utvärdering | #366 (spike-notering) | docs |

**Verifierat end-to-end** (riktigt testkort `4242`, städad config): Elements → `confirmPayment` → `payment_intent.succeeded`-webhook → `Payment.status=succeeded` (~3s) → kvitto. Plus webhook-smoke (ogiltig signatur → 400) och 24 + 92 gröna enhets-/integrationstester.

## Vad gick bra

- **Vi stannade inte vid workarounden.** `SUBSCRIPTION_PROVIDER=stripe` fick test-mode att fungera, men vi behandlade det som en *temporär* lösning, gjorde den riktiga arkitektur-fixen (#365), tog bort workarounden och **bevisade** att den var onödig med en ren E2E. Band-aid → root fix → verifierad cleanup.
- **En PR per concern.** Sex separata, små PR:er (1 fil/minimal diff vardera) istället för en stor "fixa Stripe"-PR. Varje fix kunde verifieras, deployas och rullas tillbaka isolerat.
- **Säkerhets-gate före grönmarkering.** Betalflödet kodgranskades (ownership, server-side amount, idempotens, webhook-signatur) *innan* E2E räknades som klar.
- **Disciplinerad verifiering hela vägen ut.** Varje fix verifierades i runtime, inte bara i kod — inklusive den definitiva "succeeded utan workaround"-körningen.
- **Spike dokumenterad istället för glömd.** Checkout Sessions-rekommendationen blev en backlog-notering med konkreta frågor, inte en muntlig "vi borde nog".

## Vad gick mindre bra

- **Rotorsak misattribuerad två gånger** (se test-mode-retro): "Playwright-nätverket" (var SW), sedan "miljön" (var CSP). Mönstret: jag lät ett rimligt men ofullständigt resonemang bli slutsats istället för att mäta.
- **Lagrad maskering kostade många iterationer.** Mock dolde fem buggar; varje fix avslöjade nästa. Det gick inte att se hela kedjan i förväg — men tidigare runtime-verifiering av den *riktiga* vägen hade kortat loopen.
- **Verktygsfriktion återkom.** Vercel CLI tomma env-writes, deploy-poll-script som extraherade tom URL, Stripe MCP utan webhook-stöd, trasig Stripe CLI, seg SW-uppdatering. Mycket tid på infrastruktur snarare än på själva fixen.
- **Många övergivna test-PaymentIntents** skapades (varje Betala-klick → ny PI via upsert). Ofarligt i sandbox, men `initiatePayment` saknar idempotency key.

## Lärdomar

- **En workaround är en skuld, inte en lösning.** Logga den, gör root-fixen, och *ta bort* workarounden med bevis. Vi gjorde det här — gör det till norm.
- **Mock-först bevisar produkten, inte integrationen.** När en mock finns: verifiera den riktiga gatewayen separat innan "klar". Annars maskeras hela integrationskedjor.
- **Runtime-verifiering och hård data slår resonemang.** Genombrottet var Johans inklistrade konsol-fel (CSP `connect-src`). Be om browser-data tidigt; mät DOM/network/console.
- **Cross-origin + Service Worker + CSP är ett trippelt minfält.** `<script src>` styrs av `script-src`, men SW:ns re-fetch av samma resurs styrs av `connect-src`.
- **Frikoppla verifiering från orelaterad config.** Payment-webhooks ska aldrig bero på `SUBSCRIPTION_PROVIDER` — generellt: en mekanism (signaturverifiering) ska inte styras av en orelaterad provider-flagga.

## Öppna trådar (backlog / watch)

- **Spike:** [Checkout Sessions med Payment Element](../architecture/spike-stripe-checkout-sessions.md) — utvärdera före live-betalningar.
- **Watch:** SW-update-strategi (användare fastnade på gammal SW efter deploy).
- **Watch:** `frame-src` saknar `hooks.stripe.com` → behövs för 3DS-kort (ej `4242`) före live.
- **Watch:** idempotency key på `StripePaymentGateway.initiatePayment` (övergivna PIs).
- **Återstår före live:** byt till restricted key (`rk_`) per Stripe best practice; verifiera `check-prod-env` non-empty-guard för Stripe-vars; webhook i prod-konto.
