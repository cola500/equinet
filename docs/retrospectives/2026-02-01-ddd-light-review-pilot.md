# Retrospektiv: DDD-Light Review Pilot

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead
**Scope:** Review-domanen migrerad till repository + service pattern

---

## Resultat

- 5 nya filer, 6 andrade filer (+2202 / -160 rader)
- 14 nya ReviewService-tester (TDD)
- 915 totala tester (alla grona)
- 1 pre-existerande bugg hittad och fixad (reply-visning i kundvy)
- Typecheck + ESLint = 0 errors

## Vad gick bra

### 1. Behavior-based route-tester overlever refactoring
POST /api/reviews-testerna (12 st) behvde NOLL andringar trots att hela implementationen byttes ut. De testar HTTP-kontrakt (status + response shape), inte Prisma-anrop.

### 2. TDD fangade designproblem tidigt
Att skriva tester forst tvingade fram tydliga dependencies (getBooking, getProviderUserId) och explicita feltyper (BOOKING_NOT_COMPLETED, ALREADY_REVIEWED).

### 3. Result-pattern ger typesaker error-hantering
Omojligt att glomma error-hantering -- TypeScript tvingar check pa `.isFailure`.

### 4. Atomic IDOR-skydd forbattrade sakerheten
Alla auth-aware metoder anvander userId/providerId i WHERE-clause (atomart). Ingen race condition mellan "hitta" och "uppdatera".

### 5. Select-first forhindrar datalackor
Alla repository-metoder anvander `select` (aldrig `include`). passwordHash kan aldrig lias genom nagot kodflode.

## Vad kan forbattras

### 1. PUT/DELETE-routes gar forbi service-lagret (HOGST PRIORITET)
[id]-routes anropar repository direkt istallet for ReviewService. Det gor route-testerna fragila (kopplade till Prisma P2025-mockar). POST-routen (via service) var robust.

**Losning:** Lagg till `updateReview()` och `deleteReview()` i ReviewService. Alla routes ska delegera till service.

### 2. Factory pattern behovs for DI
Inline `new ReviewService({ ... })` i varje route ar verbost (20+ rader boilerplate). For Booking (5+ deps) ar factory obligatoriskt.

**Losning:** Skapa `createReviewService()` factory. Anvannd fran start for Booking.

### 3. Error-mapping dupliceras
`mapErrorToStatus` finns i bade `route.ts` och `reply/route.ts`.

**Losning:** Flytta till domain-lagret (`ReviewService.ts` eller separat fil).

### 4. Mock-repo hardkodar relations
`MockReviewRepository.toRelations()` returnerar hardkodade "Test User" -- racker inte for notis-tester.

**Losning:** Mock-repo bor ta seedable relations (Map med kunder/providers).

### 5. UI-bugg hittades bara manuellt
Kunden sag inte leverantorens svar pa recensioner. Buggen fanns redan fore refaktoreringen.

**Losning:** E2E-test for "kund ser leverantorens svar" hade fangt den automatiskt.

## Rekommendationer for Booking-migrering

| # | Vad | Varfor |
|---|-----|--------|
| 1 | Factory pattern for DI | Booking har 5+ dependencies, inline DI ar ohantierbart |
| 2 | BookingStatus value object FORST | State machine-logik bor vara i VO, inte if-satser |
| 3 | Alla routes via service-lager | Undvik fragila route-tester (lardomar fran Review [id]) |
| 4 | Error-mapping i domain-lager | DRY, Booking har 5+ routes som behover samma mapping |
| 5 | Route-tester mockar service, inte Prisma | Battre separation, mer robust mot refactoring |
| 6 | E2E for kritiska floden | Create booking, confirm, customer view, cancel |

## Arkitektonisk bedomning

**Code size:** +1009 rader netto for Review (enkel domain). Acceptabelt -- testbarhet + sakerhet vager upp. Booking (mer komplex) kommer ha battre ROI.

**Risk:** LAG. Inga breaking changes, alla tester grona, monstret ar bevisat.

**Verdict:** DDD-Light validerat. Fortsatt med Booking enligt plan, applicera lardomar ovan.
