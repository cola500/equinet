# Vecka 4 Januari: Foundations (2026-01-21 -- 2026-01-30)

> Konsoliderad sammanfattning av 8 retrospectives från grundläggande arkitektur, säkerhet, CI/CD och feature implementation.

## Sammanfattning

| Session | Datum | Ämne | Resultat |
|---------|-------|------|----------|
| 1 | 2026-01-21 | Security & Architecture Review | 19 sårbarheter hittat, Production Readiness 6/10 → 8/10 |
| 2 | 2026-01-24 | CI/CD Improvements | ESLint flat config migration, lint strict, pre-push hooks |
| 3 | 2026-01-27 | Calendar & Exceptions (US-2b) | 4 API endpoints, Safari date parsing fix, TDD-gap identifierad |
| 4 | 2026-01-28 | E2E Test Review | 48 → 63 passerade tester, 5 flaky tester fixade, API-bug hittat |
| 5 | 2026-01-28 | Travel Time Feature | 100% test coverage domain, kalender-integration, geo-validering |
| 6 | 2026-01-29 | Parallelized Team Review | 36 filer loggers, 3 API:er rate limited, 656/656 tester gröna |
| 7 | 2026-01-30 | Ecosystem Integration | 3 sprints (CSV-export, Passport, Fortnox), 887 tester (+31), Gateway-pattern proven |
| 8 | 2026-01-30 | Group Booking Feature | 2 modeller, 7 API endpoints, 6 UI-sidor, sekventiell bokningslogik |

---

## Viktiga Learnings

### 1. Security & Architecture (Foundation)

**Problem identifierad:** Implementation utan adoption = dead code
**Exempel:** Repository-pattern implementerat i Sprint 1, men API-routes använde direkt Prisma.
**Lösning:** Refactorerade alla major endpoints att använda repositories.

**Key takeaway:** DoD måste inkludera "Används i production code" -- implementationen är bara hälften.

### 2. Authorization Checks Måste Vara Atomära

**Pattern:** Använd Prisma WHERE clause för auth, aldrig check-then-update:
```typescript
// ❌ DÅLIGT: Race condition möjlig
const booking = await prisma.booking.findUnique({ where: { id } })
if (booking.customerId !== userId) return 403
await prisma.booking.update(...)

// ✅ RÄTT: Atomärt med operation
await prisma.booking.update({
  where: { id, customerId: userId },  // Auth + operation samma transaktion
  ...
})
```

### 3. Serverless Gotchas

**In-memory state fungerar EJ i serverless:**
- ❌ Map, global variables (varje Vercel-instans har egen)
- ✅ Redis (Upstash), external datastores

**Rate limiting:** Migrerat från in-memory till Upstash Redis (production blocker).

### 4. E2E Tester Avslöjar API-Buggar

Availability API saknade `address`-fält i routeStop.create() -- bug hade aldrig upptäckts utan E2E-testet. Unit tests mockar ofta bort Prisma-anrop.

**Pattern:** E2E-tester fångar integration-level fel som unit tests missar.

### 5. Safari Date Parsing Bug

**Problem:** `new Date("YYYY-MM-DD")` tolkas som UTC i Safari, ger fel datum.
**Lösning:**
```typescript
const [year, month, day] = dateStr.split("-").map(Number)
return new Date(year, month - 1, day)
```

**Learning:** Löste root cause, inte bara symptom.

### 6. TDD Inte Alltid Prioriterad

**Gap:** Availability exceptions saknade unit tests för API routes (bryter TDD-principen).
**Implikation:** Regressions upptäcks inte automatiskt.
**Target:** >= 80% coverage för API routes.

**Lösning:** Nästa sprint -- skriv tester FÖRST, även om det känns långsammare.

### 7. Agent Workflow för Större Ändringar

**Pattern:**
```
Fas 1: REVIEW (Parallel)
└─ security-reviewer + tech-architect körs samtidigt
└─ Hittar 19 kritiska problem + arkitekturella inkonsistenser

Fas 2: PRIORITIZE
└─ Granska rapporter, identifiera blockers

Fas 3: IMPLEMENT (Sequential)
└─ Fixa kritiska problem i prioritetsordning

Fas 4: VERIFY
└─ Tests + TypeScript check
```

**Learning:** Använd agenter för discovery, inte bara execution.

### 8. Monitoring är EJ Optional för Production

**Innan:** Ingen Sentry, ingen external logging.
**Problem:** Kan EJ diagnosticera production issues eller se performance bottlenecks.
**Action:** Sentry setup inkluderad i DoD för production deployment.

**Learning:** Monitoring ska vara del av MVP, inte "nice-to-have".

### 9. Gateway-Pattern Skalerar

`IAccountingGateway` + `MockAccountingGateway` följde samma mönster som `IPaymentGateway`. Att ha ett beprövat mönster att kopiera från sparade tid och säkerställde konsistens.

**Learning:** Pattern-templates för nya integrations = snabbare + konsistentare kod.

### 10. Schema-Först-Approach Fungerar

Tre sprints med schema-ändringar (HorsePassportToken, Upload, FortnoxConnection) gick smidigt med `prisma db push`. Varje sprint byggde på det föregående utan konflikter.

**Learning:** Databasschema är source of truth. Börja där.

### 11. Test-Isolation är Kritiskt

**Pattern:** Använd unika identifiers i E2E-tester:
```typescript
// RÄTT
await page.fill('[name="businessName"]', `E2E Provider ${Date.now()}`);
```

**Problem:** Duplicerad "Test Stall AB" i seed + dynamiskt skapade providers orsakade flaky tester.

### 12. FormData i Vitest är Fragilt

JSDOM-miljöns stöd för `FormData` + `File` är begränsat. Upload-testerna krävde mocking av `request.formData()` istället för att skicka riktig FormData.

**Learning:** Dokumentera detta mönster för framtida API-routes med FormData.

### 13. Invite Code Design

Exkludera tvetydiga tecken (0/O, 1/I/L) från koder gör dem lättare att dela verbalt och skriva in manuellt. `crypto.randomBytes()` ger kryptografisk säkerhet.

**Pattern:** 8-teckens URL-safe kod + länk-delning (`/join?code=ABC12345`).

### 14. Sekventiell Bookingslogik är Ren

Att skapa bokningar i rad (participant 1: 09:00-09:45, participant 2: 09:45-10:30) baserat på service.durationMinutes är klart och begripligt för gruppbokningar.

### 15. Nya Features Behöver Svenska Tecken Check

Återkommande problem: UI-sidor saknade å, ä, ö. Troligen skrivet på mobil eller terminal utan svenskt tangentbord.

**Learning:** Etablera standard tangentbords-setup för utveckling.

---

## Nyckelmetrik

### Kodkvalitet
| Metric | Värde |
|--------|-------|
| Unit tests (start → slut veckan) | 420 → 887 |
| TypeScript errors | 0 |
| E2E tester passerade | 63 (från 48, +15) |
| Lint warnings | 283 (acceptabelt) |
| Coverage mål API routes | 80% (saknas för exceptions) |

### Production Readiness
| Aspekt | Innan | Efter |
|--------|-------|-------|
| Rate limiting serverless-compatible | ❌ | ✅ Upstash Redis |
| Authorization atomic checks | ❌ | ✅ WHERE clause |
| Monitoring setup | ❌ | ✅ Sentry ready |
| IDOR vulnerabilities | ✅ Present | ❌ Fixed |
| Repository pattern adoption | 0% | 100% (major APIs) |
| Production Readiness Score | 6/10 | 8/10 |

### Feature Implementation
| Feature | API endpoints | Models | UI pages | Tests |
|---------|---------------|--------|----------|-------|
| Calendar exceptions | 4 | 1 | 1 | 0 ⚠️ |
| Travel time | 1 (updated) | 0 | 1 | 71 (domain) |
| Ecosystem integration | 10 | 3 | 3 | 31 new |
| Group bookings | 7 | 2 | 6 | Multiple |

### Risk Register
| Risk | Severity | Status | Mitigation |
|------|----------|--------|-----------|
| TypeScript errors ignored in build | High | 🟡 Partial | `ignoreBuildErrors` removed, but 40+ pre-existing errors remain |
| TDD gap (Calendar exceptions) | High | 🔴 Open | Sprint 3: Write tests FIRST |
| Data exposure not audited | High | 🟡 Partial | Repositories use `select`, but no systematic audit |
| E2E not in CI | Medium | 🔴 Open | Sprint 3: Add E2E to CI + branch protection |
| Flaky E2E tests | Medium | 🟢 Fixed | 5 flaky tester fixed, global-hooks documented |

---

## Process Improvements Introducerade

### 1. Pre-Merge Security Gate (Ny)
```
Innan production deployment:
1. Kör security-reviewer (mandatory)
2. Kör tech-architect (mandatory)
3. Fix ALL critical + high severity issues
```

### 2. Agent-Driven Exploration (Ny)
- Explore-agent kartlägger nuläget före planering
- Security + Tech architecture granskningar parallellt
- Implement-rundor med tydlig prioritering

### 3. Verification Between Rounds (Ny)
- `typecheck` + `test:run` efter varje implementation-runda
- Fångar problem tidigt istället för att ackumuleras

### 4. CI/CD Synkad Med Lokala Checks (Förbättrad)
- Pre-push hooks: lint + tests + typecheck
- GitHub workflows i sync
- Branch protection ready (manuell aktivering)

---

## Teknikval & Patterns Etablerade

| Område | Teknik | Motivering |
|--------|--------|-----------|
| Rate limiting | Upstash Redis | Serverless-compatible |
| Authorization | WHERE clause atomicity | Förhindrar TOCTOU |
| Domain services | TravelTimeService, GroupBookingService | Testbar, återanvändbar logik |
| Value objects | Location | Immutable, validering vid skapande |
| External integrations | Gateway pattern + DI | Mockable, testable |
| CSV export | `objectsToCsv` utility | Ingen extern dependency |
| Passport tokens | `crypto.randomBytes(32).hex` | 64-char URL-safe |
| Image compression | `browser-image-compression` | Client-side, minskar serverbelastning |

---

## Action Items Sprint 3+ (Prioriterad)

### MUST (Kritisk tech debt)
- [ ] Skriv unit tests för calendar exceptions API routes (80% coverage)
- [ ] Aktivera Upstash Redis credentials i Vercel (5 min)
- [ ] Aktivera Sentry DSN i Vercel (5 min)
- [ ] Fix alla TypeScript errors (2-3h) + ta bort `ignoreBuildErrors`
- [ ] E2E i CI + branch protection aktivering (2-3h)

### SHOULD (Medium prioritet)
- [ ] Systematisk data exposure audit av ALLA API endpoints
- [ ] Konsolidera seed-filer (`seed.ts` + `seed-test-users.ts`)
- [ ] Aktivera `global-hooks.ts` i playwright.config
- [ ] Extrahera `parseDate` till `src/lib/date-utils.ts`

### COULD (Lägre prioritet)
- [ ] Performance benchmark Haversine vs PostGIS
- [ ] PostgreSQL geo-queries (ersätt Haversine i app-layer)
- [ ] Health check endpoint för uptime monitoring
- [ ] Fortnox sandbox-konto för E2E OAuth-verifiering

---

## Reflektioner

### Vad Fungerade Verkligen Bra
1. **Parallel agent execution** -- Security + architecture review samtidigt sparade tid och täckte både domain
2. **Behavior-based testing** -- Överlevde refactoring utan ändringar (test-contract över implementation)
3. **Schema-först approach** -- Klara databasscheman ledde till bra API-design
4. **Incremental fixes** -- Fixade ett problem i taget, testade mellan varje
5. **Gateway pattern för integrations** -- Mockable, testable, konsistent

### Största Överraskningar
1. **Repository pattern var dead code** -- Implementerat men EJ använt i API-routes
2. **E2E avslöjade API-bug** -- Saknade `address`-fält hade aldrig upptäckts med unit tests
3. **TDD-gap på nya features** -- Availability exceptions helt otestade, bryter CLAUDE.md
4. **Test isolation är knepigt** -- Duplicerade providers + flaky timing orsakade E2E-problem

### Vad Vi Skulle Göra Annorlunda
1. **Run security review TIDIGARE** -- Efter Sprint 1, inte Sprint 2
2. **Monitoring from day 1** -- Sentry i MVP, inte "later"
3. **TypeScript strict mode från start** -- Fix errors löpande
4. **E2E i CI från dag ett** -- Inte optional
5. **Explore-agent före planning** -- Kartlägg nuläget innan prioritering

---

## Framåtblick

**Nästa vecka:** Production Hardening Sprint
**Fokus:** Aktivera monitoring + fix technical debt + E2E i CI
**Komplexitet:** 2XS + 2S + 2M = ~12h

**Teman som fortsätter:**
- DDD-Light arkitektur + repositories för kärndomäner
- TDD (RED → GREEN → REFACTOR) för API routes + domain services
- Serverless-compatibility checks (Redis, ej in-memory)
- Agent-driven architecture reviews (proaktivt, inte reaktivt)

---

*Originaldokument: [docs/archive/retrospectives-raw/](../archive/retrospectives-raw/)*

**Konsoliderat av:** Claude Code
**Datum:** 2026-02-28
**Perioden täcker:** 8 retrospectives från Security Review, CI/CD, Calendar, E2E, Travel Time, Team Review, Ecosystem Integration, och Group Booking features.
