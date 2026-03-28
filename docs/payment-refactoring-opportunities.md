---
title: Payment/checkout -- refactoring-möjligheter
description: Prioriterade förbättringsmöjligheter för betalnings- och prenumerationslogik
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Låg insats / hög effekt
  - Medel insats / hög effekt
  - Stor insats / strategisk betydelse
  - Svar på nyckelfrågor
---

# Payment/checkout -- refactoring-möjligheter

> Baserad på genomlysning 2026-03-28.

---

## Låg insats / hög effekt

### 1. Byt payment-route till att använda PaymentService

**Problem**: `bookings/[id]/payment/route.ts` (~280 LOC) innehåller all betalningslogik inline (Prisma-queries, gateway-anrop, invoice-generering). `PaymentService.processPayment()` implementerar exakt samma logik men anropas inte.

**Varför det spelar roll**: Två "sanningar" för betalningsflödet. Om logiken ändras (t.ex. delbetalning, valutastöd) måste den ändras på 2 ställen. PaymentService har tester -- routen har inte isolerad testning av betalningslogik.

**Var**: `src/app/api/bookings/[id]/payment/route.ts` (POST handler)

**Rekommenderad åtgärd**: Ersätt inline-logiken med:
```typescript
const paymentService = createPaymentService()
const result = await paymentService.processPayment(bookingId, userId)
if (result.isFailure) {
  return NextResponse.json(
    { error: mapPaymentErrorToMessage(result.error) },
    { status: mapPaymentErrorToStatus(result.error) }
  )
}
// Event dispatch med result.value.eventData
```

GET-handleren kan använda `paymentService.getPaymentStatus()` på samma sätt.

**Risk**: Låg. PaymentService har identisk logik + egna tester. Beteendet ändras inte.

**När**: Kan göras nu. Minsta möjliga förbättring med störst effekt.

---

### 2. Hantera invoice-nummer kollision

**Problem**: `generateInvoiceNumber()` producerar `EQ-YYYYMM-XXXXXX` med 6 random tecken. Prisma-schema har `@unique` constraint, men koden fångar inte constraint-felet. Vid kollision blir det en obehandlad 500.

**Varför det spelar roll**: Sällsynt men möjligt. En 500 vid betalning är allvarligt.

**Var**: `src/domain/payment/InvoiceNumberGenerator.ts` + `createPaymentService.ts` (upsert)

**Rekommenderad åtgärd**: Retry-logik i `createPaymentService.ts` vid Prisma unique constraint error (P2002 på invoiceNumber). Max 3 försök med nytt nummer.

**Risk**: Minimal. Tillägg av error-catch, ingen beteendeändring vid lyckad generering.

**När**: Vid tillfälle. Inte akut men bra att ha på plats.

---

## Medel insats / hög effekt

### 3. Extrahera kvitto-generering från route

**Problem**: `bookings/[id]/receipt/route.ts` (358 LOC) med 200+ rader inline HTML. Otestad presentationslogik i API-route.

**Varför det spelar roll**: Designändringar kräver redigering av en route-fil. Kan inte testas isolerat. Blandar data-hämtning med HTML-generering.

**Var**: `src/app/api/bookings/[id]/receipt/route.ts` rad ~92-357

**Rekommenderad åtgärd**: Extrahera `generateReceiptHtml(data: ReceiptData): string` till `src/domain/payment/ReceiptGenerator.ts`. Routen hämtar data och anropar generatorn.

**Risk**: Medel. HTML-output måste vara identiskt. Verifiera med snapshot-test.

**När**: Vid nästa kvittodesign-ändring.

---

### 4. Lägg till webhook idempotency-tracking

**Problem**: Stripe kan leverera samma webhook flera gånger. Nuvarande kod processar varje leverans utan dedup. Risk: dubbla status-uppdateringar.

**Varför det spelar roll**: Stripe garanterar "at-least-once" delivery. Utan idempotency kan `handleSubscriptionUpdated` köras flera gånger på samma event.

**Var**: `src/app/api/webhooks/stripe/route.ts` + `SubscriptionService.handleWebhookEvent()`

**Rekommenderad åtgärd**: Spara `event.id` (Stripe event ID) i en `ProcessedWebhookEvent`-tabell. Kolla `EXISTS` innan processning. Alternativt: gör alla handlers idempotenta (upsert istället för create -- redan delvis fallet).

**Risk**: Medel. Kräver schema-ändring om tabell-approach. Alternativet (idempotenta handlers) är enklare.

**När**: Före produktionslansering av Stripe-prenumerationer.

---

## Stor insats / strategisk betydelse

### 5. Enhetlig persistence-mönster för payment

**Problem**: Subscription använder repository-pattern (`ISubscriptionRepository`). Payment använder Prisma direkt i factory (`createPaymentService.ts`) och i route. Inkonsekvent med projektets DDD-approach där kärndomäner ska ha repositories.

**Varför det spelar roll**: Om Payment blir en kärndomän (t.ex. med refund-stöd, delbetalningar, betalningshistorik) behövs en riktig repository.

**Var**: `src/domain/payment/createPaymentService.ts` (inline Prisma) + `bookings/[id]/payment/route.ts` (inline Prisma)

**Rekommenderad åtgärd**: Skapa `IPaymentRepository` + `PrismaPaymentRepository`. Injicera i PaymentService.

**Risk**: Medel. Ren strukturändring men kräver flytt av 3-4 Prisma-queries.

**När**: Först om Payment-domänen växer (refund, delbetalning, betalningshistorik). Inte motiverat för nuvarande scope.

---

### 6. Riktig betalleverantör (Swish/Stripe)

**Problem**: MockPaymentGateway returnerar alltid instant success. Ingen riktig betalleverantör implementerad.

**Varför det spelar roll**: Betalningar fungerar inte i produktion -- det är en mock.

**Var**: `src/domain/payment/PaymentGateway.ts` (rad 62-64, factory returnerar alltid Mock)

**Rekommenderad åtgärd**: Implementera `SwishPaymentGateway` eller `StripePaymentGateway` som implementerar `IPaymentGateway`. Byt factory baserat på env-variabel.

**Risk**: Hög. Extern integration, asynkrona flöden (Swish callback), felhantering, testning mot sandbox.

**När**: När betalningsfunktionalitet ska lanseras. Gateway-abstraktionen är redan på plats.

---

## Svar på nyckelfrågor

### 1. Är payment-/checkout-logiken ett verkligt problem eller bara lite spretig?

**Lite spretig, inte ett verkligt problem.** Subscription-sidan är välstrukturerad. Payment-sidan har en specifik brist: routen använder inte den existerande servicen. Det är en enkel fix, inte ett arkitekturproblem.

### 2. Finns det affärslogik i routes som borde brytas ut?

**Ja, en route.** `bookings/[id]/payment/route.ts` POST-handler har ~100 rader domänlogik (validering, gateway, persistence, invoice) som redan finns i `PaymentService.processPayment()`. GET-handler har ~50 rader som finns i `PaymentService.getPaymentStatus()`.

Receipt-routen har 200+ rader HTML-generering som borde extraheras, men det är presentationslogik snarare än domänlogik.

### 3. Finns det duplicering eller otydliga statusövergångar?

**Duplicering**: Ja -- payment route vs PaymentService (identisk logik på 2 ställen).

**Statusövergångar**: Tydliga. Payment-status (pending/succeeded/failed/refunded) och booking-status (pending/confirmed/completed/cancelled/no_show) är oberoende. Ingen kaskad, inga otydliga övergångar.

### 4. Finns det risk i kopplingen mellan payment och booking?

**Låg risk.** Kopplingen är envägs (payment läser booking-data) via abstraherade interfaces (`BookingForPayment`, `BookingForStatus`). Betalstatus påverkar inte bokningsstatus. Event-kopplingen (BookingPaymentReceivedEvent) är fire-and-forget.

### 5. Vad är den minsta säkra förbättringen?

**Punkt 1: Byt payment-route till att använda PaymentService.** Eliminerar duplicering, ger en "source of truth", tar ~1-2 timmar, kräver minimal teständring.

### 6. Vad bör vi absolut inte röra?

- **SubscriptionService + StripeSubscriptionGateway** -- välstrukturerat, fungerar, testat
- **MockPaymentGateway** -- behövs tills riktig gateway implementeras
- **Gateway-abstraktionen** -- rätt design, ska inte ändras
- **Webhook-routing** -- fungerar korrekt, signaturverifiering på plats
- **Payment Prisma-schema** -- korrekt med rätt constraints och index

---

## Sammanfattning: prioriteringsordning

| # | Åtgärd | Insats | Risk | När |
|---|--------|--------|------|-----|
| 1 | Route -> PaymentService | 1-2h | Låg | Kan göras nu |
| 2 | Invoice-kollision retry | 30 min | Minimal | Vid tillfälle |
| 3 | Receipt -> ReceiptGenerator | 3-4h | Medel | Vid kvittoändring |
| 4 | Webhook idempotency | 2-4h | Medel | Före Stripe-lansering |
| 5 | Payment repository | 4-6h | Medel | Om domänen växer |
| 6 | Riktig betalleverantör | 1-2 veckor | Hög | Vid betalningslansering |
