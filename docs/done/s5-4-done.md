---
title: "S5-4: Betalning UI -- Done"
description: "Stripe Payment Element integrerat i bokningsflödet"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S5-4: Betalning UI -- Done

## Acceptanskriterier

- [x] Kund ser betalningsalternativ i bokningsflödet (nar feature flag ar aktiv)
- [x] Betalning genomfors via Stripe Payment Element (kort)
- [x] Felhantering vid avbruten/misslyckad betalning
- [ ] Visuell verifiering med Playwright MCP (avvaktar -- kraver STRIPE_PUBLISHABLE_KEY i dev)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (feature flag gate pa bade server och klient)
- [x] Alla 3784 tester grona
- [x] Lint: 0 fel

## Vad som gjordes

1. **Backend -- clientSecret propagation**:
   - `PaymentResult` utokad med `clientSecret?`
   - `StripePaymentResult` borttagen (redundant)
   - `PaymentService.processPayment` propagerar clientSecret
   - API-route returnerar `clientSecret` i response vid pending
   - Event dispatch bara vid `succeeded` (inte pending)

2. **Frontend -- PaymentDialog**:
   - `PaymentDialog.tsx`: ResponsiveDialog med Stripe Elements
   - `loadStripe` med `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Hanterar success/error/loading states
   - Svenska strängar: "Betala X kr", "Fyll i dina kortuppgifter", "Bearbetar..."
   - `redirect: "if_required"` undviker onödig omdirigering

3. **Feature flag gate**:
   - Betalningsknapp visas BARA om `stripe_payments` ar aktiv (klient-side)
   - Server-side: route returnerar 404 nar flaggan ar av (defense in depth)

## Avvikelser

- Swish inte tillganglig annu -- `payment_method_types: ['card']` tills Stripe-kontot har Swish
- Visuell verifiering inte genomford -- kraver Stripe publishable key i dev-miljo

## Lardomar

- **clientSecret-propagation genom 3 lager**: PaymentResult -> PaymentService -> API route -> klient. Viktigt att varje lager stodjer optional field.
- **Conditional event dispatch**: Med asynkron betalning (Stripe) skickas email/notis forst vid webhook-bekraftelse, inte vid initiering. Forhindrar "Betalning genomford"-mail innan kunden betalat.
- **Feature flag dual gate**: Server (404) + klient (gom knapp) ger bade sakerhet och bra UX.
