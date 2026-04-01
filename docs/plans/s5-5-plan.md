---
title: "S5-5: E2E betalning med Stripe"
description: "E2E-test for Stripe Payment Element i bokningsflödet"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Approach
  - Filer
  - Risker
---

# S5-5: E2E betalning med Stripe

## Bakgrund

Befintlig `e2e/payment.spec.ts` testar mot MockPaymentGateway (instant success).
Med Stripe ar flödet asynkront: POST skapar PaymentIntent -> PaymentDialog med Stripe Element -> kund fyller i kort -> bekraftelse.

`.env.local` har nu Stripe test-keys fran Vercel. `PAYMENT_PROVIDER=stripe`.

## Approach

### Problem: .env.local satter PAYMENT_PROVIDER=stripe

Befintliga `payment.spec.ts`-tester forvantar instant success (mock).
Med `PAYMENT_PROVIDER=stripe` returneras `pending` + `clientSecret` istallet.

**Losning:** Overridea `PAYMENT_PROVIDER=mock` i playwright.config webServer.env.
Stripe-specen kör separat med `PAYMENT_PROVIDER=stripe` via env-override.

### Fas 1: Config-andringar

1. Lagg till `FEATURE_STRIPE_PAYMENTS: 'true'` i playwright.config webServer.env
2. Lagg till `PAYMENT_PROVIDER: 'mock'` i playwright.config webServer.env (skyddar befintliga tester)

### Fas 2: Stripe E2E-spec

Skapa `e2e/stripe-payment.spec.ts`:

1. **Skip om Stripe-nycklar saknas**: `test.skip(!process.env.STRIPE_SECRET_KEY, '...')`
2. **beforeEach**: Seed confirmed booking, login som kund
3. **Test: boka -> betala med Stripe test-kort -> bekraftelse**:
   - Klicka "Betala X kr"
   - Vanta pa PaymentDialog (Stripe Element)
   - Fylla i Stripe test-kort: `4242 4242 4242 4242`, exp `12/30`, CVC `123`
   - Klicka "Betala X kr" i dialogen
   - Vanta pa success-toast
   - Verifiera "Betald"-badge

**OBS:** Stripe Payment Element renderas i en iframe. Playwright kan interagera
med iframes via `page.frameLocator()`.

### Fas 3: Verifiera

- Befintliga payment-tester passerar (mock)
- Stripe-testet passerar (med nycklar)
- Stripe-testet skippas graciost utan nycklar
- Passerar 3 ganger i rad

## Filer

| Fil | Andring |
|-----|---------|
| `playwright.config.ts` | Lagg till FEATURE_STRIPE_PAYMENTS + PAYMENT_PROVIDER=mock |
| `e2e/stripe-payment.spec.ts` | NY -- Stripe Payment Element E2E |

## Risker

- **Stripe Element iframe**: Playwright maste navigera in i iframe for att fylla i kortuppgifter. Stripe renderar i `__privateStripeFrame`. Kan vara skort.
- **Externt beroende**: Testet gor riktiga anrop till Stripe API. Kan vara langsammare an mock-tester.
- **Rate limiting**: Stripe test-mode har rate limits. Manga korningar kan blockas.
- **.env.local trumfar .env**: Lokalt pekar nu mot Supabase. Playwright config overridear PAYMENT_PROVIDER men INTE DATABASE_URL.
