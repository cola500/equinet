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
| Databas-arkitektur | [docs/DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md) |
| Production Readiness | [NFR.md](NFR.md) |
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

**Kärndomäner** (måste använda repository): `Booking`, `Provider`, `Service`, `CustomerReview`, `Horse`
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

### Principer

1. **Start minimal**: Identifiera det specifika problemet. "Kan detta lösas genom att **ta bort kod**?" Inkrementella förbättringar > omskrivningar.
2. **Respektera befintliga patterns**: Prisma direkt för CRUD, repository för kärndomäner, Server Components default, Zod, shadcn/ui. **Introducera INTE nya patterns** utan diskussion.
3. **Filgranularitet**: 1 välorganiserad 300-rads fil > 10 x 30-rads filer. Dela upp vid ~400-500 rader. Undantag: återanvändbara React-komponenter med egen state.
4. **Komponentextrahering**: Extrahera vid 3+ återanvändningar ELLER genuint komplex (100+ rader). Mikro-komponenter (10-20 rader) motiverar sällan egna filer.
5. **Simple > Complex > Complicated**: Minsta nödvändiga komplexitet.
6. **Diskutera före större ändringar**: Arkitekturella ändringar, nya beroenden, patterns som påverkar teamet.

---

## Gotchas

> Se [docs/GOTCHAS.md](docs/GOTCHAS.md) för fullständig lista.

---

## Definition of Done

- [ ] Fungerar som förväntat, inga TypeScript-fel (`npm run typecheck`), inga console errors
- [ ] Säker (Zod-validering, error handling, ingen XSS/SQL injection)
- [ ] Unit tests skrivna FÖRST, E2E uppdaterade, coverage >= 70%
- [ ] Feature branch, alla tester gröna, mergad till main
- [ ] Docs uppdaterade: README.md, docs/API.md, BACKLOG.md, CLAUDE.md Key Learnings

---

## Production Readiness

> Scorecard & gap-stories: [NFR.md](NFR.md)
> Deploy-guide: [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md)

### Environment Variables (MANDATORY)
```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://..."
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
NEXT_PUBLIC_SENTRY_DSN="https://..."
```

---

## Debugging (UI -> DB)

**Checklist:** Browser console -> Network tab -> Server terminal -> Prisma Studio

---

## Säkerhet

**Implementerat:** bcrypt hashing, HTTP-only cookies, CSRF, Prisma (SQL injection), React (XSS), Zod validering, session + ownership checks.

**Checklist nya API routes:** Session check -> Zod validation -> Ownership i WHERE clause -> Error handling (Zod, Prisma, JSON) -> `logger` (INTE `console.*`) -> `rateLimiters`

---

## Agent-Team

> Se [docs/AGENTS.md](docs/AGENTS.md) för fullständig guide och quick reference.

---

## Key Learnings

### Operationella fällor
- **TypeScript heap OOM**: Använd `npm run typecheck` (inte `npx tsc --noEmit`). `tsconfig.typecheck.json` exkluderar testfiler + incremental builds.
- **Prisma Studio zombie-processer**: Stängs inte automatiskt -- ackumuleras och äter DB-connections. Symptom: `MaxClientsInSessionMode`. Fix: `pkill -f "prisma studio"`.
- **`ignoreBuildErrors: true` i next.config.ts**: MEDVETEN optimering -- ta INTE bort. TypeScript checkas i CI. Utan den: 14+ min build istället för ~50s.
- **`db:seed:force` invaliderar sessioner**: Raderar alla användare -- aktiva sessioner blir ogiltiga. Logga ut/in efter reseed.
- **Prisma migration workflow**: Använd `prisma migrate dev` för schemaändringar (INTE `db push`). Baseline migration `0_init` representerar hela schemat. Nya migreringar: `npx prisma migrate dev --name beskrivning`. Committa alltid `prisma/migrations/`.

### API & Säkerhet
- **Rate limiting FÖRE request-parsing**: Annars kan angripare spamma utan att trigga rate limit.
- **Prisma `select` > `include`**: Både performance och säkerhet -- förhindrar PII-exponering (t.ex. passwordHash).
- **JSON parsing MÅSTE ha try-catch**: Annars 500 istället för 400 vid ogiltig JSON.
- **`$transaction` kräver `@ts-expect-error`**: Kända TS-inferensproblem med callback-syntax.

### Testing
- **E2E: undvik `waitForTimeout()`** -- använd explicit waits (`waitFor({ state: 'visible' })`).
- **E2E: unika identifiers** med `Date.now()` för test isolation.
- **E2E: `getByRole` > `getByLabel` > `getByPlaceholder`** -- mest robust selektor.
- **E2E: kör isolerat vid debugging** -- `npx playwright test file.spec.ts:215`.
- **FormData i vitest**: JSDOM stödjer inte `FormData` + `File` -- mocka `request.formData()` direkt.
- **Class-baserade mocks för `new`-anrop**: Arrow functions ger "is not a constructor".

### Utvecklingsmönster
- **Schema-först**: Prisma-schema -> API -> UI ger typsäkerhet hela vägen.
- **Factory pattern vid 3+ dependencies**: Obligatoriskt för DI i routes.
- **Definiera error-kontrakt före implementation**: Bestäm HTTP-status-mappning i förväg.
- **`select` i repository måste inkludera alla fält UI:n behöver**: Kontrollera vid schema-ändringar.
- **Serverless-begränsningar**: In-memory state, filesystem writes, long-running processes fungerar INTE.
- **Vercel region MÅSTE matcha Supabase**: `regions: ["fra1"]` i `vercel.json` for `eu-central-2`. Utan detta: ~150ms latens per query istallet for ~5ms.
- **`connection_limit=1` i serverless**: Varje Vercel-instans hanterar en request. `connection_limit=10` = 10x for hog belastning pa Supabase pooler.
- **Undvik dubbel-fetch i React**: `useEffect([], [])` + debounce-effect med samma deps triggas bada vid mount. Lat debounce-effecten hantera allt med `delay = hasFilters ? 500 : 0`.
- **Commit innan deploy**: Deploya ALDRIG till Vercel utan att committa forst. Produktion och git maste vara i synk.
- **Kor `get_advisors` efter nya tabeller**: RLS missades pa `HorseServiceInterval`. Supabase security linter fangar detta.
- **Immutabla modeller förenklar MVP**: Skippa PUT/DELETE = halverad API-yta, färre tester, enklare UI. Lägg till redigering senare vid behov.
- **Befintliga DDD-patterns skalar bra**: Nya domäner (t.ex. CustomerReview) byggs snabbt genom att följa Review-mallen.
- **Query + Map-dedup for aggregeringar**: Kundlistan bygger rika vyer fran Booking-tabellen utan nya tabeller -- smart query + Map-baserad deduplicering i JS.
- **Junction-tabell for N:M overrides**: `HorseServiceInterval(horseId, providerId)` for per-hast override. Ateranvandbart monster for overridebara relationer.
- **Runtime-beraknad status**: Due-for-service (overdue/upcoming/ok) beraknas i API, inte DB. Alltid aktuell, ingen synkronisering.
- **Kontrollera ALLA select-block vid nytt falt**: providerNotes missades forst i passport-route. Vid nytt falt pa befintlig modell -- sok i hela kodbasen efter alla select/mapping/query som ror modellen.
- **Hook-extrahering för mobil/desktop**: Extrahera logik till hook -> skapa två UI-skal (mobil Drawer + desktop Dialog) -> sidan blir limkod med `isMobile ? <Mobil /> : <Desktop />`. Ger testbar logik, separerade UI-varianter, kraftig radreducering.
- **ResponsiveDialog-mönster**: `src/components/ui/responsive-dialog.tsx` wrapprar Dialog (desktop) + Drawer (mobil) bakom gemensamt API. Återanvänd för alla modala flöden.
- **Touch targets centraliserade**: `min-h-[44px] sm:min-h-0` inbakat i Button (default/lg), Input, SelectTrigger. `size="sm"` knappar får INTE automatiska touch targets -- lägg till manuellt vid behov. Nativa element (button, select, span, a): använd `touch-target` CSS utility.
- **Felmeddelanden ALLTID på svenska**: `NextResponse.json({ error: "..." })` ska vara på svenska. Logger-meddelanden (`logger.error(...)`) förblir på engelska (för utvecklare). Ordlista: "Ej inloggad", "Åtkomst nekad", "Ogiltig JSON", "Valideringsfel", "Internt serverfel", "Kunde inte X".
- **UI/API-gränsvalidering**: När UI erbjuder värden (t.ex. radie 25/50/100/200km), verifiera att API:et accepterar hela spannet. `MAX_RADIUS_KM` höjdes 100->200 efter bugg.
- **Geocoding != substring-sökning**: Debounce-auto-sök funkar för text-matchning men inte geocoding (partiella ortnamn ger fel resultat). Behåll Enter/klick-trigger för geocoding.
- **E2E futureWeekday()**: `futureDate()` kan landa på helger -- leverantören har mån-fre. Använd `futureWeekday()` från `e2e/setup/e2e-utils.ts` för alla seedade framtida bokningar.
- **E2E annons-status**: `seedProviderAnnouncement()` måste ha `status: 'open'` (inte `pending`). Public announcements-API:t filtrerar på `status: 'open'`.
- **E2E shadcn-selektorer**: `.border.rounded-lg` matchar INTE längre shadcn Cards. Använd `[data-slot="card"]` eller semantiska selektorer (`getByRole`, `getByText`).
- **E2E iterate-pattern**: När UI har flera matchande element, iterera `cards.nth(i)` istället för `.first()` -- hitta rätt element baserat på state (t.ex. orecenserad bokning).
- **E2E Route stop tvåstegsflöde**: pending -> "Påbörja besök" -> in_progress -> "Markera som klar" -> completed. Tester måste hantera båda stegen.
- **ResponsiveAlertDialog**: `src/components/ui/responsive-alert-dialog.tsx` -- samma mönster som `responsive-dialog.tsx`. Använd för alla bekräftelsedialoger (avboka, ta bort, lämna).
- **AlertDialog ur .map()**: Rendera ALDRIG AlertDialog med AlertDialogTrigger inuti `.map()`. Använd kontrollerad state (`itemToDelete`) + en enda dialog utanför loopen. Bättre DOM-prestanda och mobilkompatibelt.
- **Mobil touch target-pattern**: `min-h-[44px] sm:min-h-0` på knappar/inputs + `flex-col gap-2 sm:flex-row` för knapp-stacking + `grid-cols-1 sm:grid-cols-2` för formulär-grid.

---

## Automated Quality Gates

**Lokal (Husky pre-push):** `npm run test:run` + `npm run typecheck`
**CI (GitHub Actions):** Unit tests + coverage, E2E, TypeScript, Build
**Branch Protection:** Inaktiverat för MVP.

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

> Sprint workflow & retrospectives: [docs/retrospectives/](docs/retrospectives/)

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
**Senast uppdaterad**: 2026-02-08
