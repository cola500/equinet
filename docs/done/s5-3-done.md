---
title: "S5-3: Stripe webhook-route -- Done"
description: "Webhook-route hanterar payment_intent events"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S5-3: Stripe webhook-route -- Done

## Acceptanskriterier

- [x] Webhook verifierar Stripe-signatur (befintlig, via SubscriptionGateway)
- [x] Betalningsstatus uppdateras i databasen (succeeded/failed)
- [x] Felaktiga signaturer returnerar 400
- [x] Unit-tester for alla event-typer (9 nya)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (signaturverifiering, idempotent uppdatering)
- [x] Unit tests skrivna FORST (TDD), alla 3784 grona
- [x] Lint: 0 fel

## Vad som gjordes

1. **PaymentWebhookService**: Ny domain service som hanterar webhook-callbacks
   - `handlePaymentIntentSucceeded`: uppdaterar Payment till "succeeded", genererar fakturanummer
   - `handlePaymentIntentFailed`: uppdaterar Payment till "failed"
   - Idempotent: hoppar over redan avslutade betalningar
   - Race condition-safe: loggar warning om Payment-rad inte hittas annu

2. **Webhook route utokad**: Routar `payment_intent.*` events till PaymentWebhookService,
   subscription-events till SubscriptionService som forut

3. **Factory**: `createPaymentWebhookService()` med Prisma-beroenden injicerade

## Avvikelser

- Ingen ändring i signaturverifieringen -- ateranvander SubscriptionGateway.verifyWebhookSignature()
  som delar STRIPE_WEBHOOK_SECRET for alla event-typer

## Lardomar

- **Event-routing i webhook**: Enklare att routa pa event.type.startsWith() an att skapa separata endpoints per event-kategori. Stripe rekommenderar en enda webhook-URL.
- **Idempotens ar kritisk**: Stripe kan skicka samma event flera ganger. Terminal-state-check forhindrar dubbelarbete.
