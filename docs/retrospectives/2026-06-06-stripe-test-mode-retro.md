---
title: Retro — Stripe test-mode-spåret
description: Retrospektiv för arbetet att aktivera och verifiera riktig Stripe test-mode på staging (efter grön mock-E2E) — fem lager av rotorsaker, verktygsfriktion och lärdomar om runtime-verifiering.
category: retro
status: active
last_updated: 2026-06-06
tags: [stripe, payment, e2e, service-worker, csp, webhook, staging, debugging]
related:
  - docs/retrospectives/2026-06-06-payment-track-retro.md
  - docs/operations/provider-e2e-payment-readiness-2026-06.md
sections:
  - Mål
  - Vad vi gjorde
  - Fem lager av rotorsaker
  - Vad gick bra
  - Vad gick mindre bra
  - Lärdomar
  - Uppföljning
---

# Retro — Stripe test-mode-spåret, 2026-06-06

## Mål

Efter att mock-gateway-E2E var grön: aktivera och verifiera **riktig Stripe test-mode** på staging end-to-end (kort `4242` → PaymentIntent → webhook → `Payment.status=succeeded` → kvitto), utan live-betalningar.

## Vad vi gjorde

Readiness-spike → config (test-nycklar, webhook, flagga) → Playwright-E2E. Det som såg ut som ett konfig-steg blev en kedja av fem rotorsaker, där varje fix avslöjade nästa. Slutresultat: fullt grönt flöde + en UX-fix, men efter betydligt fler iterationer än väntat.

## Fem lager av rotorsaker

Betalflödet var trasigt i **fem** oberoende lager. Mock-E2E:n hade dolt alla fem (mock laddar aldrig Stripe.js, öppnar aldrig Elements, kallar aldrig webhooken på riktigt).

| # | Symptom | Rotorsak | Fix |
|---|---------|----------|-----|
| 1 | js.stripe.com laddades på varje `/customer/bookings` | `loadStripe()` på modulnivå (import-side-effect) | `@stripe/stripe-js/pure` (#361) |
| 2 | js.stripe.com → "no-response" | Service Worker intercepterade cross-origin `.js` via `defaultCache` (CacheFirst) | SW NetworkOnly-passthrough (#362) |
| 3 | js.stripe.com → "Refused to connect" | CSP `connect-src` saknade `js.stripe.com` (SW:ns re-fetch styrs av connect-src) | CSP-rad (#363) |
| 4 | PI `succeeded` hos Stripe men DB `pending` | Webhook-routen verifierar via `getSubscriptionGateway()` → mock i mock-läge → fel `data`-form | `SUBSCRIPTION_PROVIDER=stripe` (config) |
| 5 | Betala-knappen ej synlig/klickbar | PaymentDialog saknade max-height/overflow → Elements-formuläret sprängde viewporten | `max-h-[90vh] overflow-y-auto` (#364) |

## Vad gick bra

- **Inkrementell slicing höll.** Varje lager blev en egen liten PR (1 fil, minimal diff) med typecheck/lint/build innan deploy. Lätt att rulla tillbaka, lätt att resonera om.
- **Hård data från användarens browser var genombrottet.** Lager 3 (CSP) löstes först när Johan klistrade in konsol-felet "Refused to connect ... connect-src". Direkt-tabbtestet ("ladda js.stripe.com i ny flik" → fungerade) avgränsade nätverk vs app definitivt.
- **Säkerhets-gate före grönmarkering.** Kodgranskningen av betalflödet (ownership, amount server-side, idempotens, webhook-signatur) kördes innan E2E räknades som klar — fångade att flödet i sig var säkert även när det var trasigt.
- **Stripe-pluginen användes rätt.** Stripe MCP bekräftade test-sandbox-kontot och att PI:n verkligen blev `succeeded` hos Stripe — vilket isolerade problemet till webhook→DB (lager 4).

## Vad gick mindre bra

- **Jag misattribuerade rotorsak två gånger.** Sa först "Playwright-nätverket blockerar js.stripe.com" (var SW), sedan "js.stripe.com onåbart i miljön" (var CSP connect-src). Båda gångerna lät jag ett rimligt men ofullständigt resonemang stå som slutsats.
- **Lagrad maskering kostade tid.** `/pure`-fixen tog bort js.stripe.com-laddningen i mock — vilket dolde SW-buggen tills test-mode exponerade den igen. Varje fix "fungerade" lokalt men avslöjade nästa lager först i runtime.
- **Verktygsfriktion.** Vercel CLI skrev tomma env-värden (även via stdin) → krävde REST API. Stripe MCP saknar webhook-operationer. Stripe CLI gick inte att få igång. Deploy-poll-script extraherade tom URL två gånger.
- **Service Worker-uppdatering är seg.** Användarens browser satt kvar på gammal SW trots deploy; krävde unregister + clear. Ett tecken på att vi saknar tydlig SW-update-strategi.

## Lärdomar

- **Mock som default döljer hela integrationer.** En grön mock-E2E bevisar produktflödet, inte att den riktiga gatewayen fungerar. När en mock finns: verifiera den riktiga vägen separat innan "klar".
- **Runtime-verifiering är inte valfri — och mät det observerbara.** Statiskt resonemang var självsäkert fel flera gånger. DOM/network/console avgjorde varje lager. Be om hård data från användarens faktiska browser tidigt.
- **Cross-origin + Service Worker + CSP är ett trippelt minfält.** Ett `<script src>` styrs av `script-src`, men SW:ns re-fetch av samma resurs styrs av `connect-src`. Allt-i-Stripe-CSP behöver js.stripe.com i `script-src` OCH `frame-src` OCH `connect-src` när en SW är aktiv.
- **Webhook-verifiering ska inte vara kopplad till orelaterad config.** Betalnings-webhooks bröts av `SUBSCRIPTION_PROVIDER` — ett latent designfel. Verifiera signatur via en dedikerad Stripe-verifierare, inte via subscription-gatewayen.
- **REST API för alla icke-triviala Vercel-env-skrivningar.** CLI:ns tomma-skrivning gäller även stdin; verifiera alltid via `env pull`.
- **Namnge "watch" → backlog direkt.** SW-update-strategi och webhook-decoupling loggades som backlog/hardening istället för att glömmas.

## Uppföljning

- **Backlog (hardening före production readiness):** Decouple Stripe webhook verification from `SUBSCRIPTION_PROVIDER`; fixa `MockSubscriptionGateway`s `data`-form (`parsed.data` → `parsed.data.object`).
- **Watch:** SW-update-strategi (användare fastnade på gammal SW efter deploy) — ev. skipWaiting-prompt/version-bump-trigger.
- **Watch:** `frame-src` saknar `hooks.stripe.com` → behövs för 3DS-kort (ej `4242`). Lägg till före produktion med riktiga kort.
- **Städning:** många övergivna test-PaymentIntents i sandbox (varje Betala-klick skapade en ny via upsert) — ofarligt i test, men `initiatePayment` saknar idempotency key.
