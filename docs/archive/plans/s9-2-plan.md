---
title: "S9-2: Stripe webhook idempotens-verifiering"
description: "Verifiera att duplicerade Stripe webhook-events inte ger dubbla statusuppdateringar eller sidoeffekter"
category: plan
status: wip
last_updated: 2026-04-02
sections:
  - Bakgrund
  - Analys av nuvarande skydd
  - Plan
  - Risker
  - Filer som andras
---

# S9-2: Stripe webhook idempotens-verifiering

## Bakgrund

Stripe webhooks levereras "at least once". Vi maste verifiera att duplicerade
`payment_intent.succeeded` och `payment_intent.payment_failed` events inte ger
dubbla bokningsbekraftelser, statusuppdateringar eller notiser.

## Analys av nuvarande skydd

### Vad som redan finns

1. **Status-guard i PaymentWebhookService** (`src/domain/payment/PaymentWebhookService.ts:45`):
   - `handlePaymentIntentSucceeded`: returnerar tidigt om `payment.status === "succeeded"`
   - `handlePaymentIntentFailed`: returnerar tidigt om status ar `succeeded` eller `failed`

2. **Befintligt integrationstest** (`route.integration.test.ts:102-119`):
   - "skips update when payment already succeeded" -- verifierar att `prisma.payment.update` INTE anropas

3. **Webhook triggar INTE email/notiser**: Notiser skickas fran payment-routen
   (`src/app/api/bookings/[id]/payment/route.ts`), inte fran webhook-hanteraren.

### Bedomning

Den befintliga status-guarden ar **tillracklig** for nuvarande arkitektur:
- Statusen ar idempotent (samma varde skrivs)
- Invoice-nummer genereras bara vid forsta uppdateringen
- Inga sidoeffekter (email/notiser) triggas fran webhook
- Race condition ar teoretisk (serverless, men harmlos aven vid race)

## Plan

### Station 2: RED -- Nya tester som verifierar idempotens explicit

**Fil:** `src/domain/payment/PaymentWebhookService.test.ts` (ny unit-testfil)

Tester att skriva:
1. **Succeeded idempotens**: Anropa `handlePaymentIntentSucceeded` 2 ganger med samma payload.
   Verifiera att `updatePaymentStatus` anropas exakt 1 gang.
2. **Failed idempotens**: Anropa `handlePaymentIntentFailed` 2 ganger.
   Verifiera att uppdatering sker 1 gang.
3. **Succeeded efter failed**: Verifiera att succeeded INTE overskrider ett payment som redan ar failed
   (terminal state-skydd).
4. **Inga sidoeffekter vid duplicate**: Verifiera att `generateInvoiceNumber` anropas exakt 1 gang.

### Station 3: GREEN -- Eventuella fixar

Baserat pa analysen forvanter jag att alla tester passerar direkt (befintlig kod
hanterar redan fallen). Om nagot test failar fixas det.

### Inga schemaandringar

Webhook event ID-tracking (dedup-tabell) ar overkill for nuvarande skala.
Den befintliga status-guarden ar tillracklig. Dokumenteras som framtida forbattring.

## Risker

| Risk | Sannolikhet | Atgard |
|------|-------------|--------|
| Race condition vid samtidiga webhooks | Lag (serverless, idempotent write) | Accepterad risk, dokumenteras |
| Framtida kod lagger till email i webhook | Medel | Kommentar i koden + test som verifierar inga sidoeffekter |

## Filer som andras

| Fil | Andring |
|-----|---------|
| `src/domain/payment/PaymentWebhookService.test.ts` | **NY** -- unit-tester for idempotens |
| `src/domain/payment/PaymentWebhookService.ts` | Eventuell kommentar om idempotens-skydd |
