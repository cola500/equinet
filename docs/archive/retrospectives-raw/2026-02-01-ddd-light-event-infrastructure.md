# Retrospektiv: Event-infrastruktur for Booking (Fas 5)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead, security-reviewer
**Scope:** Domain event-infrastruktur + migrering av 3 booking-routes fran manuella sidoeffekter till event dispatch
**Foregaende:** [Test Coverage (Fas 4)](./2026-02-01-ddd-light-test-coverage.md)

---

## Resultat

- 8 nya filer, 5 andrade filer
- 21 nya tester (7 dispatcher + 14 handlers)
- 1110/1110 tester grona, 0 regressioner
- BookingService.ts (632 rader) OROERD
- ~100 rader manuella sidoeffekter ersatta med ~50 rader event dispatch

| Metric | Fore | Efter |
|--------|------|-------|
| Testfiler | 85 | 87 |
| Totalt tester | 1089 | 1110 |
| Sidoeffekt-rader i routes | ~100 | ~50 |
| Sidoeffekt-typer | 3 (email, notis, logg) | 3 (via 7 handlers) |

---

## Tech-architect: Vad gick bra

### 1. Generisk IDomainEvent med typsakerhet
`IDomainEvent<TPayload>` med generisk payload-typ loste TypeScript index signature-problem elegant. Factory-funktioner (`createBookingCreatedEvent()`) centraliserar event-skapande med automatisk `eventId` och `occurredAt`. Moduler design i `infrastructure/events/` gor det enkelt att ateranvanda for andra domaner.

### 2. Per-handler error isolation skyddar HTTP-response
`InMemoryEventDispatcher` wrapprar varje handler i egen try-catch -- ett failande email blockerar INTE notifikation eller HTTP 201. Veriferat med explicit test. 0 regressions i befintliga tester bevisar att isoleringen fungerar.

### 3. Serverless-safe factory pattern utan globalt state
`createBookingEventDispatcher({ emailService, notificationService, logger })` skapar dispatcher per request. DI via factory gor handlers testbara (14 tester, 0 Prisma-mocks). Konsistent med befintligt monster (`createBookingService()`, `createAuthService()`).

### 4. Flat payloads eliminerar databas-queries i handlers
Event payload innehaller allt handlers behover (`customerName`, `serviceName`, `providerUserId`). Handlers querier ALDRIG databasen. Trade-off: routes maste hamta lite extra data fore dispatch, men handlers blir snabbare och deterministiska.

### 5. Pragmatisk refactoring -- BookingService orordes
632 raders valtestad service INTE omskriven. Events emitteras fran routes EFTER service-anrop. "Klassisk DDD" hade emitterat events fran entity, men det kraver full omskrivning. Pragmatisk hybrid: 90% av vardet med 10% av risken.

---

## Tech-architect: Vad kunde vi gora battre

### 1. Event-payload-konstruktion dupliceras i routes
Routes maste manuellt hamta `providerUserId` och bygga payload -- riskerar inkonsistens mellan routes. En helper-funktion (`buildBookingCreatedPayload()`) hade centraliserat logiken.

### 2. Flat payloads kraver extra DB-queries i routes
For att fa `providerUserId` maste POST-routen gora separat query (`prisma.provider.findUnique()`). BookingService returnerar redan booking med relationer -- att query:a igen kans redundant. `BookingWithRelations` saknar `provider.userId`.

### 3. Ingen runtime-validering av payload-struktur
Factory-funktioner validerar INTE att payload matchar interface vid runtime. Om en route glommer ett falt upptacks det forst nar handler kor -- inte vid event-skapande.

---

## Test-lead: Testkvalitet

### 1. Behavior-based route-tester ar migreringsakra
POST /api/bookings behovde NOLL mock-andringar trots att hela side-effect-implementationen byttes ut. PUT-routen behovde bara 3 rader ny mock. Testa HTTP-kontrakt, inte implementation details.

### 2. Factory pattern for testdata skapar lasbar kod
`createdEvent()`, `statusChangedEvent()`, `paymentEvent()` med override-mojlighet ger koncisa tester. 14 handler-tester utan duplicerad testdata.

### 3. DI med mock-factories eliminerar vi.mock-komplexitet
`createMockEmailService()`, `createMockNotificationService()`, `createMockLogger()` ger full kontroll utan att mocka moduler. Handler-testerna ar rena unit tests med isolerade dependencies.

### 4. Error isolation ar explicit testad
InMemoryEventDispatcher-testet for "continues dispatching to other handlers when one handler throws" verifierar att ett failande email inte blockerar notification/logging.

---

## Test-lead: Coverage-gap

### 1. Handler-fel i route-tester ar osynliga
I route-tester failar email-handleren (stderr) men testet ar gront. Vi har ingen assertion att event dispatch lyckas. Overlag: route-tester testar HTTP-kontrakt, handler-tester testar handler-logik. Separation ar medveten.

### 2. Handler conditional logic saknar alla status-kombinationer
`StatusChangedEmailHandler` skippar pending (testat), men cancelled/completed ar inte explicit testade. `StatusChangedNotificationHandler` har provider/customer-logik -- alla kombinationer bor tackas.

### 3. Factory integration test saknar failure-path
`createBookingEventDispatcher`-testerna verifierar happy path men inte vad som hander om en handler kastar error i integrationstest.

---

## Security-reviewer: Sakerhetsstatus

**Generellt god sakerhet.** Event-infrastrukturen introducerar inga kritiska sarbarheter. Migration fran direkt notification-anrop till event-baserad arkitektur har genomforts utan sakerhetsregressioner. Error isolation fungerar korrekt.

### Identifierade risker

| Risk | Severity | Status |
|------|----------|--------|
| PII i event payload (customerName, serviceName) | Lag | Accepterad -- handlers loggar bara bookingId, inte payload |
| Ingen input-validering i dispatcher | Lag | Events skapas bara internt via factory-funktioner |
| Ingen handler-timeout for serverless | Medel | Accepterad for MVP -- email-funktioner har eget timeout |

### Positiva observations
- Factory-pattern ar safe for serverless -- inga singletons eller shared state
- Error isolation forhindrar att handler-failures propagerar till HTTP-response
- God separation of concerns -- routes anropar bara `dispatcher.dispatch()`

---

## Rekommendationer for nasta steg

| Prio | Rekommendation | Motivering |
|------|---------------|------------|
| 1 | Lagg till `providerUserId` i `BookingWithRelations` | Eliminerar separat DB-query i routes fore event dispatch |
| 2 | Skapa helper for payload-konstruktion | `buildBookingCreatedPayload(booking, session)` centraliserar logik, minskar duplikation |
| 3 | Komplettera handler-tester med alla status-kombinationer | Matris: pending->confirmed, confirmed->completed, confirmed->cancelled, etc. |
| 4 | Overval handler-timeout vid produktion | `Promise.race` med 5s timeout for varje handler i serverless |

---

## Nyckeltal

| Metric | Fore | Efter |
|--------|------|-------|
| Testfiler | 85 | 87 |
| Totalt tester | 1089 | 1110 |
| Event-handlers | 0 | 7 |
| Event-typer | 0 | 3 |
| Routes med manuella sidoeffekter | 3 | 0 |
| Routes med event dispatch | 0 | 3 |
