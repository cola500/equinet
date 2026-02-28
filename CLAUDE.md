# CLAUDE.md - Utvecklingsguide för Equinet

> **Hur** vi arbetar i projektet. För **vad** som är byggt, se README.md.
> Kontextspecifika regler laddas automatiskt via `.claude/rules/` (API, test, E2E, Prisma, UI).

## Snabbreferens

| Vad du söker | Gå till |
|--------------|---------|
| Dokumentationsindex | [docs/INDEX.md](docs/INDEX.md) |
| Setup & Kommandon | [README.md](README.md) |
| Vanliga Gotchas | [docs/guides/gotchas.md](docs/guides/gotchas.md) |
| Agent-Team | [docs/guides/agents.md](docs/guides/agents.md) |
| Production Deploy | [docs/operations/deployment.md](docs/operations/deployment.md) |
| Bokningsflöde & Betalning | [docs/architecture/booking-flow.md](docs/architecture/booking-flow.md) |
| Tidigare Retros | [docs/retrospectives/](docs/retrospectives/) |
| Databas-arkitektur | [docs/architecture/database.md](docs/architecture/database.md) |
| Offline-arkitektur | [docs/architecture/offline-pwa.md](docs/architecture/offline-pwa.md) |
| Production Readiness | [NFR.md](NFR.md) |
| Röstloggning | [docs/guides/voice-logging.md](docs/guides/voice-logging.md) |
| Pentest-rapport (feb 2026) | [docs/security/pentest-2026-02-15.md](docs/security/pentest-2026-02-15.md) |

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
npm run migrate:check       # Visa senaste migrationer (lokalt + Supabase)
npm run migrate:status      # Fullständig namnbaserad jämförelse (pending, drift, misslyckade)
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

**Kärndomäner** (måste använda repository): `Booking`, `Provider`, `Service`, `CustomerReview`, `Horse`, `Follow`, `Subscription`
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

> Se [docs/guides/gotchas.md](docs/guides/gotchas.md) för fullständig lista.

---

## Definition of Done

- [ ] Fungerar som förväntat, inga TypeScript-fel (`npm run typecheck`), inga console errors
- [ ] Säker (Zod-validering, error handling, ingen XSS/SQL injection)
- [ ] Unit tests skrivna FÖRST, E2E uppdaterade, coverage >= 70%
- [ ] Feature branch, alla tester gröna, mergad till main
- [ ] Docs uppdaterade vid behov

---

## Säkerhet

**Implementerat:** bcrypt, HTTP-only cookies, CSRF (NextAuth + Origin-validering), Prisma (SQL injection), React (XSS), Zod, session + ownership checks, error sanitering, rate limiting (Upstash Redis).

> Se `.claude/rules/api-routes.md` för detaljerad API-säkerhetschecklist.

---

## Agent-Team (3 agenter)

> Se [docs/guides/agents.md](docs/guides/agents.md) för fullständig guide.

```
Ny feature med arkitektur?   -> tech-architect (FÖRE implementation)
Nya API-routes?              -> security-reviewer (EFTER implementation)
Nya sidor/UI-flöden?         -> cx-ux-reviewer (EFTER implementation)
```

---

## Key Learnings (tvärgående)

> Domänspecifika learnings finns i `.claude/rules/` (API, test, E2E, Prisma, UI).

### Serverless & Deploy

- **Serverless-begränsningar**: In-memory state, filesystem writes, long-running processes fungerar INTE.
- **Vercel region MÅSTE matcha Supabase**: `regions: ["fra1"]` i `vercel.json` för `eu-central-2`.
- **Commit innan deploy**: Deploya ALDRIG till Vercel utan att committa först.
- **`.env.local` trumfar `.env`**: Uppdatera BÅDA vid byte av DATABASE_URL.

### Offline & Sync

- **Offline-aware SWR**: Byt global fetcher i `SWRProvider` villkorligt (feature flag). Mönstret: network-first -> write-through IndexedDB -> catch -> read cache -> throw.
- **SW tsconfig-isolation**: `src/sw.ts` MÅSTE exkluderas från BÅDA `tsconfig.json` OCH `tsconfig.typecheck.json`.
- **Error boundaries för offline**: `error.tsx` med `useOnlineStatus()`. Importera ALDRIG layout-komponenter i error.tsx.
- **useSession vs navigator.onLine race condition**: `useSession()` rapporterar `"unauthenticated"` ~2s FÖRE `navigator.onLine` ändras. Utför ALDRIG destruktiva operationer baserat på "unauthenticated + online".
- **Offline-navigeringsskydd**: Blockera `Link`-klick med `e.preventDefault()` + `toast.error()` när offline. Förhindrar RSC-request som ger cache miss -> `/~offline` -> krasch.
- **router.replace() triggar RSC-request**: Guard med `if (isOnline)` när URL-uppdateringen bara är för deep-linking.
- **Sequence over concurrency vid reconnect**: `revalidateOnReconnect: false` i SWRProvider, sync först -> `globalMutate()` sedan.
- **Exponentiell backoff för sync-motorn**: `getRetryDelay(attempt, response)`. 429 är återhämtningsbart, 5xx är permanent efter max retries.
- **Modul-nivå guard för async hooks**: `let syncInProgress = false` på modul-nivå istället för `useRef` -- överlever komponent-ommountering.
- **iOS Safari falska online-events**: Proba med HEAD-request först, återställ bara om proben lyckas. Pattern i `useOnlineStatus.ts`.

### Domain Patterns

- **Fire-and-forget notifier med DI**: Injicera alla beroenden via constructor, kör `.catch(logger.error)` i API-routen. Pattern i `RouteAnnouncementNotifier.ts`.
- **NotificationDelivery dedup-tabell**: Unique constraint `[routeOrderId, customerId, channel]` förhindrar dubbelnotiser. Kontrollera `exists()` före `create()`.
- **Per-service override map**: Byt Map-nyckel från `horseId` till `` `${horseId}:${serviceId}` `` i ALLA konsumenter vid serviceId-utvidgning.
- **Kanonisk distance-modul**: `src/lib/geo/distance.ts` är enda källan för Haversine-beräkningar. Duplicera ALDRIG i API routes.
- **CustomerLayout för alla kundsidor**: Wrappa ALLTID kundriktade sidor i `CustomerLayout` (`Header` + `BottomTabBar`).
- **Context > splitta hook vid prop-drilling**: Wrappa i Context + extrahera delade subkomponenter. Splitta INTE hooken.

---

## Debugging: 5 Whys

När vi hittar en bugg, kör alltid "5 Whys" innan vi börjar fixa. Fråga "varför?" upprepat tills vi hittar rotorsaken. Vi fixar grundproblemet, inte symptomen.

---

## Version & SDK Policy

- **Lita INTE på training data**: När du skriver kod som använder externa SDKs, APIs eller AI-modeller -- STOPP innan du skriver import eller install.
- **Sök upp aktuell version**: Verifiera senaste paketversion, korrekta modell-IDs och aktuellt initialiseringsmönster via sökning.
- **Använd det du hittar**: Skriv kod baserat på aktuell dokumentation, inte på vad du "minns" från träningsdatan.

---

## Automated Quality Gates

**Lokal (Husky pre-push):** `npm run check:swedish` + `npm run test:run` + `npm run typecheck` + `npm run lint`
**CI (GitHub Actions):** Unit tests + coverage, E2E, TypeScript, Build

---

## Sprintar

> Se [docs/sprints/](docs/sprints/) för aktuell och tidigare sprintar.

---

## Resurser

- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth.ts** - NextAuth config
- [Next.js Docs](https://nextjs.org/docs) | [Prisma Docs](https://www.prisma.io/docs) | [shadcn/ui Docs](https://ui.shadcn.com)

---

**Senast uppdaterad**: 2026-02-28
