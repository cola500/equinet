# CLAUDE.md - Utvecklingsguide för Equinet

> **Hur** vi arbetar i projektet. För **vad** som är byggt, se README.md.

## Snabbreferens

| Vad du söker | Gå till |
|--------------|---------|
| Setup & Kommandon | [README.md](README.md) |
| Vanliga Gotchas | [docs/GOTCHAS.md](docs/GOTCHAS.md) |
| Agent-Team | [docs/AGENTS.md](docs/AGENTS.md) |
| Production Deploy | [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) |
| Bokningsflöde & Betalning | [docs/SERVICE-BOOKING-FLOW.md](docs/SERVICE-BOOKING-FLOW.md) |
| Tidigare Retros | [docs/retrospectives/](docs/retrospectives/) |
| Sprint-historik | [docs/sprints/](docs/sprints/) |
| Säkerhetsaudit | [docs/SECURITY-REVIEW-2026-01-21.md](docs/SECURITY-REVIEW-2026-01-21.md) |
| Användarforskning | [docs/user-research/](docs/user-research/) |

---

## Projekt

- **Stack**: Next.js 16 (App Router) + TypeScript + Prisma + NextAuth v5 + shadcn/ui
- **Språk**: Svenska (UI/docs), Engelska (kod)
- **Approach**: DDD-Light, TDD, Feature branches
- **Databas**: Supabase (PostgreSQL)

## Workflow

### Feature Implementation (Databas-först + TDD)

1. **Planering**: Schema -> API -> UI
2. **TDD-cykel**: Red -> Green -> Refactor
3. **Feature branch**: `git checkout -b feature/namn`
4. **Merge till main**: Efter alla tester är gröna
5. **Push**: Till remote

### Release & Versionshantering

```bash
npm run release              # Auto-detect (patch/minor/major)
npm run release:minor        # Force minor bump
npm run release:major        # Force major bump
git push --follow-tags origin main
```

**Commit-typer:** `feat:` -> Minor, `fix:` -> Patch, `BREAKING CHANGE:` -> Major

---

## Testing (TDD är Obligatoriskt!)

### TDD-cykeln

```
1. RED:    Skriv test som failar
2. GREEN:  Skriv minsta möjliga kod för att passera
3. REFACTOR: Förbättra utan att bryta test
```

**Claude ska:**
1. Visa dig testet INNAN implementation
2. Köra testet (verifiera att det failar)
3. Implementera
4. Köra testet igen (verifiera grönt)

### Skriv tester FÖRST för:
- API routes (högst prioritet!)
- Domain services och affärslogik
- Utilities och hooks

**Coverage-mål:** API Routes >= 80%, Utilities >= 90%, Overall >= 70%

### Behavior-Based Testing (API Routes)

Testa **vad** API:et gör, inte **hur** det gör det.

```typescript
// BAD: Implementation-based
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({ include: { services: true } })
)

// GOOD: Behavior-based
expect(response.status).toBe(200)
expect(data[0]).toMatchObject({
  id: expect.any(String),
  businessName: expect.any(String),
})

// MANDATORY: Security assertions
expect(data[0].user.passwordHash).toBeUndefined()
```

**Varför?** Tester överlever refactorings, testar API-kontrakt, fångar säkerhetsproblem.

---

## Kritiska Patterns

### API Route Pattern

```typescript
export async function POST(request: Request) {
  try {
    // 1. Auth
    const session = await auth()
    if (!session) return new Response("Unauthorized", { status: 401 })

    // 2. Parse JSON med error handling
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // 3. Validera med Zod
    const validated = schema.parse(body)

    // 4. Authorization check (atomärt i WHERE clause!)
    // 5. Databas-operation
    const result = await prisma.model.create({ data: validated })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error:", error)
    return new Response("Internal error", { status: 500 })
  }
}
```

### Filstruktur

```
src/app/api/[feature]/
├── route.ts              # GET, POST
├── route.test.ts         # Tester
├── [id]/
│   ├── route.ts          # GET, PUT, DELETE
│   └── route.test.ts
```

---

## Arkitektur (DDD-Light)

Vi använder Domain-Driven Design pragmatiskt - inte dogmatiskt.

### Lagerstruktur

```
src/
├── app/api/          # Routes - ENDAST http-hantering, delegerar till services
├── domain/           # Affärslogik, entiteter, value objects
├── infrastructure/   # Repositories, externa tjänster
└── lib/              # Utilities utan affärslogik
```

### När använda vad

| Komplexitet | Approach | Exempel |
|-------------|----------|---------|
| **Enkel CRUD** | Prisma direkt i route | Hämta lista, enkel update |
| **Affärslogik** | Domain Service | Bokningsvalidering, prisberäkning |
| **Komplex entitet** | Domain Entity | Booking, Provider |
| **Validering med regler** | Value Object | TimeSlot, Money, Location |

### Repository Pattern (OBLIGATORISKT för kärndomäner)

```typescript
// RÄTT: Route använder repository
const booking = await bookingRepository.findById(id)

// FEL: Route använder Prisma direkt för kärndomän
const booking = await prisma.booking.findUnique({ where: { id } })
```

**Kärndomäner** (måste använda repository): `Booking`, `Provider`, `Service`
**Stöddomäner** (Prisma OK): `AvailabilityException`, `AvailabilitySchedule`

### Domain Service Pattern

Använd när logik:
- Spänner över flera entiteter
- Innehåller affärsregler
- Behöver återanvändas

```typescript
// src/domain/booking/BookingService.ts
class BookingService {
  constructor(
    private bookingRepo: IBookingRepository,
    private providerRepo: IProviderRepository
  ) {}

  async createBooking(dto: CreateBookingDTO): Promise<Result<Booking, BookingError>> {
    // 1. Validera provider finns
    // 2. Kolla överlapp
    // 3. Skapa bokning
    // 4. Returnera Result (inte throw)
  }
}
```

### Checklista för ny feature

- [ ] Är det en kärndomän? → Använd repository
- [ ] Finns affärslogik? → Lägg i domain service
- [ ] Behövs validering? → Överväg value object
- [ ] Enkel CRUD? → Prisma direkt är OK

---

## Refactoring Guidelines

Principer som vägleder refactoring-beslut i projektet.

### 1. Start Minimal - Lös det faktiska problemet

- Identifiera det **specifika problemet** innan du börjar arkitektera lösningar
- Fråga: "Kan detta lösas genom att **ta bort kod**?" innan du lägger till abstraktioner
- Inkrementella förbättringar > kompletta omskrivningar
- Exempel: Förvirrande logik? Ta bort den förvirrande delen, bygg inte om allt

### 2. Respektera befintliga patterns

**Detta projekt använder:**
- Prisma direkt för enkel CRUD, repository för kärndomäner
- Server Components som default, Client Components vid behov
- Zod för validering (client + server)
- shadcn/ui komponenter

**Introducera INTE nya patterns** (Redux, Zustand, custom hooks för allt, etc.) utan diskussion.

Konsistens med befintlig kod > "best practices" från andra projekt.

### 3. Filgranularitet

- **1 välorganiserad 300-rads fil > 10 små 30-rads filer**
- Navigationsoverhead är verklig - varje filuppdelning har en kognitiv kostnad
- **Locality of behavior**: Att se relaterad kod tillsammans hjälper förståelsen
- Använd kommentarer (`// ---` eller regions) för organisation inom filer först
- Dela bara upp filer när de överstiger ~400-500 rader eller har genuint oberoende ansvar

**Undantag för React:** En komponent per fil är OK när komponenten är återanvändbar eller har egen state-logik.

### 4. Komponentextrahering

Extrahera komponenter när:
- **Återanvänds 3+ gånger** ELLER
- **Genuint komplex** (100+ rader med egen logik)

| Situation | Åtgärd |
|-----------|--------|
| Button med custom styling, används 2 ggr | Behåll inline |
| 100-rads formulär med validering | Överväg extrahering |
| 15-rads loading spinner | Behåll inline |
| Komplex datatabell med sortering | Extrahera |

**Mikro-komponenter (10-20 rader) motiverar sällan egna filer.**

### 5. Simplicity Hierarchy

**Simple > Complex > Complicated**

| Nivå | Beskrivning | Mål |
|------|-------------|-----|
| **Simple** | Lätt att förstå, uppenbart beteende | Alltid målet |
| **Complex** | Intrikat men nödvändig | Acceptabelt när krav motiverar |
| **Complicated** | Onödigt svårt att förstå | Undvik - ofta från over-engineering |

### 6. Före större ändringar - diskutera först

Diskutera alltid innan implementation av:
- Arkitekturella ändringar (nya patterns, stora omstruktureringar)
- Nya beroenden eller ramverk
- Ändringar som påverkar hur andra utvecklare arbetar

**När osäker:** Föreslå planen, visa alternativ, få buy-in först.

---

## Top 5 Gotchas

> Fullständig lista: [docs/GOTCHAS.md](docs/GOTCHAS.md)

| # | Problem | Lösning |
|---|---------|---------|
| 1 | Next.js 16 params | `await params` (Promise!) |
| 2 | Zod errors | Använd `error.issues`, inte `error.errors` |
| 3 | Rate limiting i serverless | Upstash Redis (INTE in-memory) |
| 4 | IDOR vulnerability | Authorization i WHERE clause (atomärt) |
| 5 | Prisma over-fetching | Använd `select`, inte `include` |

---

## Definition of Done

En feature är **DONE** när:

### 1. Funktionalitet
- [ ] Fungerar som förväntat (manuellt testad)
- [ ] Inga TypeScript-fel (`npm run typecheck`)
- [ ] Inga console errors
- [ ] Responsiv (desktop)

### 2. Kod-kvalitet
- [ ] Följer projektkonventioner
- [ ] Säker (ingen XSS, SQL injection, etc.)
- [ ] Error handling (try-catch, loggar fel)
- [ ] Zod-validering (client + server)

### 3. Git (Feature Branch Workflow)
- [ ] Feature branch skapad (`feature/namn`)
- [ ] Committed med beskrivande message
- [ ] **Alla tester gröna INNAN merge** (unit + E2E)
- [ ] Mergad till main, pushad till remote

### 4. Testing (TDD)
- [ ] Unit tests skrivna FÖRST
- [ ] E2E tests uppdaterade
- [ ] Coverage >= 70%

### 5. Dokumentation
- [ ] README.md uppdaterad (nya modeller, features, API-struktur, testantal)
- [ ] docs/API.md uppdaterad (nya endpoints)
- [ ] BACKLOG.md uppdaterad (implementerat-sammanfattning)
- [ ] CLAUDE.md Key Learnings uppdaterad (nya insikter från implementationen)

---

## Production Readiness Checklist

> Fullständig guide: [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md)

### Security (MANDATORY)
- [x] Rate limiting använder Redis (Upstash)
- [ ] Authorization checks är atomära (i WHERE clause)
- [ ] Ingen PII/känslig data exponeras i publika API endpoints
- [ ] All user input är validerad (Zod client + server)

### Monitoring (HIGHLY RECOMMENDED)
- [x] Sentry DSN konfigurerad
- [x] UptimeRobot konfigurerad
- [ ] Error tracking verifierat

### Environment Variables (MANDATORY)
```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://..."
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
NEXT_PUBLIC_SENTRY_DSN="https://..."
```

---

## Debugging (UI -> DB)

```
UI Layer (Browser console, React DevTools)
   |
Client Layer (Network tab - request/response)
   |
API Layer (Server console logs)
   |
Database Layer (Prisma Studio)
```

**Checklist när något failar:**
1. Browser console - errors?
2. Network tab - request skickad? response?
3. Server terminal - loggas något?
4. Prisma Studio - finns data?

---

## Säkerhet

### Implementerat
- bcrypt password hashing, HTTP-only cookies, CSRF protection
- SQL injection protection (Prisma), XSS protection (React)
- Input validation (Zod client + server)
- Authorization checks (session + ownership)

### Checklist för Nya API Routes
- [ ] Session check
- [ ] Input validation (Zod)
- [ ] Ownership check (i WHERE clause!)
- [ ] Error handling (Zod, Prisma, JSON parsing)
- [ ] Strukturerad logging (`logger` från `@/lib/logger`, INTE `console.*`)
- [ ] Rate limiting (via `rateLimiters` från `@/lib/rate-limit`)

---

## Agent-Team (Quick Reference)

> Fullständig guide: [docs/AGENTS.md](docs/AGENTS.md)

| Agent | Använd när |
|-------|------------|
| **security-reviewer** | Efter nya API endpoints, före produktion |
| **cx-ux-reviewer** | Efter UI-implementering, användarresor |
| **tech-architect** | Nya features, performance-problem |
| **test-lead** | Efter feature-implementation, coverage-gap |
| **data-architect** | Nya datamodeller, query-optimering |
| **quality-gate** | Före merge, före release |
| **performance-guardian** | Performance-problem, monitoring-design |

**Quick Reference:**
```
Nya features?        -> tech-architect + data-architect + test-lead
Performance issue?   -> performance-guardian + data-architect
Säkerhetsaudit?      -> security-reviewer
Före merge?          -> quality-gate
```

---

## Key Learnings

### Next.js 16 + React 19 + NextAuth v5 Upgrade (2026-01-22)
- `params` är nu `Promise` i dynamic routes (måste awaitas)
- NextAuth: `auth()` ersätter `getServerSession(authOptions)`
- Test mocks måste uppdateras från `next-auth` -> `@/lib/auth`
- Repository pattern + behavior-based tests minimerade uppgraderings-impact

### SQLite -> PostgreSQL Migration (2026-01-21)
- SQLite fungerar inte i serverless (Vercel)
- Använd Session Pooler (IPv4) för serverless kompatibilitet

### Performance & Skalbarhet
- Database indexes är framtidssäkring (20 min -> 10-30x snabbare)
- Prisma `select` vs `include` är **både** performance + säkerhet
- Mät baseline -> Förväntat vid skalning -> Verifiera efter fix

### Development
- TDD fångar buggar tidigt, bättre design
- Databas-först -> typsäkerhet hela vägen
- JSON parsing i API routes MÅSTE ha try-catch

### TypeScript Memory Issues (2026-01-23)
- `npx tsc --noEmit` kraschar med "heap out of memory" på stora projekt
- Lösning: `tsconfig.typecheck.json` som exkluderar testfiler och använder incremental builds
- Använd alltid `npm run typecheck` istället för `npx tsc --noEmit`
- Pre-push hooken är redan konfigurerad korrekt

### ESLint + Next.js 16 (2026-01-24)
- FlatCompat skapar circular structure med react-hooks plugin
- Lösning: Använd direkta plugin-importer i `eslint.config.mjs`
- `prefer-const` gäller även objekt som muteras (variabeln reassignas aldrig)

### GitHub Workflow Permissions (2026-01-24)
- Ändring av `.github/workflows/` kräver `workflow` scope
- Fix: `gh auth login --scopes workflow`

### Database Seeding & Sessions (2026-01-26)
- `npm run db:seed:force` raderar ALLA användare - aktiva sessioner blir ogiltiga
- Användare måste logga ut/in efter reseed för att få giltigt session-ID
- Zod `z.string().datetime()` kräver fullständigt ISO-format - använd flexibel validering för datumfält
- Prisma P2003 (foreign key) fel: logga alltid vilken constraint som failar, inte anta

### E2E Test Best Practices (2026-01-28)
- **Timing**: Undvik `waitForTimeout()` - använd explicit waits med `Promise.race()` eller `waitFor({ state: 'visible' })`
- **Test isolation**: Använd unika identifiers med timestamp (`Date.now()`) för dynamiskt skapad data
- **Flexibla assertions**: Testa beteende (`toBeLessThan`) istället för exakta värden (`toBe(5)`)
- **Fixtures**: Importera `test, expect` från `./fixtures` för automatisk afterEach cleanup
- **Unit vs E2E**: ErrorState/useRetry testas bättre som unit tests - E2E med API-blocking är fragilt

### Travel Time Kalender-integration (2026-01-29)
- **Kontrollera Prisma-schema först**: Antog att Booking hade lat/lng, men de finns på User. Verifiera alltid datamodellen innan implementation.
- **Datum-jämförelser**: `new Date("2026-01-29")` skapar UTC-tid. Normalisera till (year, month, day) för korrekt jämförelse av "förflutna dagar".
- **Bakåtkompatibilitet i API**: Behåll gamla fält (`bookedSlots`) även när nya läggs till (`slots` med `unavailableReason`).
- **1 timmes buffert**: Ökad från 10 min till 60 min för realistisk tid mellan bokningar (förberedelse, efterarbete).

### Architecture & DDD
- **Implementation utan adoption = dead code**: DoD måste inkludera "Används i production" - att koden finns räcker inte.
- **DDD fungerar**: Value objects och domain services gör logiken testbar och återanvändbar.
- **Repository pattern overhead motiverat**: Konsistens och testbarhet väger upp extra kod.
- **E2E-tester avslöjar API-buggar**: Unit tests med mocks missar ofta validation/Prisma errors - kör E2E efter större ändringar.

### Production Readiness
- **Monitoring är INTE optional**: Ska vara del av MVP, inte efterkonstruktion.
- **"90% done is not done"**: Verifiera alltid i target environment - inte bara lokalt.
- **Serverless begränsningar**: In-memory state, filesystem writes, long-running processes fungerar INTE.

### Agent Workflow
- **Använd agenter proaktivt**: Discovery INNAN problem uppstår, inte bara execution.
- **Pattern**: REVIEW → PRIORITIZE → IMPLEMENT → VERIFY (Phase 1-4).
- **Agenter för kvalitet**: security-reviewer, quality-gate före merge/release.

### Paralleliserad Team-Review (2026-01-29)
- **Utforska före planering**: Kartlägg kodbasen med explore-agent *innan* prioriteringslistan skapas, inte efter. Annars planerar man redan-klara saker.
- **Bakgrundsagent för mekaniskt arbete**: Logger-migrering (36 filer) var perfekt agent-uppgift. Mekaniska, repeterbara ändringar = bra agentuppgift.
- **Undvik parallellt arbete på samma fil**: Agent + manuellt arbete på samma fil ger konflikter. Agenten kan revertera manuella ändringar.
- **Prisma test-mockar är fragila**: `$transaction` i produktionskod kräver `$transaction` i testmockar. Mockar som hårdkodar Prisma-modeller direkt bryts vid refactoring.
- **Runda-struktur fungerar**: Säkerhet → Tech Debt → UX som prioriteringsordning, med verifiering mellan rundor, fångar problem tidigt.

### Prisma Studio Zombie-processer (2026-01-29)
- **Prisma Studio stängs inte automatiskt** - processer lever kvar i bakgrunden och ackumuleras.
- **4 gamla instanser åt upp alla 10 connections** i Supabase Session Pooler -> hela appen fick 503.
- **Symptom**: `FATAL: MaxClientsInSessionMode: max clients reached` - ser ut som databasproblem men är egentligen lokala zombie-processer.
- **Felsökning**: `ps aux | grep prisma` avslöjar problemet. `pkill -f "prisma studio"` fixar det.

### Recensioner & Betyg (2026-01-30)
- **Prisma `groupBy` har komplexa TS-overloads** - `findMany` + manuell aggregering i JS är enklare och lika effektivt vid låga volymer. Undvik att slåss med TypeScript.
- **Separata sidor > fullproppade dashboards** - Review-logik (reply-dialog, lista, etc) hör hemma på egen flik, inte inbäddad i dashboarden. Enklare kod, bättre UX.
- **1:1-relationer som fält på samma modell** - Reply/repliedAt direkt på Review-modellen (istället för separat modell) reducerar joins och förenklar API:et.
- **Kontrollera stöd-API:er tidigt** - Profile-API:et saknade `providerId`, fick patchas efteråt. Kartlägg beroenden innan implementation.
- **Enrichment-pattern fungerar** - `enrichWithReviewStats()` i providers-routen följer samma mönster som `enrichWithNextVisit()`. Konsistens ger förutsägbar kod.

### Hästregister / Horse Model (2026-01-30)
- **`birthYear` > `age`** - Statiskt värde som inte behöver uppdateras varje år. Beräkna ålder i UI vid behov.
- **Soft delete (`isActive=false`)** för hästar bevarar bokningshistorik -- hard delete skulle bryta foreign keys.
- **Bakåtkompatibel integration**: `Booking.horseId` är nullable, befintliga bokningar med `horseName`/`horseInfo` som fritext fungerar fortfarande.
- **Dropdown + fritext fallback**: Bokningsdialogen visar dropdown om kunden har registrerade hästar, annars fritt textfält. Bästa av två världar.
- **Zod `z.enum()` i nya versionen**: Använd `message` istället för `errorMap` -- API:et ändrades i Zod 4.
- **IDOR-skydd via `findFirst` + WHERE**: Horse API använder `{ id, ownerId, isActive }` i WHERE-clause, samma mönster som booking-repositoryt.

### Vercel Build Timeout Regression (2026-01-29)
- **`ignoreBuildErrors: true` i next.config.ts är en MEDVETEN optimering** - ta INTE bort den. TypeScript checkas separat i CI.
- **Agent-refaktoreringar kan ta bort "onödiga" inställningar** som i själva verket är kritiska. Kommentarer i koden räcker inte alltid som skydd.
- **Verifiera alltid build-tiden efter stora refaktoreringar** - regressioner i build-pipeline syns inte i tester.
- **Root cause**: Commit `66a0ea0` tog bort `ignoreBuildErrors`, vilket fick Next.js att köra full typecheck under build (14+ min istället för ~50s).

---

## Automated Quality Gates

**Lokal Gate (Husky pre-push hook):**
- Unit tests (`npm run test:run`)
- TypeScript check (`npm run typecheck`)

**CI Gate (GitHub Actions):**
- Unit tests + coverage
- E2E tests
- TypeScript check
- Build verification

**Branch Protection:** Inaktiverat för MVP - återaktivera vid v1.0 eller produktion.

---

## Sprint Planning & Retrospectives

### Sprint Workflow
1. Planera sprint med tech-architect
2. Implementera features med TDD
3. Commit och merge efter gröna tester
4. Kör retrospective med agenter
5. Uppdatera CLAUDE.md med learnings

### Retrospective Template
**Agenter:** tech-architect, test-lead, quality-gate, security-reviewer (vid behov)

**Frågor:**
1. Vad gick bra?
2. Vad kunde vi göra bättre?
3. Konkreta rekommendationer för nästa sprint?

> Tidigare retrospectives: [docs/retrospectives/](docs/retrospectives/)

---

## Aktuell Sprint: Sprint 2

**Theme:** Fix flakiness -> CI automation -> BookingRepository
**Duration:** 2 veckor
**Goal:** 100% E2E pass rate + Automated quality gates + BookingRepository

### Implementation Order

**Phase 1: CRITICAL BLOCKERS** (Dag 1-2)
- F2-2: Document Environment Setup
- F2-5: Test Data Management Strategy (BLOCKER)

**Phase 2: CI FOUNDATION** (Dag 2-3)
- F2-1: Complete E2E in CI
- F2-4: Automate Pre-merge Gate

**Phase 3: FEATURE DEVELOPMENT** (Dag 4-7)
- F2-3: BookingRepository Implementation

### Success Criteria

- [ ] 47/47 E2E tests passing (100%)
- [ ] E2E tests kör i CI
- [ ] Automated pre-merge gate (Husky)
- [ ] BookingRepository med 100% coverage
- [ ] `/api/bookings/*` använder repository

### Known Issues

**E2E Test Flakiness:** booking.spec.ts:16 + route-planning.spec.ts:48
- Root Cause: State/timing issues mellan tester
- Fix: Test isolation pattern i F2-5

---

## Design System

- **Färger**: Primary `green-600`, Background `gray-50`, Text `gray-900`/`gray-600`
- **Komponenter**: shadcn/ui (`npx shadcn@latest add [component]`)
- **Forms**: React Hook Form + Zod

---

## Resurser

- **README.md** - Vad som är byggt, roadmap
- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth.ts** - NextAuth config
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)

---

**Skapad av**: Claude Code
**Senast uppdaterad**: 2026-01-29
