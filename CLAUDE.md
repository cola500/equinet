# CLAUDE.md - Utvecklingsguide för Equinet

> **Hur** vi arbetar i projektet. För **vad** som är byggt, se README.md.
> Kontextspecifika regler laddas automatiskt via `.claude/rules/` (API, test, E2E, Prisma, UI).

## Snabbreferens

| Vad du söker | Gå till |
|--------------|---------|
| Setup & Kommandon | [README.md](README.md) |
| Vanliga Gotchas | [docs/GOTCHAS.md](docs/GOTCHAS.md) |
| Agent-Team | [docs/AGENTS.md](docs/AGENTS.md) |
| Production Deploy | [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) |
| Bokningsflöde & Betalning | [docs/SERVICE-BOOKING-FLOW.md](docs/SERVICE-BOOKING-FLOW.md) |
| Tidigare Retros | [docs/retrospectives/](docs/retrospectives/) |
| Databas-arkitektur | [docs/DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md) |
| Production Readiness | [NFR.md](NFR.md) |
| Röstloggning | [docs/VOICE-WORK-LOGGING.md](docs/VOICE-WORK-LOGGING.md) |

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

### Deploy till produktion

```bash
npm run deploy              # Kör kvalitetscheckar + push + påminnelse om Supabase-migration
npm run env:status          # Visa vilken databas som är aktiv (lokal/Supabase)
npm run migrate:check       # Visa migrationer som kan behöva appliceras på Supabase
```

**Deploy-ordning vid schemaändring:** Se `.claude/rules/prisma.md`

---

## Testing (TDD är Obligatoriskt!)

```
1. RED:    Skriv test som failar
2. GREEN:  Skriv minsta möjliga kod för att passera
3. REFACTOR: Förbättra utan att bryta test
```

**Skriv tester FÖRST för:** API routes, domain services, utilities och hooks.
**Coverage-mål:** API Routes >= 80%, Utilities >= 90%, Overall >= 70%

> Se `.claude/rules/testing.md` för behavior-based testing och gotchas.

---

## Arkitektur (DDD-Light)

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

**Kärndomäner** (måste använda repository): `Booking`, `Provider`, `Service`, `CustomerReview`, `Horse`
**Stöddomäner** (Prisma OK): `AvailabilityException`, `AvailabilitySchedule`

### Checklista för ny feature

- [ ] Är det en kärndomän? -> Använd repository
- [ ] Finns affärslogik? -> Lägg i domain service
- [ ] Behövs validering? -> Överväg value object
- [ ] Enkel CRUD? -> Prisma direkt är OK

---

## Refactoring Guidelines

1. **Start minimal**: "Kan detta lösas genom att **ta bort kod**?" Inkrementella förbättringar > omskrivningar.
2. **Respektera befintliga patterns**: Introducera INTE nya patterns utan diskussion.
3. **Filgranularitet**: 1 välorganiserad 300-rads fil > 10 x 30-rads filer. Dela upp vid ~400-500 rader.
4. **Komponentextrahering**: Extrahera vid 3+ återanvändningar ELLER genuint komplex (100+ rader).
5. **Simple > Complex > Complicated**: Minsta nödvändiga komplexitet.

---

## Gotchas

> Se [docs/GOTCHAS.md](docs/GOTCHAS.md) för fullständig lista.

---

## Definition of Done

- [ ] Fungerar som förväntat, inga TypeScript-fel (`npm run typecheck`), inga console errors
- [ ] Säker (Zod-validering, error handling, ingen XSS/SQL injection)
- [ ] Unit tests skrivna FÖRST, E2E uppdaterade, coverage >= 70%
- [ ] Feature branch, alla tester gröna, mergad till main
- [ ] Docs uppdaterade vid behov

---

## Säkerhet

**Implementerat:** bcrypt, HTTP-only cookies, CSRF, Prisma (SQL injection), React (XSS), Zod, session + ownership checks.

> Se `.claude/rules/api-routes.md` för detaljerad API-säkerhetschecklist.

---

## Agent-Team (3 agenter)

> Se [docs/AGENTS.md](docs/AGENTS.md) för fullständig guide.

```
Ny feature med arkitektur?   -> tech-architect (FÖRE implementation)
Nya API-routes?              -> security-reviewer (EFTER implementation)
Nya sidor/UI-flöden?         -> cx-ux-reviewer (EFTER implementation)
```

---

## Key Learnings (tvärgående)

> Filspecifika learnings finns i `.claude/rules/`.

- **TypeScript heap OOM**: Använd `npm run typecheck` (inte `npx tsc --noEmit`).
- **`ignoreBuildErrors: true` i next.config.ts**: MEDVETEN -- ta INTE bort.
- **Schema-först**: Prisma-schema -> API -> UI ger typsäkerhet hela vägen.
- **Factory pattern vid 3+ dependencies**: Obligatoriskt för DI i routes.
- **Serverless-begränsningar**: In-memory state, filesystem writes, long-running processes fungerar INTE.
- **Vercel region MÅSTE matcha Supabase**: `regions: ["fra1"]` i `vercel.json` for `eu-central-2`.
- **`connection_limit=1` i serverless**: Varje Vercel-instans hanterar en request.
- **Commit innan deploy**: Deploya ALDRIG till Vercel utan att committa först.
- **`.env.local` trumfar `.env`**: Uppdatera BÅDA vid byte av DATABASE_URL.
- **Immutabla modeller förenklar MVP**: Skippa PUT/DELETE = halverad API-yta. Lägg till redigering vid behov.
- **AI Service-mönster**: Kopiera `VoiceInterpretationService`-mönstret vid nya AI-features.

---

## Automated Quality Gates

**Lokal (Husky pre-push):** `npm run test:run` + `npm run typecheck`
**CI (GitHub Actions):** Unit tests + coverage, E2E, TypeScript, Build

---

## Aktuell Sprint: Sprint 2

**Theme:** Fix flakiness -> CI automation -> BookingRepository
**Goal:** 100% E2E pass rate + Automated quality gates + BookingRepository

> Sprint detaljer: [docs/sprints/](docs/sprints/)

---

## Resurser

- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth.ts** - NextAuth config
- [Next.js Docs](https://nextjs.org/docs) | [Prisma Docs](https://www.prisma.io/docs) | [shadcn/ui Docs](https://ui.shadcn.com)

---

**Senast uppdaterad**: 2026-02-15
