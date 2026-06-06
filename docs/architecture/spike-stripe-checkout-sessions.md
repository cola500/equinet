---
title: Spike — Utvärdera Stripe Checkout Sessions med Payment Element
description: Framtida spike (ej nu) för att utvärdera om vi bör byta från direkt PaymentIntents till Checkout Sessions (ui_mode=elements) före production payments. Bakgrund, frågor att besvara och påverkansytor.
category: architecture
status: draft
last_updated: 2026-06-06
tags: [payment, stripe, checkout-sessions, payment-element, spike, production-readiness]
related:
  - docs/payment-domain-review.md
  - docs/operations/provider-e2e-payment-readiness-2026-06.md
  - docs/retrospectives/2026-06-06-stripe-test-mode-retro.md
sections:
  - Status
  - Bakgrund
  - Nuvarande integration
  - Frågor att besvara i spiken
  - Påverkansytor (preliminärt)
  - Beslut
---

# Spike — Utvärdera Stripe Checkout Sessions med Payment Element

## Status

**Ej startad. Dokumentationsnotering — ingen kodändring.** Nuvarande PaymentIntent-flöde behålls tills vidare. Spiken körs **före production payments**, efter att Stripe test-mode-E2E är klar (vilket den nu är, 2026-06-06).

## Bakgrund

Stripe rekommenderar numera **Checkout Sessions API med Payment Element** för de flesta integrationer, framför direkt `PaymentIntents`. Checkout Sessions täcker liknande use cases men ger mer färdigt checkout-stöd (dynamiska betalmetoder, skatt, kvitton, Link, m.m.) och mindre egen kod. Källa: Stripe best-practices-skill — routningstabellen pekar "one-time payments" och "custom payment form with embedded UI" mot Checkout Sessions (+ Payment Element).

Vi bör utvärdera om ett byte minskar egen kod och risk innan vi tar betalningar i produktion.

## Nuvarande integration

- `StripePaymentGateway.initiatePayment()` skapar en **PaymentIntent** direkt och returnerar `clientSecret`.
- Klienten renderar **Payment Element** (`@stripe/react-stripe-js`) i `PaymentDialog` mot den clientSecret:en.
- `payment_intent.succeeded`-**webhook** → `verifyStripeWebhook` → `PaymentWebhookService` → `Payment.status=succeeded`.
- Kvitto/faktura genereras internt (`invoiceNumber` `EQ-…`, `GET /api/bookings/[id]/receipt`).
- Mock-gateway (`PAYMENT_PROVIDER=mock`) ger instant `succeeded` utan externa anrop.

## Frågor att besvara i spiken

1. Passar **Checkout Sessions `ui_mode=elements`** bättre än vår nuvarande PaymentIntent-integration (mindre egen kod, bättre konvertering, dynamiska betalmetoder)?
2. Hur påverkas **`PaymentService`** (skapar då en Checkout Session istället för PaymentIntent; hur ser `clientSecret`/`return`-flödet ut)?
3. Hur påverkas **webhook-events** (`checkout.session.completed` vs `payment_intent.succeeded` — vilket/vilka lyssnar vi på, och hur normaliseras `data.object`)?
4. Hur mappar vi **`bookingId`/`providerId`/`customerId`-metadata** genom Checkout Session → PaymentIntent (metadata på session + payment_intent_data.metadata)?
5. Hur påverkas **receipt/invoice-flödet** (kan vi behålla vårt eget `EQ-`-kvitto, eller använda Stripes kvitton/fakturor)?
6. Kan **mock-gateway** behållas (samma `IPaymentGateway`-abstraktion, mock returnerar instant succeeded)?
7. Vilka **tester** behöver ändras (gateway, PaymentService, webhook-route + integration, E2E)?
8. Vad är **migration risk** (parallellt stöd vs hård switch, feature-flag-gating, bakåtkompatibilitet för redan skapade PaymentIntents)?

## Påverkansytor (preliminärt)

| Yta | Trolig påverkan |
|-----|-----------------|
| `src/domain/payment/StripePaymentGateway.ts` | Byt `paymentIntents.create` → `checkout.sessions.create({ ui_mode: "elements", … })` |
| `src/domain/payment/PaymentService.ts` | Returnera session-clientSecret; ev. annan status-semantik |
| `src/components/customer/bookings/PaymentDialog.tsx` | `EmbeddedCheckout`/`CheckoutProvider` istället för `Elements` + `PaymentElement` |
| `webhooks/stripe/route.ts` + `PaymentWebhookService` | Lyssna på `checkout.session.completed`; matcha Payment via session/PI-id |
| `verifyStripeWebhook` | Oförändrad (verifierar valfri Stripe-event); dispatch utökas |
| Receipt/invoice | Behåll eget kvitto eller byt till Stripe |
| Mock-gateway | Behåll abstraktionen; mock returnerar "session" instant succeeded |

## Beslut

- **Nu:** behåll PaymentIntent-flödet. Endast denna notering skapad.
- **Trigger:** kör spiken som en avgränsad utvärdering **före** att riktiga (live) betalningar aktiveras.
- **Output från spiken:** rekommendation (migrera / behåll) + om migrera: slicad plan med feature-flag-gating och migration-risk.
