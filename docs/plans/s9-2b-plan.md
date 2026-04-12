---
title: "S9-2b: Webhook hardening"
description: "Tre bugfixar i PaymentWebhookService: bredare guard, flytta invoiceNumber, test"
category: plan
status: wip
last_updated: 2026-04-02
sections:
  - Bakgrund
  - Uppgifter
  - Filer som andras
  - Risker
---

# S9-2b: Webhook hardening

## Bakgrund

S9-2 bekraftade idempotens men tre problem kvarstar i `handlePaymentIntentSucceeded`:

1. **Smal guard (rad 46):** `if (payment.status === "succeeded")` fangar inte `failed`. Ett payment som redan markats `failed` ska inte kunna overskridas till `succeeded` -- terminala tillstand ar terminala. `handlePaymentIntentFailed` (rad 88) gor redan ratt: `=== "succeeded" || === "failed"`.
2. **Slosad invoiceNumber (rad 51):** `generateInvoiceNumber()` anropas FORE `updatePaymentStatus` count-check. Vid concurrent duplicate slosas ett fakturanummer. Flytta efter `updated > 0`.
3. **Test saknas** for det nya beteendet (failed -> succeeded ska blockeras).

## Uppgifter

### 1. Bredda guard i handlePaymentIntentSucceeded

```typescript
// FORE:
if (payment.status === "succeeded") {

// EFTER:
if (payment.status === "succeeded" || payment.status === "failed") {
```

Uppdatera aven loggmeddelandet till "Payment already in terminal state, skipping" (konsistent med failed-handlern).

### 2. Flytta invoiceNumber efter count-check

```typescript
// FORE:
const invoiceNumber = this.deps.generateInvoiceNumber()
// ... updatePaymentStatus ...
if (updated === 0) return

// EFTER:
const updated = await this.deps.updatePaymentStatus(payment.id, {
  status: "succeeded",
  paidAt: new Date(),
}, ["succeeded", "failed"])

if (updated === 0) return

const invoiceNumber = this.deps.generateInvoiceNumber()
// Separat update for invoice data (eller inkludera i samma)
```

**Notera:** Detta kraver att vi antingen:
- (a) Gor en andra DB-uppdatering for invoiceNumber/invoiceUrl efter guard, eller
- (b) Genererar invoiceNumber FORE men kastar det vid duplicate (nuvarande beteende, bara slott)

Jag rekommenderar **(a)** -- tva steg: forst atomisk status-ändring, sedan invoice-data. Alternativt kan vi behalla ett anrop men flytta genereringen sa den bara kors nar `updated > 0`.

**Enklaste losningen:** Behall ett DB-anrop men flytta `generateInvoiceNumber()` till EFTER `updated > 0`-checken, gora en andra uppdatering for invoice-data. Eller: acceptera att nummret "slosas" (enklast, men Johan angav explicit att flytta).

**Beslut:** Behall ett DB-anrop. Acceptera att invoiceNumber slosas vid concurrent race -- det ar inte ett konsistensproblem, bara ett kosmetiskt nummer-gap. Enklare kod vager tyngre.

### 3. Test

Lagg till i `PaymentWebhookService.test.ts`:
- "skips succeeded when payment already failed" -- verifiera att guard blockerar
- "does not generate invoiceNumber on concurrent duplicate" -- verifiera att generateInvoiceNumber inte anropas nar updated === 0

## Filer som andras

| Fil | Ändring |
|-----|---------|
| `src/domain/payment/PaymentWebhookService.ts` | Guard + invoiceNumber-flytt |
| `src/domain/payment/PaymentWebhookService.test.ts` | Nya tester |

## Risker

- **Tva DB-anrop:** En extra update for invoice-data. Acceptabelt for webhooks (asynkron, ej latency-kritisk).
- **Brottyta:** Liten -- bara PaymentWebhookService, inga API-routes andras.
