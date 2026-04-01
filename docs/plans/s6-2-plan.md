---
title: "S6-2: Stripe E2E fungerar lokalt"
description: "Plan för att fixa CSP-blockerande av Stripe.js och verifiera E2E"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Rotorsak
  - Fix
  - Filer som ändras
---

# S6-2: Stripe E2E fungerar lokalt -- Plan

## Bakgrund

Stripe E2E-testet auto-skippades tidigare pga saknade env vars. Nu skippas det INTE
(nycklarna finns i .env.local), men testet FAILar: PaymentElement renderar ingen iframe.

## Rotorsak (5 Whys)

1. Varför failar testet? -- Stripe iframe laddas aldrig (0 iframes pa sidan)
2. Varför laddas ingen iframe? -- PaymentElement fran @stripe/react-stripe-js renderar inte
3. Varför renderar den inte? -- Stripe.js scriptet fran js.stripe.com blockeras
4. Varför blockeras det? -- CSP script-src tillater bara 'self', saknar https://js.stripe.com
5. Varför saknas Stripe i CSP? -- CSP lades till innan Stripe-betalning implementerades (sprint 5)

**Rotorsak**: CSP-headern i next.config.ts saknar Stripe-domaner.

## Fix

Uppdatera CSP i next.config.ts for att tillata Stripe:
- `script-src`: lagg till `https://js.stripe.com`
- `frame-src`: lagg till `https://js.stripe.com` (PaymentElement renderar i iframe)
- `connect-src`: lagg till `https://api.stripe.com` (API-anrop fran Stripe.js)

Ta bort debug-loggning fran E2E-testet.

## Filer som andras

- `next.config.ts` -- CSP-headers
- `e2e/stripe-payment.spec.ts` -- ta bort debug-kod, eventuellt finjustera selektorer
