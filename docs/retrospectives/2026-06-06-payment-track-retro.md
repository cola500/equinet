---
title: Retro — Betalnings-spåret (provider E2E mock)
description: Kort retrospektiv för betalnings-spåret 2026-06-06 — readiness-audit, mock-config på staging, E2E-bevisning, Stripe.js-fynd och /pure-fix.
category: retro
status: active
last_updated: 2026-06-06
tags: [payment, stripe, e2e, staging, mock, retro]
related:
  - docs/operations/provider-e2e-payment-readiness-2026-06.md
  - docs/operations/provider-e2e-payment-runbook-2026-06.md
sections:
  - Mål
  - Vad vi gjorde
  - Vad gick bra
  - Vad gick mindre bra
  - Lärdomar
  - Uppföljning
---

# Retro — Betalnings-spåret (provider E2E mock), 2026-06-06

## Mål

Bevisa hela leverantörs-värdeflödet end-to-end på staging — kund bokar → leverantör accepterar → genomför → kund betalar → kvitto/status — utan riktiga betalningar.

## Vad vi gjorde

Slicedes i små, verifierbara steg:

1. **Readiness-audit** — kartlade boknings-/betalningskedjan, identifierade att betalning är flagg-gatad + kund-initierad.
2. **Slice 1 (env-check)** — verifierade staging: `PAYMENT_PROVIDER=stripe`, test-nycklar, webhook saknades, flagga av.
3. **Slice 2 (config)** — satte staging till mock (`PAYMENT_PROVIDER=mock`, `FEATURE_STRIPE_PAYMENTS=true`).
4. **Runbook** — Playwright-first E2E-runbook med F-gate, abort-kriterier, output-struktur.
5. **E2E-körning** — alla 16 steg gröna; mock-betalning + kvitto bevisade.
6. **Fynd → fix** — Stripe.js-fel upptäckt, rotorsaksanalyserat, fixat och runtime-verifierat.

## Vad gick bra

- **Small-slice-disciplin.** Varje steg var read-only-först, dokumenterat och stoppade innan nästa. Lätt att följa och rulla tillbaka.
- **Skilja kod-readiness från miljö-readiness.** Audit:n flaggade explicit att "koden finns" ≠ "staging är konfigurerad" — undvek ett falskt "production-ready".
- **Säker env-hantering.** Upptäckte att Vercel CLI skrev tomma värden (även via stdin) och bytte till REST API med verifiering via `env pull`. Dokumenterat som CLI-fälla #4 i CLAUDE.md.
- **Runtime-verifiering fångade en riktig bug** som statisk analys missade (se nedan).

## Vad gick mindre bra

- **Första fixen (PR #360) var otillräcklig — fel angreppspunkt.** Vi gjorde `loadStripe()`-*anropet* lazy, men problemet var *importen*. Den statiska analysen var självsäker men ofullständig.
- **Antagande om SDK-beteende utan att verifiera.** Att `import { loadStripe } from "@stripe/stripe-js"` laddar Stripe.js som import-side-effect är dokumenterat — vi gissade istället för att slå upp det först (bryter mot vår egen SDK-policy).
- **Browser-cache kostade tid.** Persistent Playwright-context cachade gammal kod; flera felspår innan vi stängde browsern och uteslöt cache.

## Lärdomar

- **Verifiera SDK-side-effects, gissa inte.** Tredjeparts-import kan ha sidoeffekter (script-injektion). Slå upp dokumentationen — vår Version & SDK-policy gäller även beteende, inte bara versioner.
- **Runtime-verifiering är inte valfri för UI/nätverks-påståenden.** "Statiskt vattentätt" räckte inte; bara en faktisk sidladdning avslöjade att scriptet laddades. Mät det observerbara (DOM/network), inte bara koden.
- **Färsk browser-context vid deploy-verifiering.** Stäng browsern / nytt context för att utesluta cache innan slutsats om "fungerar i prod-likt läge". (Komplement till [[feedback_visual_verification]].)
- **REST API för alla icke-triviala Vercel-env-skrivningar**, inte bara sensitive. CLI:n skriver tyst tomt även via stdin.

## Uppföljning

- **Framtida slice:** Stripe test-mode (lägg `STRIPE_WEBHOOK_SECRET`, registrera webhook, verifiera testkort 4242 + kvitto). Då även runtime-verifiera att `/pure` laddar Stripe.js on-demand i det riktiga flödet.
- **Watch:** `@stripe/react-stripe-js` ligger kvar i kund-bundlen via statisk import. Om bundle-storlek blir ett problem: `next/dynamic` av `PaymentDialog`. Inte en bug — bara en notering.
