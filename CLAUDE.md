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
| Offline-arkitektur | [docs/OFFLINE-ARCHITECTURE.md](docs/OFFLINE-ARCHITECTURE.md) |
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

**Kärndomäner** (måste använda repository): `Booking`, `Provider`, `Service`, `CustomerReview`, `Horse`, `Follow`
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
- **Polling-providers**: Anvand `setState(fn)` med shallow-compare -- returnera samma referens vid identiska vardet sa React skippar re-render.
- **SWR for client-side polling**: Ersatt manuell useState/setInterval med `useSWR(key, fetcher, { refreshInterval })` for deduplication och caching.
- **E2E cookie-consent dismissal**: `addInitScript(() => localStorage.setItem(...))` i `e2e/fixtures.ts` -- global fix istallet for per-test.
- **E2E strict selectors**: `getByText('X', { exact: true })` nar delstrangar matchar (t.ex. "Bokningar" vs "Inga bokningar"). Scopa till `page.locator('table')` for att undvika dolda filter-options.
- **E2E rate-limit reset**: ALLTID `page.request.post('/api/test/reset-rate-limit').catch(() => {})` i `beforeEach` -- saknad reset ar vanligaste orsaken till flaky E2E.
- **CustomerLayout for alla kundsidor**: Wrappa ALLTID kundriktade sidor i `CustomerLayout` (`Header` + `BottomTabBar`). Galler aven `/announcements/`-sidor.
- **Offline-aware SWR**: Byt global fetcher i `SWRProvider` villkorligt (feature flag). Alla `useSWR`-hooks arver offline-stod automatiskt. Monstret: network-first -> write-through IndexedDB -> catch -> read cache -> throw.
- **SW tsconfig-isolation**: `src/sw.ts` MASTE exkluderas fran BADA `tsconfig.json` OCH `tsconfig.typecheck.json` (barnets `exclude` overridar foralders).
- **Error boundaries for offline**: `error.tsx` med `useOnlineStatus()` -- offline visar WifiOff-UI, online visar generisk error-UI. Importera ALDRIG layout-komponenter i error.tsx (kraschar error boundary:n ar vi tillbaka pa ruta ett).
- **useSession vs navigator.onLine race condition**: `useSession()` rapporterar `"unauthenticated"` ~2s FORE `navigator.onLine` andras. Utfor ALDRIG destruktiva operationer (cache-rensning) baserat pa "unauthenticated + online" -- det kan betyda "natverk nere". Lat sessionStorage rensas naturligt vid flik-stangning.
- **Offline-navigeringsskydd**: Blockera `Link`-klick med `e.preventDefault()` + `toast.error()` nar offline och ej pa aktiv sida. Forhindrar RSC-request som ger cache miss -> `/~offline` -> krasch. Pattern i `BottomTabBar.tsx` och `ProviderNav.tsx`.
- **router.replace() triggar RSC-request**: `router.replace()`/`router.push()` i App Router ar INTE lokala URL-uppdateringar -- de triggar natverksanrop. Guard med `if (isOnline)` nar URL-uppdateringen bara ar for deep-linking (inte for att ladda nytt innehall). Pattern i `calendar/page.tsx`.
- **Sequence over concurrency vid reconnect**: Nar tva system reagerar pa samma `online`-event (SWR revalidation + sync engine), inaktivera det automatiska (`revalidateOnReconnect: false`) och lat sync trigga SWR manuellt via `globalMutate()` EFTER slutford sync. Forhindrar bade request-burst (rate limiting) och context destruction (React ommountering).
- **Exponentiell backoff for sync-motorn**: `getRetryDelay(attempt, response)` -- 1s/2s/4s default, respekterar `Retry-After`-header. 429 ar aterhamtningsbart (revert till "pending"), 5xx ar permanent ("failed" efter max retries).
- **Modul-niva guard for async hooks**: `let syncInProgress = false` pa modul-niva istallet for `useRef` -- overlever komponent-ommountering (Suspense, error boundaries). Exportera `_resetSyncGuard()` for tester.
- **E2E IndexedDB-lasningar: stang anslutningen**: `db.close()` efter `indexedDB.open()` i E2E-tester. Oppen ra-anslutning kan interferera med Dexie:s transaktioner. Krav `mutations.length > 0` i pollning for att undvika tomma snapshots under Dexie-skrivningar.
- **iOS Safari falska online-events**: Lita ALDRIG blint pa browserns `online`-event nar `fetchFailed` ar true. Proba med HEAD-request forst, aterstall bara om proben lyckas. Pattern i `useOnlineStatus.ts` `handleOnline`.
- **Fire-and-forget notifier med DI**: Injicera alla beroenden (repo, emailService, notificationService) via constructor, kör `.catch(logger.error)` i API-routen. Testbart med mocks, robust i prod. Pattern i `RouteAnnouncementNotifier.ts`.
- **NotificationDelivery dedup-tabell**: Unique constraint `[routeOrderId, customerId, channel]` förhindrar dubbelnotiser vid retries/race conditions. Kontrollera `exists()` före `create()`.
- **E2E feature flag env-var**: Feature-flag-gated E2E-tester kräver `FEATURE_X=true` i `.env` (lokal) + `playwright.config.ts` webServer.env (CI). Admin API-toggle räcker INTE -- dev mode module-isolation gör att inte alla API-routes ser flaggan. Env-variabler har högsta prioritet och delas av alla instanser.
- **Migration med constraint-ändring + datamigrering**: Ordning: (1) Add nullable column + FK, (2) DROP old constraint, (3) Data migration DO-block, (4) SET NOT NULL + CREATE new constraint. Droppa ALLTID gamla constrainten FÖRE datamigreringssteget -- annars failar INSERT på duplicate key.
- **Per-service override map**: När override-tabell utvidgas med `serviceId`, byt Map-nyckel från `horseId` till `` `${horseId}:${serviceId}` `` i ALLA konsumenter (DueForServiceService, DueForServiceLookup, provider due-for-service route, ReminderService).

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

## Aktuell Sprint: Sprint 2

**Theme:** E2E-stabilitet, UX-förbättringar, dokumentation
**Goal:** 100% E2E pass rate + Ruttplanering/annonsering UX + Dokumentationssynk

> Sprint detaljer: [docs/sprints/](docs/sprints/)

---

## Resurser

- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth.ts** - NextAuth config
- [Next.js Docs](https://nextjs.org/docs) | [Prisma Docs](https://www.prisma.io/docs) | [shadcn/ui Docs](https://ui.shadcn.com)

---

**Senast uppdaterad**: 2026-02-23
