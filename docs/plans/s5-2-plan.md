---
title: "S5-2: StripePaymentGateway"
description: "Implementera StripePaymentGateway som ersatter MockPaymentGateway"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Filer som andras
  - Approach
  - Risker
---

# S5-2: StripePaymentGateway

## Bakgrund

Befintlig arkitektur: `IPaymentGateway` interface + `MockPaymentGateway` + factory.
`PaymentService` ar helt gateway-agnostisk -- behover bara en ny gateway-klass och factory-uppdatering.

Stripe SDK anvands for att skapa PaymentIntents med `payment_method_types: ['swish']`.
Swish nar kunden via Stripe som lokal betalmetod (inget direkt Swish API).

## Filer som andras

| Fil | Ändring |
|-----|---------|
| `src/domain/payment/PaymentGateway.ts` | Ny `StripePaymentGateway` class + uppdatera factory |
| `src/domain/payment/PaymentService.ts` | Rad 143: `provider: "mock"` -> dynamiskt fran gateway |
| `src/domain/payment/createPaymentService.ts` | Ingen -- factory anropar redan `getPaymentGateway()` |
| `src/lib/feature-flag-definitions.ts` | Ny flagga `stripe_payments` |
| `src/app/api/bookings/[id]/payment/route.ts` | Feature flag gate |

### Nya filer

| Fil | Innehåll |
|-----|---------|
| `src/domain/payment/StripePaymentGateway.ts` | Stripe-implementation av IPaymentGateway |
| `src/domain/payment/__tests__/StripePaymentGateway.test.ts` | Unit-tester |

## Approach

### Fas 1: RED -- Tester forst

1. Skapa `StripePaymentGateway.test.ts` med tester:
   - `initiatePayment` skapar PaymentIntent med ratt parametrar
   - `initiatePayment` returnerar pending status (Swish ar async)
   - `checkStatus` mappar PaymentIntent-status korrekt
   - Felhantering: Stripe API-fel -> `success: false`
   - Felhantering: saknad STRIPE_SECRET_KEY -> tydligt fel
2. Skapa feature flag-test i befintlig payment route-test

### Fas 2: GREEN -- Implementation

1. `npm install stripe` (ej @stripe/stripe-js -- det ar klient-SDK)
2. Skapa `StripePaymentGateway`:
   - Constructor: `new Stripe(process.env.STRIPE_SECRET_KEY!)`
   - `initiatePayment()`: `stripe.paymentIntents.create({ amount: amountInOre, currency: 'sek', payment_method_types: ['swish'], metadata: { bookingId } })`
   - `checkStatus()`: `stripe.paymentIntents.retrieve(id)` + map status
   - OBS: Belopp i ore (amount * 100), Stripe returnerar "requires_action" for Swish
3. Uppdatera factory: `PAYMENT_PROVIDER=stripe` -> `new StripePaymentGateway()`
4. Fixa hardkodad `provider: "mock"` i PaymentService -> lat gateway ange provider-namn
5. Lagg till feature flag `stripe_payments` (default: false)
6. Feature flag gate pa payment route

### Fas 3: REFACTOR

- Rensa upp, se till att alla tester ar grona
- Verifiera att MockPaymentGateway fortfarande fungerar som default

## Risker

- **Stripe SDK-version**: Maste soka upp aktuell version (lita ej pa training data)
- **Swish via Stripe**: Krav: Stripe-konto med Swish aktiverat. Fungerar i test-mode.
- **Asynkront flode**: Swish-betalning ar INTE instant. `initiatePayment` returnerar `pending`, webhook bekraftar. S5-3 hanterar webhook -- denna story returnerar `pending` och sparar PaymentIntent-ID.
- **Provider-field hardkodning**: PaymentService rad 143 hardkodar "mock". Maste fixas.
