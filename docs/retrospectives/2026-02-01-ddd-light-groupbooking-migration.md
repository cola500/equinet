# Retrospektiv: GroupBooking DDD-Light Migration (Fas 1.3)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead (test-fokuserad review)
**Scope:** GroupBooking migrerad till repository + service + factory pattern
**Foregaende:** [Horse DDD-Light Migration (Fas 1.2)](./2026-02-01-ddd-light-horse-migration.md)

---

## Resultat

- 19 filer andrade, 2357 insertions, 965 deletions
- 5 nya filer (IGroupBookingRepository, PrismaGroupBookingRepository, MockGroupBookingRepository, index.ts, mapGroupBookingErrorToStatus)
- 14 modifierade filer (service omskriven, 8 routes migrerade, alla route-tester migrerade)
- 968/968 tester grona, 0 TypeScript-fel
- 25 nya service-tester med MockRepository (uppgraderat fran 3 Prisma-mock-tester)
- 95% domain service coverage

---

## Tech-architect: Vad gick bra

### 1. Aggregate-monstet var ratt val
GroupBookingRequest + GroupBookingParticipant som ett aggregat. Deltagare har ingen oberoende livscykel -- de kan inte existera utan en request. Alla participant-operationer gar genom requestens repository.

### 2. Factory pattern skalade med 5 dependencies
`createGroupBookingService()` wirer repo, invite code generator, notifications, provider lookup och service lookup. Inline-konstruktion i varje route hade blivit 8x repetition.

### 3. Centraliserad error-mapping (lardom fran Review)
1 fil (28 rader) istallet for duplicerade switch-satser i 8 routes. Lardomen fran Review-piloten (duplicerad `mapErrorToStatus`) applicerad direkt.

### 4. Atomic authorization i WHERE-clauses genomgaende
Alla 9 repository-query-metoder anvander `userId`/`creatorId`/`userType` i WHERE. IDOR-sakerhet omojlig att kringga.

### 5. $transaction stannar i repository
`matchAndCreateBookings()` hanterar transaktionslogiken. Service-lagret ser en enda metodanrop -- vet inget om Prisma.

### 6. Support-domaner (Provider, Service) kan anvanda Prisma direkt
`match/route.ts` behaller Prisma-import for provider/service-lookup. Pragmatiskt val -- bara 2 falt behovs, inget repository-overhead motiverat.

---

## Tech-architect: Forbattringsforslag

### 1. match/route.ts mixed dependency
Behaller Prisma for support-domain-lookups medan resten gar via service. Fungerar men blir inkonsekvent nar Provider migreras.

### 2. Saknar service unit-tester for alla domaner
GroupBooking har 25 tester -- men Review och Horse saknar motsvarande isolerade service-tester. Bor standardiseras.

---

## Test-lead: Styrkor

### 1. 95% domain service coverage
25 tester med MockRepository tacker alla 8 metoder: createRequest, listForUser, getById, listAvailableForProvider, updateRequest, joinByInviteCode, removeParticipant, matchRequest.

### 2. Behavior-based route-tester overlevde migreringen
Route-tester assertar HTTP-status + response shape, inte Prisma-anrop. Bara mock-imports behvode uppdateras -- assertions overlever refactoring.

### 3. Seedable MockRepository med test-helpers
`seedRequests()`, `seedParticipants()`, `seedUserNames()` for komplexa scenarion. `getAll()`, `getAllParticipants()`, `getCreatedBookingIds()` for verifikation.

### 4. Konsekvent service-mock-monster i alla route-tester
Alla 8 route-test-filer anvander samma monster:
```typescript
const mockService = { methodName: vi.fn() }
vi.mock('@/domain/group-booking/GroupBookingService', () => ({
  createGroupBookingService: () => mockService,
}))
```

---

## Test-lead: Gaps och forbattringar

### 1. Mixed mocks i match/route.test.ts (tech debt)
Mockar bade Prisma (provider/service lookup) OCH service. Fragilt -- gar sonder nar Provider migreras till DDD-Light.

**Rekommendation:** Dokumentera som tech debt. Abstrahera provider/service lookup till service-deps vid nasta migrering.

### 2. Edge-case-tester saknas
| Scenario | Testat? | Paverkan |
|----------|---------|----------|
| Rate limiting (429) | Nej | Kan missa rate-limit-bypass |
| Ogiltig JSON i request body | Bara i root route | Andra routes antar valid JSON |
| `mapGroupBookingErrorToStatus` default case | Nej | Okanda error-typer returnerar 500 tyst |
| Ovantade service-errors (500) | Nej | Generisk error-handling aldrig testat |

### 3. Error-mapping validerades inte i forvag
`PARTICIPANT_NOT_FOUND` -> 404 "emergerade" under migrering istallet for att designas medvetet. Led till forvirring om ratt status-kod.

**Lardom:** Definiera error-kontrakt (typ -> HTTP-status) FORE implementation, inte ad-hoc under testning.

### 4. Status-kod-mismatch vid migrering
Tva tester forvantade fel status:
- `participants/[pid]` forvantade 403, fick 404 (PARTICIPANT_NOT_FOUND -> 404, mer sakert)
- `match/route` forvantade 400, fick 404 (GROUP_BOOKING_NOT_FOUND -> 404)

Testerna fixades, men visar att error-mappings bor verifieras systematiskt vid migrering.

### 5. NotificationService-brus (ej blockerande)
GroupBooking loser detta via DI (injicerad mock). Men andra domaner (Booking, Review) har fortfarande Prisma-beroende notifikationer som ger brus i test-output. Samma injection-monster bor tillampas vid deras migrering.

---

## Konkreta actions

### Gor nu (latt)
- [ ] Lagg till kommentar i `match/route.test.ts` som dokumenterar mixed-mock tech debt
- [ ] Verifiera att alla error-mappings i `mapGroupBookingErrorToStatus` ar medvetna val

### Gor snart (medium)
- [ ] Lagg till edge-case-tester: rate limiting (429), invalid JSON, unknown errors (500)
- [ ] Definiera error-kontrakt FORE implementation for nasta domain-migrering

### Gor vid nasta migrering
- [ ] Abstrahera provider/service lookup till service-dependencies (eliminerar mixed mocks)
- [ ] Tillampa notification injection-monster pa Booking/Review
- [ ] Extrahera gemensamma test-fixtures till `tests/fixtures/`

---

## Learnings

Dessa learnings bor propageras till CLAUDE.md:

- **Aggregate-first design forenklar**: Request + Participant som ett aggregat eliminerade behovet av distribuerade transaktioner. Entiteter som andras tillsammans bor modelleras tillsammans.
- **Factory pattern obligatoriskt vid 5+ dependencies**: Inline-konstruktion i varje route ar omojligt att underhalla. Factory ger single source of truth for DI.
- **Definiera error-kontrakt fore implementation**: Ad-hoc error-mapping under testning ger forvirring om ratt HTTP-status. Bestam mappingen medvetet i forvag.
- **Mixed mocks ar tech debt**: Routes som mockar bade Prisma OCH service ar fragila. Dokumentera och planera bort.
- **Behavior-based route-tester overlever migrering**: 0 assertions behvode andras -- bara mock-imports uppdaterades. Testa HTTP-kontrakt, inte interna anrop.
- **MockRepository med seed-helpers ar snabbare an Prisma-mocks**: Mer forutsagbart, lattare att satta upp komplexa scenarion, och avsljar inte implementation-detaljer.
- **NotificationService DI loser test-brus**: Injicera mock istallet for att lata riktiga NotificationService anropa omockad Prisma.

---

## Test Quality Scorecard

| Metrik | Betyg | Kommentar |
|--------|-------|-----------|
| Coverage (Domain) | 9.5/10 | 95% -- utmarkt, saknar bara edge cases |
| Coverage (Routes) | 7.5/10 | 62-83% -- bra, saknar error-scenarion |
| Coverage (Repository) | 9/10 | 89% -- mycket bra |
| Behavior-based testing | 9/10 | Service-tester ar exemplariska |
| Mock-strategi | 7/10 | Service-mocks bra, Prisma-mocks i match fragilt |
| Test maintainability | 8/10 | Rent och konsekvent, men mixed mocks gor friction |
| Error handling | 6/10 | Happy paths tackta, edge cases saknas |
| **Totalt** | **8/10** | Solid test-suite, smarre forbattringar behovs |

---

*Skapad: 2026-02-01*
*Foregaende retrospektiv: [Horse DDD-Light Migration](./2026-02-01-ddd-light-horse-migration.md)*
*Refaktoreringsplan: [DDD-TDD-REFACTORING-PLAN.md](../DDD-TDD-REFACTORING-PLAN.md)*
