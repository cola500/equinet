# Retrospektiv: Horse DDD-Light Migration (Fas 1.2)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead, security-reviewer
**Scope:** Horse-domänen migrerad till repository + service + factory pattern
**Föregående:** [Review DDD-Light Pilot (Fas 1.1)](./2026-02-01-ddd-light-review-pilot.md)

---

## Resultat

- 7 routes migrerade till repository + service pattern
- 91 tester täcker alla kritiska flöden (CRUD, IDOR, auth, validation, access control)
- 34 nya domain-tester (497 rader) + route-tester (144 rader)
- Mönstret från Review-piloten återanvänt utan arkitekturbeslut

---

## Tech-architect: Vad gick bra

### 1. Mönsterkonsistens från Review-pilot accelererade arbetet
Samma Result pattern, factory, error mapping. Inga arkitekturbeslut att ta -- bara applicera bevisat mönster på ny domän.

### 2. Access control i domain-lagret
Provider-access (limited categories) och owner-access (full) lever i HorseService, inte utspridd i 7 route-filer. En ändring i access-logik = en fil att ändra.

### 3. select konsekvent i repository
Inga `include` -- förhindrar passwordHash-läckor. Samma princip som Review-piloten.

### 4. Error mapping DRY
1 fil (18 rader) istället för duplicerade switch-satser i varje route. Lärdomen från Review-piloten (duplicerad `mapErrorToStatus`) applicerad direkt.

### 5. Domain tests testar mer med mindre kod
34 tester (497 rader) vs route tests (144 rader för samma logik). Rätt abstraktionsnivå för varje test-typ.

## Tech-architect: Förbättringsförslag

### 1. Timeline-bygglogik duplicerad
`getTimeline()` och `exportData()` har nästan identisk merge-kod. Extrahera privat `buildTimeline(bookings, notes)` metod.

### 2. Datum-hantering med ternary
`instanceof Date ? toISOString() : String()` på flera ställen. MockRepository borde alltid returnera Date-objekt för konsistens.

### 3. Passport saknar validateToken
`createPassportToken()` finns men ingen `validatePassportToken()` -- behövs när passport-sidan använder tokenet.

---

## Test-lead: Styrkor

### 1. 91 tester täcker alla kritiska flöden
CRUD, IDOR, auth, validation, access control -- bred täckning.

### 2. MockRepository med seedable relations
`seedAuthorNames()` + `seedProviderBookings()` löste Review-pilot-problemet med hårdkodade "Test User". Seedable relations är nu standard.

### 3. Behavior-based route tests
Mockar factory, inte Prisma. Immuna mot schema-ändringar -- samma princip som bevisades i Review-piloten.

## Test-lead: Gaps att överbrygga

### 1. Provider access control inte testat i route-layer
Domain tests verifierar att provider får limited categories, men inga route-tester använder provider-session.

### 2. CSV export content inte validerat
Testar att `content-type: text/csv` returneras men inte att CSV-innehållet är korrekt.

### 3. Pagination (20 bookings limit) inte testat
`findByIdWithBookings` tar 20, men inget test verifierar detta.

### 4. Inkonsekvent routeContext
Timeline/notes-tester använder fast `routeContext`, medan export/passport använder `makeContext(id)` factory. Bör standardiseras till `makeContext(id)`.

---

## Security-reviewer: Bedömning

Security-reviewern flaggade 3 "kritiska" IDOR-problem, men efter verifiering mot faktisk kod är **alla felaktiga**:

| Flaggat problem | Verklighet |
|-----------------|------------|
| "TOCTOU i timeline" | `getTimeline()` anropar `findByIdForOwner(horseId, userId)` med atomärt WHERE -- inte separata queries |
| "Broken IDOR i note DELETE" | `deleteNote()` anropar `findByIdForOwner(horseId, ownerId)` -- ägarskap kontrolleras |
| "Broken IDOR i note UPDATE" | `updateNote()` anropar `findByIdForOwner(horseId, ownerId)` -- ägarskap kontrolleras |
| "Soft delete inkonsekvent" | `isActive: true` finns i ALLA 7 WHERE-clauses i HorseRepository |
| "Passport saknar expiration" | `PASSPORT_EXPIRY_DAYS = 30`, `expiresAt.setDate(expiresAt.getDate() + 30)` -- finns |

**Lärdom:** Security-reviewern hallucinerade kod som inte finns och missade att läsa den faktiska implementationen. Agenten verkar ha antagit en annan kodstruktur. **Verifiera alltid security-reviewer-output mot faktisk kod.**

### Verkligt valid observation
Rate limiting saknas på timeline- och notes-endpoints (bara horses, horses/[id], export och passport har det).

---

## Konkreta actions

### Gör nu (lätt)
- [ ] Standardisera `makeContext(id)` i alla route-tester (ej fast routeContext)
- [ ] Extrahera `buildTimeline()` privat metod i HorseService (DRY)

### Gör snart (medium)
- [ ] Lägg till rate limiting på timeline + notes routes
- [ ] Lägg till provider-session route-test för timeline endpoint
- [ ] Testa CSV export content (inte bara headers)

### Gör vid behov
- [ ] Lägg till `validatePassportToken()` när passport-sidan implementeras
- [ ] Testa pagination (20 bookings limit)

---

## Learnings

Dessa learnings bör propageras till CLAUDE.md:

- **Mönsterkonsistens accelererar**: Att kopiera Review-strukturen eliminerade arkitekturbeslut helt. Andra domänen tog märkbart kortare tid än piloten.
- **Seedable MockRepository är obligatoriskt** för komplex access control med flera användartyper (owner vs provider).
- **Domain service skalar till komplex logik**: Timeline (100+ rader i route) blev 73 rader i service med 100% coverage.
- **Error mapping i separat fil eliminerar duplicering direkt** (learning från Review applicerad).
- **Security-reviewer kan hallucinera** -- verifiera alltid mot faktisk kod. Agenten läste inte filerna korrekt.
- **Result pattern tvingar explicit error handling** -- verbost men eliminerar "glömda" fel-paths.
- **Domain tests testar mer med mindre kod än route tests.** Rätt abstraktionsnivå för varje test-typ.

---

*Skapad: 2026-02-01*
*Pilot-retrospektiv: [Review DDD-Light Pilot](./2026-02-01-ddd-light-review-pilot.md)*
*Refaktoreringsplan: [DDD-TDD-REFACTORING-PLAN.md](../DDD-TDD-REFACTORING-PLAN.md)*
