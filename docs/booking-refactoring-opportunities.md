---
title: Bokningsdomänen -- refactoring-möjligheter
description: Prioriterade förbättringsmöjligheter för BookingService och angränsande bokningslogik
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Låg insats / hög effekt
  - Medel insats / hög effekt
  - Stor insats / strategisk betydelse
  - Svar på nyckelfrågor
---

# Bokningsdomänen -- refactoring-möjligheter

> Baserad på genomlysning 2026-03-28.

---

## Låg insats / hög effekt

### 1. Extrahera factory till egen fil

**Problem**: `createBookingService()` (rader 862-968 i BookingService.ts) är 107 rader med inline Prisma-queries. Blandar DI-wiring med datahämtning.

**Varför det spelar roll**: Factory-funktionen växer med varje nytt beroende. Lookup-funktionerna (getService, getProvider, etc.) kan inte återanvändas eller testas isolerat.

**Var**: `src/domain/booking/BookingService.ts` rader 862-968

**Rekommenderad åtgärd**: Flytta till `src/domain/booking/BookingServiceFactory.ts`. Inga andra ändringar -- bara fildelning.

**Risk**: Minimal. Ingen beteendeändring, bara filstruktur.

**När**: Vid nästa tillfälle. Kan göras självständigt.

---

### 2. Extrahera gemensam valideringslogik -- KLAR (2026-03-28)

**Genomfört.** Tre privata hjälpmetoder extraherade:
- `validateService(serviceId, providerId)` -- service existens + aktiv + provider-match
- `validateProvider(providerId)` -- provider existens + aktiv
- `validateTimeSlot(startTime, endTime?, durationMinutes)` -- endTime-beräkning + TimeSlot-validering

Används nu av createBooking (2 av 3), createManualBooking (alla 3) och rescheduleBooking (1 av 3).

78 tester gröna, 0 regressioner.

---

### 3. Named select-block i PrismaBookingRepository

**Problem**: 6 separata `select`-block som måste hållas synkroniserade. Dokumenterat som känd gotcha i CLAUDE.md.

**Varför det spelar roll**: Nytt fält kräver audit av alla 6. Risk: fält saknas i ett block -> inkomplett data i specifikt flöde.

**Var**: `PrismaBookingRepository.ts` -- alla metoder som returnerar BookingWithRelations

**Rekommenderad åtgärd**: Definiera named constants:
```typescript
const BOOKING_BASE_SELECT = { id: true, status: true, ... }
const BOOKING_WITH_CUSTOMER_SELECT = { ...BOOKING_BASE_SELECT, customer: { select: { ... } } }
```

**Risk**: Låg. Ren refaktorering, beteendet ändras inte.

**När**: Vid nästa tillfälle ett nytt fält läggs till på Booking.

---

## Medel insats / hög effekt

### 4. Extrahera kvitto-generering från route

**Problem**: `bookings/[id]/receipt/route.ts` (358 LOC) med 200+ rader inline HTML i template strings. Otestat, svårt att underhålla.

**Varför det spelar roll**: Varje designändring kräver redigering av en API-route. Ingen förhandsgranskning av kvittot möjlig. Ingen testning av HTML-output.

**Var**: `src/app/api/bookings/[id]/receipt/route.ts` rader 92-357

**Rekommenderad åtgärd**: Extrahera till `src/domain/booking/ReceiptGenerator.ts` med signatur:
```typescript
generateReceiptHtml(booking: BookingWithPayment): string
```
Routen anropar generatorn. Generatorn kan testas isolerat.

**Risk**: Medel. HTML-generering måste producera identiskt output. Testa med snapshot-test.

**När**: Vid nästa gång kvittodesignen ändras.

---

### 5. Wrappa betalningslogik i PaymentService

**Problem**: `bookings/[id]/payment/route.ts` (280 LOC) anropar PaymentGateway + Prisma direkt i routen. Ingen service-klass emellan. Inkonsekvent med resten av domänen.

**Varför det spelar roll**: Om betalningslogiken behöver ändras (delbetalning, deadline, refund) finns ingen centraliserad punkt. `PaymentService.ts` existerar redan i `src/domain/payment/` men routen använder den inte.

**Var**: `src/app/api/bookings/[id]/payment/route.ts`

**Rekommenderad åtgärd**: Verifiera om `PaymentService.processPayment()` redan hanterar detta. Om ja: byt route till att använda den. Om nej: utöka PaymentService.

**Risk**: Medel. Kräver att PaymentService-interfacet matchar routens behov.

**När**: Före nästa betalningsrelaterad feature.

---

## Stor insats / strategisk betydelse

### 6. Separation av BookingService vid framtida tillväxt

**Problem**: BookingService (969 LOC) har 4 publika metoder med överlappande validering. Om fler bokningstyper (gruppbokning, paketbokning, väntlistebokning) eller regler (kapacitetsgräns, förbetalningskrav) läggs till riskerar den att bli ett god object.

**Varför det spelar roll**: Varje ny bokningsregel kräver ändring i createBooking() (119 rader sekventiell validering). Risken för regression ökar med varje tillägg.

**Var**: Hela `BookingService.ts`

**Rekommenderad åtgärd vid behov**: Dela i use-case-specifika funktioner:
- `CreateBookingUseCase` (create + validation pipeline)
- `ManualBookingUseCase` (manual + ghost user)
- `RescheduleBookingUseCase` (reschedule + settings)
- Dela `BookingValidator` (gemensam validering)
- Behåll `updateStatus` i en liten `BookingStatusService`

**Risk**: Hög. Stor omskrivning med risk för regression. Kräver att alla 43 tester skrivs om.

**När**: Först när en ny feature faktiskt kräver det (t.ex. gruppbokningsvalidering i createBooking). **Gör INTE detta proaktivt.**

---

## Svar på nyckelfrågor

### 1. Är BookingService för stor eller bara central?

**Bara central.** 969 LOC för 4 publika metoder med tydliga ansvar är stort men inte ohälsosamt. Jämför med att dela upp i 4 filer a 250 LOC -- det skapar 4 ställen att underhålla istället för 1, utan att validering delas bättre. Den verkliga risken är inte storleken utan **dupliceringen mellan create/manual/reschedule**.

### 2. Vilka ansvar kan delas upp utan att skapa mer komplexitet?

- **Factory -> egen fil** (punkt 1): ren fildelning, 0 ny komplexitet
- **Gemensam validering -> privata metoder** (punkt 2): minskar duplicering, 0 nya filer
- **Select-block -> namngivna konstanter** (punkt 3): minskar synk-risk, 0 ny komplexitet
- **Receipt -> egen modul** (punkt 4): isolerar presentationslogik

**Bör INTE delas**: reschedule till egen service (för tätt kopplat), updateStatus till egen service (för liten), BookingService till use-cases (för tidigt).

### 3. Vilka delar är mest förändringskänsliga?

1. **createBooking() valideringskedja** -- varje ny regel utökar den
2. **PrismaBookingRepository select-block** -- varje nytt fält kräver synk
3. **Payment-route** -- domänlogik utan service-lager

### 4. Vilka delar bör vi absolut INTE röra just nu?

- **BookingStatus state machine** -- stabil, testad, sällan ändrad
- **Event-systemet** -- isolerat, fungerar bra
- **TravelTimeService** -- ren beräkningslogik, ingen anledning att röra
- **Overlap-check i repository** -- Serializable transactions, beprövat

### 5. Om vi ska göra en första förbättring, vad ger bäst effekt?

**Punkt 2: extrahera gemensam valideringslogik** som privata metoder i BookingService. Det minskar duplicering mellan create/manual/reschedule, gör det säkrare att lägga till nya regler, och kräver ingen ny filstruktur. Kan göras i 2-3 timmar med befintliga tester som verifiering.

---

## Sammanfattning: prioriteringsordning

| # | Åtgärd | Insats | Risk | När |
|---|--------|--------|------|-----|
| 1 | Factory -> egen fil | 30 min | Minimal | Vid tillfälle |
| 2 | Gemensam validering -> privata metoder | 2-3h | Låg | Vid nästa bokningsregel |
| 3 | Named select-block | 1-2h | Låg | Vid nästa nytt fält |
| 4 | Receipt -> egen modul | 3-4h | Medel | Vid kvittoändring |
| 5 | Payment -> PaymentService | 4-6h | Medel | Före betalningsfeature |
| 6 | BookingService-uppdelning | 1-2 dagar | Hög | **Bara vid behov** |
