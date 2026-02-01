# Retrospektiv: Horse DDD-Light Migration (Fas 1.2)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead, security-reviewer
**Scope:** Horse-domanen migrerad till repository + service + factory pattern
**Foregaende:** [Review DDD-Light Pilot (Fas 1.1)](./2026-02-01-ddd-light-review-pilot.md)

---

## Resultat

- 7 routes migrerade till repository + service pattern
- 91 tester tacker alla kritiska floden (CRUD, IDOR, auth, validation, access control)
- 34 nya domain-tester (497 rader) + route-tester (144 rader)
- Monstret fran Review-piloten ateranvant utan arkitekturbeslut

---

## Tech-architect: Vad gick bra

### 1. Monsterkonsistens fran Review-pilot accelererade arbetet
Samma Result pattern, factory, error mapping. Inga arkitekturbeslut att ta -- bara applicera bevisat monster pa ny doman.

### 2. Access control i domain-lagret
Provider-access (limited categories) och owner-access (full) lever i HorseService, inte utspridd i 7 route-filer. En andring i access-logik = en fil att andra.

### 3. select konsekvent i repository
Inga `include` -- forhindrar passwordHash-lackor. Samma princip som Review-piloten.

### 4. Error mapping DRY
1 fil (18 rader) istallet for duplicerade switch-satser i varje route. Lardomen fran Review-piloten (duplicerad `mapErrorToStatus`) applicerad direkt.

### 5. Domain tests testar mer med mindre kod
34 tester (497 rader) vs route tests (144 rader for samma logik). Ratt abstraktionsniva for varje test-typ.

## Tech-architect: Forbattringsforslag

### 1. Timeline-bygglogik duplicerad
`getTimeline()` och `exportData()` har nastan identisk merge-kod. Extrahera privat `buildTimeline(bookings, notes)` metod.

### 2. Datum-hantering med ternary
`instanceof Date ? toISOString() : String()` pa flera stallen. MockRepository borde alltid returnera Date-objekt for konsistens.

### 3. Passport saknar validateToken
`createPassportToken()` finns men ingen `validatePassportToken()` -- behovs nar passport-sidan anvander tokenet.

---

## Test-lead: Styrkor

### 1. 91 tester tacker alla kritiska floden
CRUD, IDOR, auth, validation, access control -- bred tackning.

### 2. MockRepository med seedable relations
`seedAuthorNames()` + `seedProviderBookings()` loste Review-pilot-problemet med hardkodade "Test User". Seedable relations ar nu standard.

### 3. Behavior-based route tests
Mockar factory, inte Prisma. Immuna mot schema-andringar -- samma princip som bevisades i Review-piloten.

## Test-lead: Gaps att overbrygga

### 1. Provider access control inte testat i route-layer
Domain tests verifierar att provider far limited categories, men inga route-tester anvander provider-session.

### 2. CSV export content inte validerat
Testar att `content-type: text/csv` returneras men inte att CSV-innehallet ar korrekt.

### 3. Pagination (20 bookings limit) inte testat
`findByIdWithBookings` tar 20, men inget test verifierar detta.

### 4. Inkonsekvent routeContext
Timeline/notes-tester anvander fast `routeContext`, medan export/passport anvander `makeContext(id)` factory. Bor standardiseras till `makeContext(id)`.

---

## Security-reviewer: Bedomning

Security-reviewern flaggade 3 "kritiska" IDOR-problem, men efter verifiering mot faktisk kod ar **alla felaktiga**:

| Flaggat problem | Verklighet |
|-----------------|------------|
| "TOCTOU i timeline" | `getTimeline()` anropar `findByIdForOwner(horseId, userId)` med atomart WHERE -- inte separata queries |
| "Broken IDOR i note DELETE" | `deleteNote()` anropar `findByIdForOwner(horseId, ownerId)` -- agarskap kontrolleras |
| "Broken IDOR i note UPDATE" | `updateNote()` anropar `findByIdForOwner(horseId, ownerId)` -- agarskap kontrolleras |
| "Soft delete inkonsekvent" | `isActive: true` finns i ALLA 7 WHERE-clauses i HorseRepository |
| "Passport saknar expiration" | `PASSPORT_EXPIRY_DAYS = 30`, `expiresAt.setDate(expiresAt.getDate() + 30)` -- finns |

**Lardom:** Security-reviewern hallucerade kod som inte finns och missade att lasa den faktiska implementationen. Agenten verkar ha antagit en annan kodstruktur. **Verifiera alltid security-reviewer-output mot faktisk kod.**

### Verkligt valid observation
Rate limiting saknas pa timeline- och notes-endpoints (bara horses, horses/[id], export och passport har det).

---

## Konkreta actions

### Gor nu (latt)
- [ ] Standardisera `makeContext(id)` i alla route-tester (ej fast routeContext)
- [ ] Extrahera `buildTimeline()` privat metod i HorseService (DRY)

### Gor snart (medium)
- [ ] Lagg till rate limiting pa timeline + notes routes
- [ ] Lagg till provider-session route-test for timeline endpoint
- [ ] Testa CSV export content (inte bara headers)

### Gor vid behov
- [ ] Lagg till `validatePassportToken()` nar passport-sidan implementeras
- [ ] Testa pagination (20 bookings limit)

---

## Learnings

Dessa learnings bor propageras till CLAUDE.md:

- **Monsterkonsistens accelererar**: Att kopiera Review-strukturen eliminerade arkitekturbeslut helt. Andra domanen tog markbart kortare tid an piloten.
- **Seedable MockRepository ar obligatoriskt** for komplex access control med flera anvandartyper (owner vs provider).
- **Domain service skalar till komplex logik**: Timeline (100+ rader i route) blev 73 rader i service med 100% coverage.
- **Error mapping i separat fil eliminerar duplicering direkt** (learning fran Review applicerad).
- **Security-reviewer kan hallucera** -- verifiera alltid mot faktisk kod. Agenten laste inte filerna korrekt.
- **Result pattern tvingar explicit error handling** -- verbost men eliminerar "glomda" fel-paths.
- **Domain tests testar mer med mindre kod an route tests.** Ratt abstraktionsniva for varje test-typ.

---

*Skapad: 2026-02-01*
*Pilot-retrospektiv: [Review DDD-Light Pilot](./2026-02-01-ddd-light-review-pilot.md)*
*Refaktoreringsplan: [DDD-TDD-REFACTORING-PLAN.md](../DDD-TDD-REFACTORING-PLAN.md)*
