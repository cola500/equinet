---
title: "S24-1: Extrahera BookingValidation + createBookingService"
description: "Plan for att extrahera validering och factory fran BookingService.ts"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Analys
  - Approach
  - Filer som andras
  - Risker
  - Tester
---

# S24-1: Extrahera BookingValidation + createBookingService

## Analys

BookingService.ts ar 993 rader. Strukturen:

| Sektion | Rader | Beskrivning |
|---------|-------|-------------|
| Types/interfaces | 1-206 | DTOs, BookingError, BookingServiceDeps |
| BookingService class | 208-884 | 4 publika metoder + 9 privata helpers |
| createBookingService() | 893-993 | Factory med Prisma-beroenden |

**Privata validation-metoder (att extrahera):**
- `validateService` (15 rader) -- tjänst aktiv + tillhör provider
- `validateProvider` (10 rader) -- provider aktiv
- `validateTimeSlot` + `calculateEndTime` (26 rader) -- tidsberäkning
- `validateClosedDay` (23 rader) -- stängd dag
- `validateRouteOrder` (40 rader) -- rutt-validering
- `validateTravelTime` (62 rader) -- restidsvalidering
- `resolveBookingLocation` + `resolveBookingLocationFromCustomer` (50 rader) -- platsupplösning

Totalt: ~226 rader validation + ~100 rader factory = ~326 rader att flytta.

## Approach

### Fas 1: Extrahera BookingValidation.ts

Skapa `src/domain/booking/BookingValidation.ts` med en klass `BookingValidation` som tar samma deps-interface och exponerar validering som publika metoder.

BookingService behaller sina 4 publika metoder men delegerar validering till BookingValidation.

### Fas 2: Extrahera createBookingService.ts

Flytta factory-funktionen `createBookingService()` till `src/domain/booking/createBookingService.ts`.

### Fas 3: Flytta tester

Skapa `BookingValidation.test.ts` med enhetstester for de extraherade metoderna. Befintliga BookingService-tester behalls -- de testar integration.

## Filer som andras

| Fil | Aktion |
|-----|--------|
| `src/domain/booking/BookingValidation.ts` | NY -- validering |
| `src/domain/booking/createBookingService.ts` | NY -- factory |
| `src/domain/booking/BookingService.ts` | ANDRAD -- delegerar, types kvar |
| `src/domain/booking/BookingValidation.test.ts` | NY -- tester |
| `src/domain/booking/createBookingService.test.ts` | NY -- tester |

**Inga route-andringar.** Alla 17 konsumenter importerar BookingService/createBookingService -- re-export saker bakatkompabilitet.

## Risker

1. **Import-brott**: createBookingService importeras av routes. Loser med re-export fran BookingService.ts.
2. **Typ-export**: BookingError, DTOs etc exporteras fran BookingService.ts. Behalls dar.
3. **Privata metoder blir publika**: validation-metoder var private. Nu publika pa BookingValidation. Acceptabelt -- de testar rena affarsregler.

## Tester

- Alla 1561 befintliga tester MASTE passera oforandrade
- Nya unit-tester for BookingValidation (isolerade fran BookingService)
- `npm run check:all` gron
