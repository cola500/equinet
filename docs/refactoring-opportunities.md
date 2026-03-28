---
title: Refactoring-möjligheter
description: Prioriterad lista med förbättringsmöjligheter grupperade efter insats och effekt
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Låg insats / hög effekt
  - Medel insats / hög effekt
  - Stor insats / strategisk betydelse
---

# Refactoring-möjligheter -- Equinet

> Genomförd 2026-03-28. Baserad på arkitektur- och kodkvalitetsgenomgång.

---

## Låg insats / hög effekt

### 1. Ersätt console.error med clientLogger i page-komponenter

**Problem**: 77 `console.error/warn/log`-anrop i produktionskod. Projektets egen `clientLogger` (som troligen kopplar till Sentry) används inte konsekvent.

**Varför det spelar roll**: Klient-fel försvinner i tomma intet. Ingen felspårning, ingen alerting, inga mönster att analysera.

**Var**: ~30 filer under `src/app/provider/`, `src/app/providers/`, `src/app/customer/`

**Rekommenderad åtgärd**: Mekanisk sökning-och-ersättning. `console.error(` -> `clientLogger.error(`. Kan köras med parallella agenter per mappgrupp (liknande session 106).

**Uppskattad insats**: 1-2 timmar

---

### 2. Centralisera Zod-schemas för delade entiteter

**Problem**: De flesta API-routes definierar Zod-schemas inline. Samma validering (bokningsdatum, provider-profil, hästprofil) kan ha subtilt olika regler i olika routes.

**Varför det spelar roll**: Inkonsekvent validering leder till buggar som bara uppstår i vissa flöden.

**Var**: `src/app/api/bookings/`, `src/app/api/provider/`, `src/app/api/horses/`

**Rekommenderad åtgärd**: Skapa `src/lib/schemas/booking.ts`, `src/lib/schemas/provider.ts` etc. med delade schemas. Importera i routes. Börja med de mest använda (booking, provider-profil).

**Uppskattad insats**: 2-3 timmar

---

### 3. Konvertera page-fetch till SWR-hooks

**Problem**: Flera page-komponenter gör egna fetch-anrop med `useEffect` + `useState` istället för SWR-hooks. Inkonsekvent med resten av kodbasen.

**Var**:
- `src/app/provider/dashboard/page.tsx` -- 3 fetch-anrop
- `src/app/provider/group-bookings/page.tsx` -- 2 fetch-anrop
- `src/app/providers/[id]/page.tsx` -- 4 fetch-anrop
- `src/app/provider/announcements/page.tsx` -- fetch-anrop

**Varför det spelar roll**: Duplicerad loading/error-hantering, ingen cache-deduplicering, ingen automatisk revalidering.

**Rekommenderad åtgärd**: Extrahera till hooks: `useDashboardStats()`, `useGroupBookings()` etc. Följ mönstret i `useBookings()`.

**Uppskattad insats**: 3-4 timmar

---

### 4. Tester för slotCalculator

**Problem**: `src/lib/utils/slotCalculator.ts` (147 LOC) saknar dedikerade tester. Beräknar tillgängliga tidsslots -- kritisk affärslogik.

**Varför det spelar roll**: Regressioner i slot-beräkning kan leda till dubbelbokningar eller osynliga tider.

**Rekommenderad åtgärd**: Skriv unit-tester med edge cases: överlappande tider, stängda dagar, gränsfall vid midnatt, tidszoner.

**Uppskattad insats**: 2-3 timmar

---

## Medel insats / hög effekt

### 5. API-route wrapper-funktion

**Problem**: ~2,000 LOC duplicerad boilerplate (auth, rate-limit, JSON-parse, Zod) i 159 routes. Session 106 visade att en miss i mönstret (saknad null-check) krävde uppdatering av 87 filer.

**Varför det spelar roll**: Varje ny route kräver copy-paste av ~15 rader. Varje ändring i mönstret kräver sweep av alla routes. Hög risk för inkonsistens.

**Var**: Alla filer under `src/app/api/`

**Rekommenderad åtgärd**: Skapa en `withApiHandler(config, handler)` wrapper:

```typescript
// src/lib/api-handler.ts
export function withApiHandler(config: {
  auth?: boolean | 'provider' | 'admin'
  rateLimit?: keyof typeof rateLimiters
  schema?: ZodSchema
  featureFlag?: string
}, handler: (ctx: HandlerContext) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    // Auth, rate-limit, parse, validate -- centraliserat
    return handler({ session, body, params })
  }
}
```

**Tillvägagångssätt**: Börja med 5-10 enkla routes. Verifiera att tester fortfarande passerar. Migrera resten gradvis.

**Uppskattad insats**: 1-2 dagar (wrapper + migration av alla routes)

---

### 6. Dela upp BookingService

**Problem**: 968 LOC, ~10 publika metoder. Reschedule-logik (130+ LOC), travel time-validering, manuell bokning-skapande och statusändringar i samma fil.

**Varför det spelar roll**: Svårt att förstå, testa och ändra isolerade delar. Tesfilen är 1,561 LOC.

**Var**: `src/domain/booking/BookingService.ts`

**Rekommenderad åtgärd**: Extrahera:
- `RescheduleService` (~150 LOC) -- reschedule-validering och exekvering
- Flytta `TravelTimeService` om det inte redan är separat
- Behåll BookingService som fasad som delegerar

**Uppskattad insats**: 4-6 timmar

---

### 7. Email-templates som komponent-system

**Problem**: `src/lib/email/templates.ts` (1,012 LOC) med inline HTML + CSS. Svårt att ändra design, omöjligt att förhandsgranska, inga tester.

**Varför det spelar roll**: Varje designändring kräver manuell HTML-redigering. Risk för trasig layout i email-klienter.

**Var**: `src/lib/email/templates.ts`, `src/lib/email/notifications.ts`

**Rekommenderad åtgärd**: Migrera till React Email eller liknande. Alternativt: bryt upp i separata template-filer med en gemensam layout-bas.

**Uppskattad insats**: 1-2 dagar

---

### 8. Gemensamt auth-lager för session + JWT

**Problem**: Webb-routes använder `auth()` (NextAuth session), native-routes använder `authFromMobileToken()` (JWT). Ingen gemensam funktion som ger samma resultat oavsett auth-metod.

**Varför det spelar roll**: Behörighetsändringar måste appliceras på båda ställena manuellt. Risk att de divergerar.

**Var**: `src/lib/auth-server.ts`, `src/lib/mobile-auth.ts`, 20+ native routes

**Rekommenderad åtgärd**: Skapa `getAuthenticatedUser(request)` som försöker session-auth först, sedan Bearer JWT. Returnerar samma `AuthUser`-typ. Routes behöver bara anropa en funktion.

**Uppskattad insats**: 4-6 timmar

---

### 9. ManualBookingDialog uppdelning

**Problem**: 752 LOC i en komponent med formulärlogik, datumval, tidsberäkning, kundval och validering.

**Varför det spelar roll**: Svårt att ändra enskilda delar utan risk att bryta andra. Stor kognitiv belastning.

**Var**: `src/components/calendar/ManualBookingDialog.tsx`

**Rekommenderad åtgärd**: Extrahera steg i bokningsflödet till subkomponenter: `CustomerStep`, `ServiceStep`, `DateTimeStep`, `ConfirmStep`. Behåll dialog-wrappern som orkestrator.

**Uppskattad insats**: 4-6 timmar

---

## Stor insats / strategisk betydelse

### 10. Minska PrismaBookingRepository-komplexitet

**Problem**: 850 LOC med 6 separata `select`-block som måste hållas synkroniserade. Varje nytt fält på Booking kräver audit av alla 6.

**Varför det spelar roll**: Dokumenterat i CLAUDE.md som känd gotcha. Hög risk för att nytt fält saknas i ett av blocken -> inkomplett data i specifika flöden.

**Var**: `src/infrastructure/persistence/booking/PrismaBookingRepository.ts`

**Rekommenderad åtgärd**: Definiera named select-block som konstanter (`BOOKING_LIST_SELECT`, `BOOKING_DETAIL_SELECT` etc.) och återanvänd. Alternativt: minska antalet varianter genom att använda en generös bas-select som alla queries delar.

**Uppskattad insats**: 1 dag

---

### 11. Migreringsplan för next-auth v5 final

**Problem**: Projektet kör `next-auth@5.0.0-beta.30`. Beta-API kan ändras vid final release. Auth berör middleware, alla API-routes, session-hantering och mobiltoken-integration.

**Varför det spelar roll**: Breaking changes i auth påverkar hela applikationen. Bättre att ha en plan innan final release.

**Var**: `src/lib/auth.ts`, `src/lib/auth.config.ts`, `middleware.ts`, 123 routes med `auth()`

**Rekommenderad åtgärd**: Bevaka next-auth changelog. Skapa en branch med senaste beta och kör testsuite. Dokumentera eventuella API-ändringar. Wrapper-funktionen (punkt 5) skulle minska påverkan avsevärt.

**Uppskattad insats**: 2-4 timmar förberedelse, OKLART tid för själva migreringen

---

### 12. Route-orders route uppdelning

**Problem**: `src/app/api/route-orders/route.ts` (480 LOC) hanterar två distinkta flöden: kundens beställning och leverantörens annonsering. Båda i samma fil.

**Varför det spelar roll**: Två olika affärsflöden i samma handler gör det svårt att resonera om behörigheter och validering.

**Var**: `src/app/api/route-orders/route.ts`

**Rekommenderad åtgärd**: Dela i `handleCustomerOrder()` och `handleProviderAnnouncement()` som separata funktioner, eller bryt ut till separata routes (`/api/route-orders/customer`, `/api/route-orders/provider`).

**Uppskattad insats**: 3-4 timmar

---

## Sammanfattning: prioriteringsordning

| # | Åtgärd | Insats | Effekt | Prioritet |
|---|--------|--------|--------|-----------|
| 1 | console.error -> clientLogger | 1-2h | Hög | Gör först |
| 4 | Tester för slotCalculator | 2-3h | Hög | Gör först |
| 5 | API-route wrapper | 1-2d | Mycket hög | Gör snart |
| 2 | Centralisera Zod-schemas | 2-3h | Medel | Gör snart |
| 3 | Page-fetch -> SWR-hooks | 3-4h | Medel | Gör snart |
| 8 | Gemensamt auth-lager | 4-6h | Hög | Planera |
| 6 | BookingService uppdelning | 4-6h | Medel | Planera |
| 10 | Select-block konsolidering | 1d | Medel | Planera |
| 9 | ManualBookingDialog split | 4-6h | Medel | Vid tillfälle |
| 7 | Email-templates | 1-2d | Låg-medel | Vid tillfälle |
| 11 | next-auth migration | Varierar | Strategisk | Bevaka |
| 12 | Route-orders split | 3-4h | Låg | Vid tillfälle |
