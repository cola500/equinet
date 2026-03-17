---
title: "BDD Dual-Loop TDD: Refaktorera Payment Route"
description: "Refaktorera /api/bookings/[id]/payment med BDD dual-loop TDD som pilotprojekt"
category: plan
status: active
last_updated: 2026-03-17
sections:
  - Kontext
  - Approach
  - Kvalitetsdimensioner
  - Faser
  - Verifiering
---

# Plan: BDD Dual-Loop TDD -- Payment Route

## Kontext

Vi vill testa BDD dual-loop TDD i praktiken genom att refaktorera `/api/bookings/[id]/payment` -- en route med rik affärslogik men **noll tester**. Routen har inline invoice-generering, statusvalidering, payment gateway-anrop och domain events. Perfekt kandidat för att visa hur yttre integrationstester driver inre unit-tester.

**Fil:** `src/app/api/bookings/[id]/payment/route.ts` (283 rader, POST + GET)

## Mål

1. Skriva tester med BDD dual-loop (integration först, sedan units)
2. Extrahera affärslogik till en `PaymentService` (domain service)
3. Behålla exakt samma beteende -- ren refactoring + test-addition

## Fas 1: Yttre loop -- Integrationstester (Red)

Skapa `src/app/api/bookings/[id]/payment/route.test.ts` med dessa BDD-scenarion:

### POST-scenarion
1. **Kund betalar bekräftad bokning** -> 200, payment-objekt med invoiceNumber
2. **Redan betald bokning** -> 400 "Bokningen är redan betald"
3. **Pending bokning (ej bekräftad)** -> 400 "Bokningen måste vara bekräftad"
4. **Bokning finns inte / tillhör annan kund** -> 404
5. **Payment gateway misslyckas** -> 402 "Betalningen misslyckades"
6. **Rate limit** -> 429
7. **Ej inloggad** -> 401

### GET-scenarion
8. **Hämta betald bokning** -> 200 med payment-data
9. **Hämta obetald bokning** -> 200 med status "unpaid"
10. **Bokning finns inte** -> 404

**Mockar**: auth, prisma, rateLimiters, getPaymentGateway, event dispatcher. Följ befintliga test-patterns i projektet.

## Fas 2: Inre loop -- Extrahera PaymentService (Red/Green/Refactor)

### 2a. Extrahera `generateInvoiceNumber()`
- Flytta till `src/domain/payment/InvoiceNumberGenerator.ts`
- Unit-test: format `EQ-YYYYMM-XXXXXX`, 6 alfanumeriska tecken

### 2b. Skapa `PaymentService`
- **Fil:** `src/domain/payment/PaymentService.ts`
- **Unit-testfil:** `src/domain/payment/PaymentService.test.ts`
- **Ansvar:**
  - `processPayment(bookingId, customerId)` -- validerar status, anropar gateway, skapar payment-record
  - `getPaymentStatus(bookingId, userId)` -- hämtar payment-status
- **Dependencies (DI via constructor):**
  - `IPaymentGateway` (redan finns)
  - Prisma (eller ett PaymentRepository om vi vill gå hela vägen)
  - Logger
- **Unit-tester per affärsregel:**
  - Bekräftad bokning -> processerar betalning
  - Completed bokning -> processerar betalning
  - Pending bokning -> kastar fel
  - Redan betald -> kastar fel
  - Gateway-fel -> kastar fel med gateway-meddelande
  - Invoice-nummer genereras korrekt

### 2c. Uppdatera route.ts
- Route-handlern delegerar till PaymentService
- Behåll: auth, rate limiting, error-mapping (HTTP-statuskoder)
- Ta bort: all affärslogik från route

## Fas 3: Green (integration)

Kör alla integrationstester igen. De ska passera utan ändringar (samma beteende).

## Fas 4: Refactor

- Rensa imports i route.ts
- Verifiera att PaymentService följer DI-mönstret (constructor injection)
- Event dispatching: behåll i route eller flytta till service (beslut under implementation)

## Filer att skapa/ändra

| Fil | Åtgärd |
|-----|--------|
| `src/app/api/bookings/[id]/payment/route.test.ts` | **Ny** -- integrationstester |
| `src/domain/payment/PaymentService.ts` | **Ny** -- affärslogik |
| `src/domain/payment/PaymentService.test.ts` | **Ny** -- unit-tester |
| `src/domain/payment/InvoiceNumberGenerator.ts` | **Ny** -- invoice-generering |
| `src/domain/payment/PaymentGateway.ts` | **Befintlig** -- oförändrad |
| `src/app/api/bookings/[id]/payment/route.ts` | **Ändra** -- delegera till PaymentService |

## Befintliga filer att återanvända

- `src/domain/payment/PaymentGateway.ts` -- IPaymentGateway, MockPaymentGateway
- `src/domain/booking/index.ts` -- createBookingEventDispatcher, createBookingPaymentReceivedEvent
- `src/lib/notification-helpers.ts` -- customerName()
- `src/lib/rate-limit.ts` -- rateLimiters, getClientIP
- `src/lib/auth-server.ts` -- auth()

## Verifiering

1. `npx vitest run src/app/api/bookings/[id]/payment/route.test.ts` -- alla integrationstester gröna
2. `npx vitest run src/domain/payment/PaymentService.test.ts` -- alla unit-tester gröna
3. `npm run typecheck` -- inga TS-fel
4. `npm run test:run` -- inga regressioner i övriga ~3488 tester
