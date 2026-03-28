---
title: Bokningsdomänen -- genomlysning
description: Strukturerad analys av BookingService och angränsande bokningslogik -- ansvar, styrkor, svagheter, hotspots
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Översikt
  - Huvudansvar i BookingService
  - Use cases och flöden
  - Ansvarsfördelning
  - Styrkor
  - Svagheter
  - Stabila delar
  - Växande hotspots
  - God object-analys
---

# Bokningsdomänen -- genomlysning

> Genomförd 2026-03-28. Baserad på faktisk kod i `src/domain/booking/`, routes under `src/app/api/bookings/`, och infrastruktur i `src/infrastructure/persistence/booking/`.

---

## Översikt

Bokningsdomänen består av:

| Fil | LOC | Roll |
|-----|-----|------|
| `BookingService.ts` | 969 | Kärntjänst: skapande, status, reschedule, validering |
| `BookingSeriesService.ts` | 341 | Återkommande bokningar |
| `BookingStatus.ts` | 75 | State machine (pending->confirmed->completed etc.) |
| `BookingEvents.ts` | 108 | Event-typer (Created, StatusChanged, PaymentReceived) |
| `BookingEventHandlers.ts` | 275 | 9 handlers: email, notis, push, logg |
| `TravelTimeService.ts` | 244 | Haversine-baserad restidsvalidering |
| `mapBookingErrorToStatus.ts` | 82 | 18 feltyper -> HTTP-statuskoder |
| `PrismaBookingRepository.ts` | 851 | 16 metoder, Serializable transactions |
| `IBookingRepository.ts` | 330 | Interface med 16 metoder |

**6 API-routes** under `/api/bookings/` (1,482 LOC totalt) plus 3 relaterade routes (`booking-series`, `provider/bookings/[id]/notes`, `route-orders/[id]/bookings`).

---

## Huvudansvar i BookingService

BookingService har 4 publika huvudmetoder + 4 valideringsmetoder:

### Huvudmetoder

| Metod | Rader | Ansvar |
|-------|-------|--------|
| `createBooking()` | 210-328 (119 rader) | 9 valideringssteg + atomic overlap-check |
| `createManualBooking()` | 420-511 (92 rader) | Som createBooking men utan self-booking-check, med ghost user |
| `updateStatus()` | 339-408 (70 rader) | State machine + behörighetskontroll |
| `rescheduleBooking()` | 528-639 (112 rader) | Reschedule-validering (fönster, max, closed day) + overlap |

### Valideringsmetoder

| Metod | Rader | Ansvar |
|-------|-------|--------|
| `calculateEndTime()` | 644-653 | HH:MM + minuter -> HH:MM |
| `validateClosedDay()` | 658-681 | Leverantörens stängda dagar |
| `validateRouteOrder()` | 686-726 | Ruttorder: status, datum, leverantörsmatch |
| `validateTravelTime()` | 736-798 | Haversine gap-validering mot befintliga bokningar |

### Factory (rader 862-968, 107 rader)

Wiring av 10 beroenden via `BookingServiceDeps` interface. Producerar en färdig BookingService med PrismaBookingRepository, Prisma-queries för lookups, TravelTimeService och ghost user-skapare.

---

## Use cases och flöden

### 1. Kund skapar bokning (POST /api/bookings)

```
Route: auth -> rate limit -> Zod -> BookingService.createBooking()
  Service: valideringskedja (9 steg) -> atomic createWithOverlapCheck
Route: event dispatch (email + notis + push till leverantör)
```

### 2. Leverantör skapar manuell bokning (POST /api/bookings/manual)

```
Route: auth (provider) -> rate limit -> Zod -> BookingService.createManualBooking()
  Service: valideringskedja (utan self-booking, restid) -> ghost user -> atomic create
Route: event dispatch
```

### 3. Statusändring (PUT /api/bookings/[id])

```
Route: dual auth (session + mobiltoken) -> rate limit -> Zod -> BookingService.updateStatus()
  Service: state machine -> behörighetskontroll -> repo updateStatusWithAuth
Route: event dispatch (StatusChanged -> email + notis + push)
```

### 4. Ombokning (PATCH /api/bookings/[id]/reschedule)

```
Route: auth (customer) -> feature flag -> rate limit -> Zod -> BookingService.rescheduleBooking()
  Service: ägarskap -> status -> reschedule settings -> fönster -> max -> closed day -> overlap
Route: email (fire-and-forget)
```

### 5. Betalning (POST /api/bookings/[id]/payment)

```
Route: auth -> rate limit -> Prisma lookup -> statusvalidering -> PaymentGateway.initiatePayment()
  -> Prisma payment.upsert() -> event dispatch (PaymentReceived)
```
**OBS: Använder INTE BookingService.** Betalllogik ligger direkt i routen.

### 6. Kvitto (GET /api/bookings/[id]/receipt)

```
Route: auth -> rate limit -> Prisma lookup -> 200+ rader HTML-generering inline
```
**OBS: Använder INTE BookingService.** Ren presentationslogik i routen (358 LOC).

### 7. Radering (DELETE /api/bookings/[id])

```
Route: auth -> repo.deleteWithAuth()
```
**OBS: Använder INTE BookingService.** Direkt repository-anrop.

---

## Ansvarsfördelning

### Vad som ligger i BookingService (bra)

- All bokningsvalidering (9 steg för create, 7 steg för reschedule)
- State machine enforcement (via BookingStatus value object)
- Behörighetskontroll vid statusändring
- Restidsvalidering (delegerat till TravelTimeService)
- Ghost user-skapande vid manuell bokning
- Explicit Result<T, E> felhantering med 18 feltyper

### Vad som ligger i routes (blandad kvalitet)

| I routen | Bedömning |
|----------|-----------|
| Auth, rate limit, Zod-validering | Korrekt -- HTTP-concern |
| Event dispatch (email, notis, push) | Korrekt -- orkestreringsansvar |
| Betalningslogik (PaymentGateway + Prisma upsert) | **Problematiskt** -- borde vara PaymentService |
| Kvitto-generering (200+ rader HTML) | **Problematiskt** -- presentationslogik i route |
| DELETE direkt mot repo | Acceptabelt -- inget domänbeteende vid radering |

### Vad som ligger i repos

PrismaBookingRepository (851 LOC) har 16 metoder. Nyckelmetoder:
- `createWithOverlapCheck` -- Serializable transaction, 3 overlap-villkor
- `updateStatusWithAuth` -- Atomic WHERE (id + providerId/customerId)
- `rescheduleWithOverlapCheck` -- Exkluderar nuvarande bokning, inkrement rescheduleCount

**6 separata select-block** som måste hållas synkroniserade vid nya fält (dokumenterat i CLAUDE.md som känd gotcha).

---

## Styrkor

### 1. Result-pattern med diskriminerad union

18 explicita feltyper (`BookingError`) med `mapBookingErrorToStatus` och `mapBookingErrorToMessage`. Ingen implicit felhantering -- varje felscenario har en definierad HTTP-statuskod och ett svenskt felmeddelande.

### 2. State machine som value object

`BookingStatus` (75 LOC) med explicita transitions. Omöjligt att göra en ogiltig statusändring -- `canTransitionTo()` kontrolleras innan persist.

### 3. Atomic overlap-check

Serializable isolation level i `createWithOverlapCheck` och `rescheduleWithOverlapCheck`. Förhindrar race conditions vid parallella bokningar.

### 4. Event-driven side effects

9 isolerade handlers (email, notis, push, logg) med fire-and-forget. En kraschande email-handler kan aldrig ta ner bokningsflödet.

### 5. DI via deps-interface

`BookingServiceDeps` med 10 injicerbara beroenden. Alla testbara via mocks. Factory centraliserar wiring.

### 6. Vältestad

43 test cases i BookingService.test.ts (1,561 LOC). Täcker alla publika metoder inklusive edge cases.

---

## Svagheter

### 1. Factory-funktionen blandar ansvar (107 rader Prisma-queries)

`createBookingService()` (rader 862-968) innehåller 10 inline Prisma-queries som lookup-funktioner. Dessa är i praktiken mini-repositories som inte testas isolerat och inte kan återanvändas.

```typescript
// Exempel: rader 886-897
getService: async (id: string) => {
  return prisma.service.findUnique({
    where: { id },
    select: { id: true, providerId: true, price: true, ... },
  })
},
```

### 2. createBooking och createManualBooking delar logik men duplicerar

Båda metoderna har liknande valideringskedja men med subtila skillnader:
- createManualBooking hoppar över self-booking-check och restidsvalidering
- createManualBooking skapar ghost user
- createManualBooking sätter status till "confirmed" direkt

Delad logik (service-lookup, provider-lookup, closed-day) är duplicerad, inte extraherad.

### 3. Betalningslogik i route istället för service

`bookings/[id]/payment/route.ts` (280 LOC) anropar PaymentGateway + Prisma direkt. Inget PaymentService-anrop. Inkonsekvent med resten av domänen. Om betalningslogiken behöver ändras (t.ex. delbetalning, deadline) finns ingen centraliserad punkt.

### 4. Kvitto-generering inline i route (358 LOC)

`bookings/[id]/receipt/route.ts` genererar HTML direkt med template strings. Otestat, svårt att underhålla, ingen separation av data och presentation.

### 5. PrismaBookingRepository: 6 separata select-block

Varje nytt fält på Booking kräver audit av alla 6. Dokumenterat som känd gotcha men fortfarande en underhållsrisk.

---

## Stabila delar

| Del | Varför stabil |
|-----|---------------|
| BookingStatus state machine | 75 LOC, ren logik, väl testad, sällan ändrad |
| Event-systemet (Events + Handlers) | Isolerat, fire-and-forget, lätt att lägga till nya handlers |
| TravelTimeService | Ren beräkningslogik, isolerad, testad |
| Error mapping (18 feltyper) | Konsekvent, lätt att utöka |
| Atomic overlap-check | Serializable transactions, beprövat mönster |

## Växande hotspots

| Del | Varför hotspot |
|-----|---------------|
| `createBooking()` valideringskedja | 9 steg i sekvens -- varje ny bokningsregel utökar denna |
| Factory-funktionen | 107 rader inline Prisma -- växer med varje nytt beroende |
| `rescheduleBooking()` | 112 rader, 7 valideringssteg -- kopierar delar av createBooking |
| Select-block i repository | 6 stycken att synka -- varje nytt fält riskerar inkonsistens |
| Payment-route | 280 LOC domänlogik i route utan service-lager |

---

## God object-analys

**Fråga: Är BookingService ett god object?**

**Svar: Nej, inte ännu -- men det rör sig i den riktningen.**

Tecken som talar MOT god object:
- **4 tydliga publika metoder** med avgränsade ansvar (create, status, manual, reschedule)
- **18 explicita feltyper** -- inte en "gör allt"-klass utan väldefinierade operationer
- **DI via interface** -- beroenden är explicita, inte implicit magiska
- **43 tester** med god täckning

Tecken som talar FÖR god object:
- **969 LOC** -- stor, men inte alla rader är affärslogik (107 rader är factory)
- **createBooking och createManualBooking överlappar** -- delad logik borde extraheras
- **rescheduleBooking kopierar validering** (closed day, overlap) från createBooking
- **Factory blandar Prisma-queries med DI** -- borde separeras

**Bedömning**: BookingService är inte ett god object idag. Det är en **stor service med väldefinierade ansvar**. Men om fler bokningsregler läggs till (t.ex. gruppbokningsvalidering, delbetalningskontroll, kapacitetsgräns) utan refaktorering kommer den att bli det.

---

## Logik som borde brytas ut

### Kandidat 1: Valideringskedjan -> BookingValidator

`createBooking()` har 9 valideringssteg i sekvens. `createManualBooking()` delar ~5 av dem. `rescheduleBooking()` delar ~3. Extrahera gemensamma steg till en `BookingValidator` med metoder som `validateServiceAndProvider()`, `validateTimeSlot()`, `validateClosedDay()`.

### Kandidat 2: Factory -> BookingServiceFactory

Flytta de 107 raderna med inline Prisma-queries till en dedikerad factory-fil. Gör lookup-funktionerna testbara och återanvändbara.

### Kandidat 3: Receipt-generering -> ReceiptService eller template

358 LOC inline HTML i en route. Borde extraheras till en separat modul, oavsett om det är en service eller en template-funktion.

### Bör INTE brytas ut

- **State machine** -- redan i BookingStatus, tillräckligt liten
- **Event dispatch** -- redan isolerat i routes/handlers
- **Reschedule som egen service** -- för tätt kopplat till BookingService (delar repository, overlap-check, status-kontroller)
