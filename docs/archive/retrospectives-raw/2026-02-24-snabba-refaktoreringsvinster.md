# Retrospektiv: Snabba refaktoreringsvinster

**Datum:** 2026-02-24
**Scope:** Bred kodanalys med 4 parallella agenter, sedan implementation av snabba vinster: Haversine-konsolidering, error mapper-extrahering, repository-compliance.

---

## Resultat

- 10 andrade filer, 2 nya filer, 1 borttagen fil, 0 nya migrationer
- 0 nya tester (refaktorering utan beteendeandring)
- 2478 totala tester (inga regressioner)
- Typecheck = 0 errors
- Netto: +16 / -148 rader (132 rader borttagna)
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Domain | `review/mapReviewErrorToStatus.ts`, `customer-review/mapCustomerReviewErrorToStatus.ts` | Extraherade error mappers fran 3 API routes |
| Domain | `shared/Location.ts` | Import-andring: `lib/distance` -> `lib/geo/distance` |
| API | `providers/route.ts`, `route-orders/announcements/route.ts` | Tog bort inline Haversine-duplikation (~50 rader) |
| API | `routes/route.ts`, `route-orders/available/route.ts` | Import-andring till kanonisk distance-modul |
| API | `reviews/route.ts`, `reviews/[id]/reply/route.ts`, `customer-reviews/route.ts` | Ersatte inline error mappers med delade domain-filer |
| API | `service-types/route.ts` | Ersatte `prisma.service.findMany()` med `ServiceRepository.findAll()` |
| Lib | `distance.ts` (BORTTAGEN) | Tog bort duplikat -- `lib/geo/distance.ts` ar kanonisk kalla |
| Docs | `docs/plans/refactoring.md` | Fullstandig refaktoreringsplan med 4 sprintar |

## Analys: Bred kodgenomgang

Sessionen borjade med 4 parallella explorer-agenter som analyserade:
1. **Stora filer** -- 20 filer over 300 rader, 4 over 1000 rader
2. **Kodduplikation** -- Haversine 4x, error mappers inline, auth-guards repeterade
3. **Komponentarkitektur** -- useBookingFlow 302 rader med 22-prop drilling, "use client" overanvandning
4. **Testtackning** -- 18 API routes utan tester, payment-route (239 rader) helt otestad

Resultatet dokumenterades i `docs/plans/refactoring.md` med 4 prioriterade sprintar.

## Vad gick bra

### 1. Parallella agenter for bred analys
Fyra explorer-agenter arbetade samtidigt pa olika aspekter. Total analystid ~3 minuter for vad som annars hade tagit 30+ minuter manuellt. Varje agent hittade unika problem som de andra missade.

### 2. Disciplinerad avgransning av "quick wins" vs "storre arbete"
Repository-compliance-analysen visade att 3 av 5 routes kraver nya repositories (RouteOrder, ProviderVerification). Istallet for att borja bygga ny infrastruktur avgransades till de 2 faktiska snabbvinsterna. Reschedule-routen lamnades ocksa -- Prisma-anropet ar for notifieringskontext, inte karnlogik.

### 3. Netto negativ radrakning
132 rader borttagna utan nagon funktionell andring. Kodduplikation ar den enklaste formen av teknisk skuld att eliminera.

## Vad kan forbattras

### 1. RouteOrder saknar repository
RouteOrder ar en karndomantitet som anvands i 2+ routes men saknar repository helt. Detta blockerar repository-compliance for `route-orders/route.ts` och `route-orders/available/route.ts`.

**Prioritet:** MEDEL -- fungerar men bryter mot projektets DDD-Light-monster.

### 2. Payment-route otestad
`api/bookings/[id]/payment/route.ts` (239 rader) hanterar pengar utan tester. Hogsta testrisken i projektet.

**Prioritet:** HOG -- kritisk affarslogik utan sakerhetsnatt.

### 3. Stora sidor kraver storre refaktorering
4 sidor over 1000 rader (`provider/customers`, `BookingService`, `provider/profile`, `customer/horses/[id]`) behover delas upp men varje uppdelning ar ett halvdags-projekt.

**Prioritet:** MEDEL -- fungerar men svarundallt att arbeta med.

## Patterns att spara

### Parallell kodanalys med specialiserade agenter
Nar man behover en bred genomlysning av kodbasen: starta 4 agenter parallellt med olika fokus (filstorlek, duplikation, komponentarkitektur, testtackning). Varje agent far ett skarpt uppdrag och returnerar strukturerade fynd. Resultaten syntetiseras till en prioriterad plan.

### Kanonisk utility-modul
Nar samma berakning finns pa flera stallen: valj den mest kompletta implementationen (den med tester och extra utilities), peka alla imports dit, ta bort ovriga. I detta fall: `lib/geo/distance.ts` hade bade `calculateDistance()` och `filterByDistance()` plus tester.

### Error mapper per doman
Folj monstret fran `domain/horse/mapHorseErrorToStatus.ts`: en fil per doman som mappar domainfel till HTTP-statuskoder. Importeras av alla routes i den domanen. Forhindrar att switch-satser dupliceras i varje route.

## Larandeeffekt

**Nyckelinsikt:** Bred kodanalys med parallella agenter ar extremt effektivt for att hitta refaktoreringsmojligheter -- men den verkliga utmaningen ar att avgora vad som ar en snabb vinst vs ett storre projekt. Haversine-duplikation och error mappers var triviala att fixa (minuter), men repository-compliance for RouteOrder kraver ny infrastruktur (timmar). Planen som dokument ar varde i sig -- den ger en karta for framtida sessioner.
