---
title: "S5-4: Betalning UI"
description: "Stripe Payment Element i bokningsflödet"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Approach
  - Filer
  - Risker
---

# S5-4: Betalning UI

## Bakgrund

Befintligt flode: "Betala X kr"-knapp i BookingCard -> POST /api/bookings/[id]/payment -> instant success (mock).
Med Stripe: POST skapar PaymentIntent (pending), returnerar clientSecret. Klienten visar Stripe Payment Element.
Kunden betalar -> Stripe bekraftar -> webhook uppdaterar status.

## Approach

### Fas 1: Backend -- returnera clientSecret

Uppdatera API-route och PaymentService att returnera `clientSecret` vid pending-betalning.
`StripePaymentResult` har redan `clientSecret` men det propageras inte till klienten.

1. Utoka `PaymentResult` med optional `clientSecret`
2. Utoka `ProcessPaymentResult` att inkludera `clientSecret`
3. API-route returnerar `clientSecret` i response nar status ar "pending"
4. Tester for nytt response-format

### Fas 2: Frontend -- Stripe Payment Element

1. `npm install @stripe/react-stripe-js @stripe/stripe-js`
2. Skapa `StripeProvider` -- loadStripe med publishable key
3. Skapa `PaymentDialog` -- ResponsiveDialog med Stripe PaymentElement
   - Visar Payment Element med clientSecret
   - Hanterar success/error/loading states
   - Poll GET /api/bookings/[id]/payment for status-uppdatering efter confirm
4. Uppdatera BookingCard:
   - "Betala"-knapp -> POST for clientSecret -> oppna PaymentDialog
   - Om status already "succeeded" (mock gateway) -> visa success direkt
   - Om status "pending" + clientSecret -> visa Stripe form

### Fas 3: Feature flag gate pa UI-sidan

Betalningsknappen visas BARA om `stripe_payments` flaggan ar aktiv.
Nar flaggan ar av: ingen betalningsknapp (samma som fore).

## Filer

| Fil | Andring |
|-----|---------|
| `src/domain/payment/PaymentGateway.ts` | Lagg till `clientSecret?` i PaymentResult |
| `src/domain/payment/PaymentService.ts` | Propagera clientSecret |
| `src/app/api/bookings/[id]/payment/route.ts` | Returnera clientSecret i response |
| `src/app/api/bookings/[id]/payment/route.test.ts` | Testa clientSecret i response |
| `src/components/customer/bookings/PaymentDialog.tsx` | NY -- Stripe Payment Element dialog |
| `src/components/customer/bookings/BookingCard.tsx` | Uppdatera betalningsknapp |
| `src/app/customer/bookings/page.tsx` | Uppdatera handlePayment for Stripe-flode |

## Risker

- **Stripe.js laddning**: loadStripe ar asynkront. Behover laddas FORE Payment Element renderas.
- **Feature flag dubbel-gate**: Bade server (route) och klient (UI) -- defense in depth.
- **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**: Maste finnas i env for att Stripe.js ska funka.
