---
title: "S5-2: StripePaymentGateway -- Done"
description: "Stripe-implementation av IPaymentGateway med kortbetalning"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S5-2: StripePaymentGateway -- Done

## Acceptanskriterier

- [x] `StripePaymentGateway` implementerar `IPaymentGateway`
- [x] Factory byter gateway baserat pa env-var (`PAYMENT_PROVIDER=stripe`)
- [x] Unit-tester med mockad Stripe SDK (12 tester)
- [x] Feature flag-gating pa route-niva (`stripe_payments`, default off)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (feature flag gate, auth, rate limit -- befintliga)
- [x] Unit tests skrivna FORST (TDD), alla 3775 grona
- [x] Lint: 0 fel
- [x] Svenska tecken: OK

## Vad som gjordes

1. **StripePaymentGateway** (`src/domain/payment/StripePaymentGateway.ts`):
   - `initiatePayment()`: Skapar PaymentIntent med `payment_method_types: ['card']`
   - `checkStatus()`: Hamtar PaymentIntent och mappar status
   - Belopp konverteras till ore (SEK * 100)
   - `clientSecret` returneras for frontend-integration

2. **Factory uppdaterad** (`PaymentGateway.ts`):
   - `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` -> StripePaymentGateway
   - Default: MockPaymentGateway (oforandrad)
   - Lazy import for att undvika att ladda Stripe SDK i onödan

3. **IPaymentGateway utokad** med `providerName: string`:
   - PaymentService använder `this.deps.paymentGateway.providerName` istallet for hardkodad "mock"
   - Sparar korrekt provider i Payment-tabellen

4. **Feature flag** `stripe_payments` (default: false):
   - Gate pa POST `/api/bookings/[id]/payment` -> 404 nar av
   - GET (statuskoll) fungerar oavsett flagga

5. **Tester**: 12 nya for StripePaymentGateway + 1 feature flag-test

## Avvikelser

- `payment_method_types: ['card']` istallet for `['swish']` -- Swish annu inte aktiverat pa Stripe-kontot
- Asynkront flode: `initiatePayment` returnerar `pending` + `clientSecret`. Bekraftelse sker via webhook (S5-3).

## Lardomar

- **providerName pa interface-niva**: Att lagga till `providerName` pa `IPaymentGateway` ar battre an att lagga logik i PaymentService for att gissa provider. Varje gateway vet sitt eget namn.
- **Feature flag-tester racker hela vagen**: Nar man lagger till en ny flagga maste man uppdatera ALLA tester som jamfor exakt flagg-lista (2 st).
- **Lazy import for tung SDK**: `require()` i factory undviker att Stripe SDK laddas nar MockPaymentGateway anvands.
