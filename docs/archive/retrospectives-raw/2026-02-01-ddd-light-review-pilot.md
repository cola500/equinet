# Retrospektiv: DDD-Light Review Pilot

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead
**Scope:** Review-domänen migrerad till repository + service pattern

---

## Resultat

- 5 nya filer, 6 ändrade filer (+2202 / -160 rader)
- 14 nya ReviewService-tester (TDD)
- 915 totala tester (alla gröna)
- 1 pre-existerande bugg hittad och fixad (reply-visning i kundvy)
- Typecheck + ESLint = 0 errors

## Vad gick bra

### 1. Behavior-based route-tester överlever refactoring
POST /api/reviews-testerna (12 st) behövde NOLL ändringar trots att hela implementationen byttes ut. De testar HTTP-kontrakt (status + response shape), inte Prisma-anrop.

### 2. TDD fångade designproblem tidigt
Att skriva tester först tvingade fram tydliga dependencies (getBooking, getProviderUserId) och explicita feltyper (BOOKING_NOT_COMPLETED, ALREADY_REVIEWED).

### 3. Result-pattern ger typesäker error-hantering
Omöjligt att glömma error-hantering -- TypeScript tvingar check på `.isFailure`.

### 4. Atomic IDOR-skydd förbättrade säkerheten
Alla auth-aware metoder använder userId/providerId i WHERE-clause (atomärt). Ingen race condition mellan "hitta" och "uppdatera".

### 5. Select-first förhindrar dataläckor
Alla repository-metoder använder `select` (aldrig `include`). passwordHash kan aldrig läsas genom något kodflöde.

## Vad kan förbättras

### 1. PUT/DELETE-routes går förbi service-lagret (HÖGST PRIORITET)
[id]-routes anropar repository direkt istället för ReviewService. Det gör route-testerna fragila (kopplade till Prisma P2025-mockar). POST-routen (via service) var robust.

**Lösning:** Lägg till `updateReview()` och `deleteReview()` i ReviewService. Alla routes ska delegera till service.

### 2. Factory pattern behövs för DI
Inline `new ReviewService({ ... })` i varje route är verbost (20+ rader boilerplate). För Booking (5+ deps) är factory obligatoriskt.

**Lösning:** Skapa `createReviewService()` factory. Använd från start för Booking.

### 3. Error-mapping dupliceras
`mapErrorToStatus` finns i både `route.ts` och `reply/route.ts`.

**Lösning:** Flytta till domain-lagret (`ReviewService.ts` eller separat fil).

### 4. Mock-repo hårdkodar relations
`MockReviewRepository.toRelations()` returnerar hårdkodade "Test User" -- räcker inte för notis-tester.

**Lösning:** Mock-repo bör ta seedable relations (Map med kunder/providers).

### 5. UI-bugg hittades bara manuellt
Kunden såg inte leverantörens svar på recensioner. Buggen fanns redan före refaktoreringen.

**Lösning:** E2E-test för "kund ser leverantörens svar" hade fångat den automatiskt.

## Rekommendationer för Booking-migrering

| # | Vad | Varför |
|---|-----|--------|
| 1 | Factory pattern för DI | Booking har 5+ dependencies, inline DI är ohantierbart |
| 2 | BookingStatus value object FÖRST | State machine-logik bör vara i VO, inte if-satser |
| 3 | Alla routes via service-lager | Undvik fragila route-tester (lärdomar från Review [id]) |
| 4 | Error-mapping i domain-lager | DRY, Booking har 5+ routes som behöver samma mapping |
| 5 | Route-tester mockar service, inte Prisma | Bättre separation, mer robust mot refactoring |
| 6 | E2E för kritiska flöden | Create booking, confirm, customer view, cancel |

## Arkitektonisk bedömning

**Code size:** +1009 rader netto för Review (enkel domain). Acceptabelt -- testbarhet + säkerhet väger upp. Booking (mer komplex) kommer ha bättre ROI.

**Risk:** LÅG. Inga breaking changes, alla tester gröna, mönstret är bevisat.

**Verdict:** DDD-Light validerat. Fortsätt med Booking enligt plan, applicera lärdomar ovan.
