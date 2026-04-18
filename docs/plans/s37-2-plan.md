---
title: "S37-2: Query-param injection-fix (kundnamn/tjänst från API)"
description: "Flytta customerName och serviceName från query-params till API-svar"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Problem
  - Approach
  - Filer som berörs
  - Risker
---

# S37-2: Query-param injection-fix

## Aktualitet verifierad

**Kommandon körda:** `grep -n 'searchParams.get("name")\|searchParams.get("service")' src/app/provider/messages/`
**Resultat:** Hittade på rad 32-33 i `messages/[bookingId]/page.tsx`. Inkorg-sidan skapar länkarna med query-params på rad 70.
**Beslut:** Fortsätt

## Problem

`ThreadView` läser `customerName` och `serviceName` från URL query-params (`?name=...&service=...`). En illvillig aktör kan modifiera dessa parametrar i URL och visa godtyckliga strängar i gränssnittet. MAJOR-2 från S36-2-audit.

## Approach

Datans kontext är `bookingId` (redan autentiserat i messages GET-route via `loadBookingForMessaging`). Enklaste fix: exponera `customerName` och `serviceName` i befintligt GET `/api/bookings/[id]/messages`-svar — ThreadView hämtar redan det endpointet via SWR.

**Steg 1: Lägg till `serviceName` i `loadBookingForMessaging`**
- Utöka Prisma select med `service { select: { name: true } }` via booking-relation
- Lägg till `serviceName: string` i `BookingForConversation`-typen i `ConversationService.ts`
- Uppdatera `loadBookingForMessaging.ts` att returnera service-namn

**Steg 2: Exponera i GET messages-response**
- Lägg till `customerName` och `serviceName` i response-objektet i `route.ts`
- Uppdatera `MessagesResponse`-interfacet i ThreadView-filen

**Steg 3: Uppdatera `ThreadView`**
- Ta bort `useSearchParams()` och de två `searchParams.get()`-anropen
- Använd `data.customerName` och `data.serviceName` från SWR-svaret istället
- Visa skeleton (ThreadSkeleton från S37-1) medan data laddas (isLoading=true)

**Steg 4: Rensa inkorg-sidan**
- Ta bort query-params från Link-href i `messages/page.tsx`
- URL blir `/provider/messages/${bookingId}` (rent, inget XSS-angreppsvek)

**Steg 5: Tester**
- Uppdatera befintliga GET messages-tester att förvänta sig `customerName`/`serviceName` i svar
- Verifiera att `useSearchParams` inte längre refereras

## Filer som berörs

- `src/domain/conversation/ConversationService.ts` — lägg till `serviceName` i type
- `src/domain/conversation/loadBookingForMessaging.ts` — lägg till service select
- `src/app/api/bookings/[id]/messages/route.ts` — exponera customerName + serviceName
- `src/app/api/bookings/[id]/messages/route.test.ts` — uppdatera tester
- `src/app/provider/messages/[bookingId]/page.tsx` — ta bort query-params, använd API-data
- `src/app/provider/messages/page.tsx` — ta bort query-params i Link-href

## Risker

Låg. Inga databasschema-ändringar, bara utökning av befintligt select-block. Befintliga messages-tester fångar regressioner.
