---
title: "CLAUDE.md - Utvecklingsguide för Equinet"
description: "Arbetsprocesser, patterns, arkitektur och key learnings för utveckling"
category: root
tags: [development, workflow, architecture, patterns]
status: active
last_updated: 2026-03-20
related:
  - README.md
  - NFR.md
  - docs/INDEX.md
  - docs/guides/gotchas.md
  - docs/guides/agents.md
  - docs/operations/deployment.md
  - docs/architecture/booking-flow.md
  - docs/architecture/database.md
  - docs/architecture/offline-pwa.md
  - docs/security/pentest-2026-02-15.md
  - docs/guides/voice-logging.md
sections:
  - Snabbreferens
  - Projekt
  - Workflow
  - "Testing (TDD är Obligatoriskt!)"
  - "Arkitektur (DDD-Light)"
  - Refactoring Guidelines
  - Gotchas
  - Definition of Done
  - Säkerhet
  - "Agent-Team (3 agenter)"
  - "Key Learnings (tvärgående)"
  - "Debugging: 5 Whys"
  - "Version & SDK Policy"
  - Automated Quality Gates
  - Sprintar
  - Resurser
---

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
| Monitoring & Incident | [docs/operations/monitoring.md](docs/operations/monitoring.md), [incident-runbook.md](docs/operations/incident-runbook.md) |
| Backup-policy | [docs/operations/backup-policy.md](docs/operations/backup-policy.md) |
| Claude Code Hooks | [.claude/hooks/](.claude/hooks/) (12 workflow-hooks) |
| Demo-läge | [docs/demo-mode.md](docs/demo-mode.md) |
| Produktanalys | [docs/product-audit/](docs/product-audit/) (6 dokument) |
| Teknikförbättringar Q1 | [docs/technical-improvements-2026-q1.md](docs/technical-improvements-2026-q1.md) |

---

## Projekt

- **Stack**: Next.js 16 (App Router) + TypeScript + Prisma + Supabase Auth + shadcn/ui
- **Språk**: Svenska (UI/docs), Engelska (kod)
- **Approach**: DDD-Light, TDD, Feature branches
- **Databas**: Supabase (PostgreSQL)

## Workflow

### Feature Implementation (Databas-först + TDD)

1. **Planering**: Schema -> API -> UI
2. **TDD-cykel**: Red -> Green -> Refactor
3. **Feature branch**: `git checkout -b feature/namn`. Om branch-namnet inte längre beskriver arbetet, starta ny branch.
4. **Visuell UX-verifiering**: Vid UI-ändringar -- verifiera med Playwright MCP (se nedan)
5. **Merge till main**: Efter alla tester är gröna
6. **Push**: Till remote

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

### BDD Dual-Loop (API routes, domain services, komplexa flöden)

1. Red (integration) -- Skriv ETT integrations-/acceptanstest som beskriver nästa
   observerbara beteende. Bekräfta att det failar av rätt anledning.
2. Inre loop (unit) -- upprepa tills integrationstestet passerar:
   - Red: minsta unit-test för nästa saknade del
   - Green: minimum kod för att passera
   - Refactor: rensa medan unit-tester är gröna
3. Green (integration) -- Kör integrationstestet igen. Failar det, tillbaka till steg 2.
4. Refactor (integration) -- ALLA tester måste förbli gröna.

### Enkel TDD (iOS SwiftUI, simpel CRUD, utilities)

1. RED:    Skriv test som failar
2. GREEN:  Skriv minsta möjliga kod för att passera
3. REFACTOR: Förbättra utan att bryta test

### När använda vad

| Område | Approach |
|--------|----------|
| API routes + domain services | BDD dual-loop |
| Komplexa flöden (multi-step, offline) | BDD dual-loop |
| iOS SwiftUI-vyer | Enkel TDD + visuell verifiering (mobile-mcp) |
| Simpel CRUD / utilities | Enkel TDD |

### Disciplinregler

- Skippa aldrig red-steget. Kan du inte formulera varför testet failar, förstår du inte kravet.
- En logisk ändring per cykel.
- Kör relevant test efter varje green, hela sviten före commit.
- Om en refactor bryter ett test -- revertera refactorn, fixa inte framåt.

**Skriv tester FÖRST för:** API routes, domain services, utilities och hooks.
**Coverage-mål:** API Routes >= 90%, Utilities >= 95%, Overall >= 80%

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
- [ ] Visuell UX-verifiering med Playwright MCP (vid UI-ändringar)
- [ ] Feature branch, alla tester gröna, mergad till main
- [ ] Docs uppdaterade vid behov

---

## Säkerhet

**Implementerat:** Supabase Auth (managed lösenord, sessions, email-verifiering, Custom Access Token Hook), RLS (28 policies på 7 kärndomäner, 24 bevistester), HTTP-only cookies, Prisma (SQL injection), React (XSS), Zod, ownership guards (`findByIdForProvider`), rate limiting (Upstash Redis), admin audit log (AdminAuditLog, automatisk via `withApiHandler({ auth: "admin" })`), admin session-timeout (15 min via JWT iat), Sentry.

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
- **Schema-isolation ("slot machine")**: `DATABASE_URL="...?schema=staging"` ger isolerad miljö inom samma databas. Fungerar med Prisma 6.19+, PgBouncer transaction mode och `$queryRawUnsafe`. `prisma migrate deploy` applicerar alla migrationer i det angivna schemat. Se `docs/research/schema-isolation-spike.md`.
- **NODE_ENV opålitlig på Vercel**: Vercel sätter `production` på ALLA deploys inkl preview. Använd explicita env-variabler (`ALLOW_TEST_ENDPOINTS`) istället för `NODE_ENV`-guards för test-endpoints.
- **Stripe webhook event-ID dedup**: `createMany` + `skipDuplicates` = atomisk INSERT ON CONFLICT DO NOTHING. Vid processing-failure: radera dedup-raden så Stripe kan retria.
- **Stripe subscription terminal states**: `canceled` räcker inte -- `incomplete_expired` är också terminal. Bygg `TERMINAL_STATES = new Set([...])` istället för hårdkodad jämförelse.

### Offline & Sync

- **Offline-aware SWR**: Byt global fetcher i `SWRProvider` villkorligt (feature flag). Mönstret: network-first -> write-through IndexedDB -> catch -> read cache -> throw.
- **SW tsconfig-isolation**: `src/sw.ts` MÅSTE exkluderas från BÅDA `tsconfig.json` OCH `tsconfig.typecheck.json`.
- **Error boundaries för offline**: `error.tsx` med `useOnlineStatus()`. Importera ALDRIG layout-komponenter i error.tsx.
- **useSession vs navigator.onLine race condition**: `useSession()` rapporterar `"unauthenticated"` ~2s FÖRE `navigator.onLine` ändras. Utför ALDRIG destruktiva operationer baserat på "unauthenticated + online".
- **Offline-navigeringsskydd**: Blockera `Link`-klick med `e.preventDefault()` + `toast.error()` när offline. Förhindrar RSC-request som ger cache miss -> `/~offline` -> krasch.
- **router.replace() triggar RSC-request**: Guard med `if (isOnline)` när URL-uppdateringen bara är för deep-linking.
- **Sequence over concurrency vid reconnect**: `revalidateOnReconnect: false` i SWRProvider, sync först -> `globalMutate()` sedan.
- **Exponentiell backoff med jitter**: `getRetryDelay` applicerar ±50% jitter (`base * (0.5 + Math.random())`) för att undvika thundering herd. Retry-After-header respekteras utan jitter.
- **Circuit breaker i sync-kö**: 3 konsekutiva 5xx-failures → pausa kön med `circuitBroken: true`. Resettas vid `synced` eller `conflict`. Förhindrar bombardering av trasig server.
- **Max total retries**: Mutation med `retryCount >= 10` markeras `failed` utan fetch-försök. Förhindrar eviga retries.
- **Modul-nivå guard för async hooks**: `let syncInProgress = false` på modul-nivå istället för `useRef` -- överlever komponent-ommountering.
- **iOS Safari falska online-events**: Proba med HEAD-request först, återställ bara om proben lyckas. Pattern i `useOnlineStatus.ts`.
- **Probe backoff**: Recovery-probes eskalerar `[15s, 30s, 60s, 120s]` vid upprepade misslyckanden. Resettas vid `reportConnectivityRestored()`.
- **withQuotaRecovery**: Wrappa IndexedDB-skrivningar -- vid `QuotaExceededError`: evict stale cache, försök igen, ge upp tyst. Pattern i `cache-manager.ts`.
- **Tab-koordinering max duration**: Sync-lås som hållits > 5 min släpps automatiskt (hängande tab). `safeBroadcast()` fångar BroadcastChannel-fel graciöst.
- **guardMutation nätverksfel-fallback**: `guardMutation` online-path fångar TypeError/AbortError, anropar `reportConnectivityLoss()`, och faller tillbaka till offline-köning. Skyddar mot `navigator.onLine` som ljuger. Lägg alltid till AbortController-timeout på fetch i mutationer med offlineOptions.

### Domain Patterns

- **Fire-and-forget notifier med DI**: Injicera alla beroenden via constructor, kör `.catch(logger.error)` i API-routen. Pattern i `RouteAnnouncementNotifier.ts`.
- **NotificationDelivery dedup-tabell**: Unique constraint `[routeOrderId, customerId, channel]` förhindrar dubbelnotiser. Kontrollera `exists()` före `create()`.
- **Per-service override map**: Byt Map-nyckel från `horseId` till `` `${horseId}:${serviceId}` `` i ALLA konsumenter vid serviceId-utvidgning.
- **Kanonisk distance-modul**: `src/lib/geo/distance.ts` är enda källan för Haversine-beräkningar. Duplicera ALDRIG i API routes.
- **CustomerLayout för alla kundsidor**: Wrappa ALLTID kundriktade sidor i `CustomerLayout` (`Header` + `BottomTabBar`).
- **Context > splitta hook vid prop-drilling**: Wrappa i Context + extrahera delade subkomponenter. Splitta INTE hooken.
- **Supabase Auth**: Managed auth med Custom Access Token Hook (PL/pgSQL). JWT claims: `providerId`, `userType`, `isAdmin`. iOS: Supabase Swift SDK + `native-session-exchange` endpoint för WKWebView cookies.
- **Publik vs skyddad URL-konvention**: `/api/stable/*` = auth-skyddad (singularis), `/api/stables/*` = publik (pluralis). Auth.config: `startsWith('/stable/')` + `=== '/stable'` -- ALDRIG `startsWith('/stable')` som matchar båda.
- **Publik data-allowlist**: `toPublicStable()` returnerar bara tillåtna fält (allowlist > blocklist). Nya fält exponeras inte oavsiktligt.

### Utvecklingsmönster

- **Button type="button" i forms**: shadcn/ui `<Button>` utan explicit `type` defaultar till `type="submit"` i `<form>` (HTML-spec). ALLA Button-element inuti forms som INTE ska submita MÅSTE ha `type="button"`. Gotcha upptäckt i CalendarHeader inuti DesktopBookingDialog.
- **Rate limiting sweep-mönster**: 4-raders tillägg per route (import + getClientIP + check + 429-response). Lägg EFTER auth, FÖRE JSON-parsing. Vid signaturändring (handler får `request`-param): uppdatera ALLA testanrop också.
- **BottomTabBar badge**: `TabItem.badge?: number` + villkorlig rendering med absolut positionerad `<span>`. Drivs av SWR-data via `useMemo` i `ProviderNav`.
- **Payload-minimering i select-block**: List-queries ska BARA returnera fält som UI:t använder. Granska komponenten före varje ny `select`-block. Använd `groupBy` för aggregering istället för att hämta alla rader + JS-loop. Undvik `createdAt`/`updatedAt` i list-responses om de inte renderas.
- **Rate limiter fail-closed**: `RateLimitServiceError` kastas vid Redis-fel. Routes med inner try/catch runt `rateLimiters.*` returnerar `503 "Tjänsten är tillfälligt otillgänglig"`. Övriga routes fångar via yttre catch -> 500.
- **Strukturerad loggning**: Server: `logger` från `@/lib/logger`. Klient: `clientLogger` från `@/lib/client-logger`. iOS: `AppLogger` från `AppLogger.swift` (os.log). Använd ALDRIG `console.*`/`print()` direkt i produktionskod.
- **iOS import OSLog gotcha**: `os.Logger`-stränginterpolering kräver `import OSLog` i den anropande filen, inte bara där Logger definieras. Swift resolvar `OSLogMessage` vid call-site.
- **iOS widget extension target-membership**: Nya .swift-filer som används av delade filer (KeychainHelper, SharedDataManager) MÅSTE läggas till i `membershipExceptions` i `project.pbxproj` för widget extension target.
- **iOS Xcode target-skapande förstör pbxproj**: Xcode re-serialiserar PBXFileSystemSynchronizedRootGroup vid ny target och tappar befintliga `PBXFileSystemSynchronizedBuildFileExceptionSet`. ALLTID spara backup + diff efter manuella Xcode-steg.
- **iOS Xcode DerivedData vid branch-byte**: Efter `git merge`/`checkout` som lägger till nya .swift-filer kan Xcode ge "Cannot find type X in scope" trots att filerna finns på disk. Fix: `rm -rf ~/Library/Developer/Xcode/DerivedData/Equinet-*`, stäng och öppna om projektet, bygg. PBXFileSystemSynchronizedRootGroup ska auto-upptäcka filer, men DerivedData-indexet blir stale.
- **iOS optimistisk UI**: Spara `oldState` före mutation, uppdatera UI direkt, reverta vid error. Kräver `withStatus()`-copy-metod på Codable struct. Haptic `.success`/`.error` efter resultat.
- **iOS nya Codable-fält bakåtkompatibla**: Nya fält som `serviceId` måste vara optionella (`String?`) om cachad data kan sakna dem. API:t skickar alltid, men SharedDataManager-cache kan ha äldre format.
- **iOS context menu > swipeActions i kalender**: `contextMenu` undviker krock med TabView page-swipe. Ger native long-press-meny med haptic.
- **iOS callback-pattern för navigering**: NativeCalendarView tar `onNavigateToWeb: ((String) -> Void)?` istället för att exponera ContentViews state-binding. Ägaren (ContentView) styr navigeringslogiken.
- **iOS test bundle ID prefix**: Test-target MÅSTE ha bundle ID som är prefix av parent app (`com.equinet.Equinet.EquinetTests`), annars: "Embedded binary's bundle identifier is not prefixed".
- **iOS Xcode 26 kräver explicit .xctestplan**: `shouldAutocreateTestPlan` är otillförlitligt. Skapa ALLTID `EquinetTests.xctestplan` manuellt och referera med `container:EquinetTests.xctestplan` i schemat. Utan fysisk fil: "test plan could not be read".
- **iOS XCTest setup**: `xcodebuild test -project ... -scheme Equinet -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:EquinetTests`
- **iOS CI simctl vs xcodebuild**: `simctl list devices` och `xcodebuild -showdestinations` returnerar OLIKA UDID:er. Använd ALDRIG simctl-UDID som xcodebuild-destination. Använd namnbaserad destination (`name=iPhone 17 Pro`) eller UDID från `xcodebuild -showdestinations`. CI: dynamiskt Xcode-val med `ls -d /Applications/Xcode_*.app | sort -V | tail -1`.
- **iOS CSS-injektion för att dölja webb-chrome**: WKWebView visar webbens BottomTabBar + Header ovanpå native TabView. Fix: injicera CSS i `WebView.swift` med `nav[class*="fixed"][class*="bottom-0"] { display: none !important }` och `header.border-b { display: none !important }`. Använd specifika selektorer, inte generella.
- **iOS NativeMoreView NavigationStack-mönster**: Native meny (SwiftUI List + sektioner) med NavigationLink som pushar WebView-wrapper (MoreWebView) för sub-sidor. Varje push skapar ny WebView-instans med delad BridgeHandler. `webViewReady: .constant(true)` för att undvika splash-overlay.
- **iOS Turbopack hot-reload gotcha**: Nya API route-filer (`src/app/api/*/route.ts`) registreras inte alltid av Turbopack hot-reload. Dev-servern kan returnera 404 trots att filen finns. Fix: starta om dev-servern (`npm run dev`).
- **iOS Swift Charts**: `import Charts` i SwiftUI-filer. `Chart { BarMark(x:y:) }` for bar charts, `LineMark(x:y:series:)` for line charts. `.chartForegroundStyleScale()` for legend-farger. Forsta anvandningen i session 113 (NativeInsightsView).
- **iOS HeatmapMatrix pre-computation**: Transformera API heatmap-data (array av day/hour/count) till 2D-matris i ViewModel. `HeatmapMatrix.from(entries:)` bygger 7x(hourRange) matris med `intensity(day:hour:)` for farggradering. Vyn laser bara fran matrisen.
- **iOS SharedDataManager cache per parameter**: `insights_cache_\(months)` ger separata caches for varje variabel. `clearAllInsightsCache()` itererar over alla varianter. Anvandbart for alla API:er med variabla parametrar.
- **iOS auth via Supabase Swift SDK**: Login via `SupabaseManager.client.auth.signIn()`, session exchange till WKWebView via `/api/auth/native-session-exchange` (PKCE). Alla routes använder `getAuthUser(request)` som stödjer både Bearer och Supabase cookies.
- **iOS WKWebView JS-debugging utan Safari Inspector**: Injicera JavaScript via `evaluateJavaScript` som gör `fetch()` och skickar resultat via `window.webkit.messageHandlers.equinet.postMessage()`. Logga i Swift via `AppLogger`. Fungerar på fysiska enheter utan Safari-koppling.
- **iOS Simulator MCP**: `mobile-mcp` (`@mobilenext/mobile-mcp`) for all iOS Simulator-interaktion: screenshot, accessibility tree, tap/swipe/type, launch/install app, screen recording. Anvander XCUITest/WebDriverAgent (inga extra beroenden utover Xcode). Ersatter ios-simulator-mcp vars IDB-baserade verktyg inte fungerar med Xcode 26.
- **iOS UI-verifiering**: Vid iOS UI-ändringar -- använd mobile-mcp för screenshots, accessibility tree och interaktion. Fixa problem direkt utan att fråga.
- **iOS WKWebView retain cycle**: `WKUserContentController.add(_:name:)` håller STARK referens till handler. Wrappa ALLTID i `WeakScriptMessageHandler` med `weak var delegate`. Komplettera med `dismantleUIView` som kör `removeScriptMessageHandler` + `removeAllUserScripts`.
- **iOS viewport-fit=cover statiskt**: Använd `export const viewport: Viewport = { viewportFit: "cover" }` i Next.js layout.tsx -- INTE dynamisk JS-injektion. Ger `env(safe-area-inset-*)` från första rendering. Behåll JS-injektion som fallback.
- **iOS Static DateFormatter**: DateFormatter är dyrt att skapa. Använd `private static let` på struct-nivå i SwiftUI-vyer. Särskilt viktigt i scroll-tunga vyer (kalender, listor).
- **iOS Native Screen Pattern (WebView->SwiftUI)**: 8 steg: **(0) Feature Inventory (OBLIGATORISKT)**: Läs webbsidans page-komponent + alla subkomponenter rad för rad. Lista ALLA datapunkter, interaktioner, navigeringslänkar, dialoger, statuslogik, felhantering, offlinebeteende och feature flags. Skapa tabell `| Feature | Webb | Native | Beslut |` där beslut = Native/Offload/Skip/Later med motivering. Tabellen granskas INNAN implementation startar. "Vi glömde" är inte ett giltigt beslut. Verifiera auth-mekanism per endpoint: `auth()` (session) vs `authFromMobileToken()` (Bearer JWT) -- native har bara JWT, offloada session-only endpoints till WebView. (1) Aggregerat API `/api/native/<screen>` med all data i ett anrop, (2) Codable structs + enum med unknown-fallback, (3) SharedDataManager-cache (5min TTL), (4) `@State`-baserad vy med callbacks (`onNavigateToTab`, `onNavigateToWebPath`), (5) Tab-nav via callback, icke-tab via `pendingMorePath` -> Mer-tab -> onChange pushar NavigationPath, (6) Cache-clear i AuthManager.logout(), (7) Nya modellfiler i widget `membershipExceptions` om SharedDataManager refererar dem. **Extra DoD för native-konvertering**: Visuell jämförelse (screenshot webb vs native), interaktionsjämförelse (varje klickbar element har motsvarighet eller beslut), alla datapunkter har beslut, simulator-verifiering med mobile-mcp.
- **iOS pendingMorePath programmatisk navigation**: Sätt `coordinator.pendingMorePath = "/path"` + `coordinator.selectedTab = .more`. NativeMoreView.onChange pushar matchande MoreMenuItem eller temporärt item. Nollställs direkt efter push.
- **iOS NativeMoreView native-routing**: I `navigationDestination(for: MoreMenuItem.self)` -- kolla `item.path == "/provider/X"` -> visa native vy istället för MoreWebView. Lägg till `navigationDestination(for: ModelType.self)` för detalj-push.
- **iOS Segmented Picker för tabs i detaljvy**: Använd `Picker(.segmented)` + `switch` -- INTE SwiftUI TabView (krockar med swipe-to-delete i List). Varje tab är en `@ViewBuilder` computed property.
- **iOS CustomerSheetType enum-pattern**: `enum SheetType: Identifiable` med en enda `.sheet(item:)` modifier. Varje case har egen presentationDetents. Undviker multipla `.sheet`-modifiers som kan krocka.
- **Visuell UX-verifiering med Playwright MCP**: Vid UI-ändringar -- starta worktree dev-server (`npx next dev -p 3001`) FÖRST, skapa testdata via API, batcha screenshots (logga in -> navigera alla sidor -> verifiera). Huvudrepots dev-server (port 3000) reflekterar INTE worktree-ändringar. Värt det för loading states, a11y, formatering, layoutskift -- inte för ren affärslogik.
- **iOS Feature Flag-mönster**: APIClient `fetchFeatureFlags()` utan Bearer (publik endpoint). AppCoordinator: `[String: Bool]` state + UserDefaults-cache (cachad vid start, fräscht i bakgrund). AuthenticatedView: trigger `.onAppear` + `.onChange(of: scenePhase)`. NativeMoreView: `visibleSections` compactMap-filtrering, tomma sektioner döljs. `handlePendingPath` söker ALLTID i `allMenuSections` (inte filtrerade).
- **iOS URL(string:relativeTo:) inte appendingPathComponent**: `appendingPathComponent()` URL-encodar `/` i strängar. Använd `URL(string: path, relativeTo: baseURL)` för API-paths.

- **RLS-bevistest mot Supabase**: `src/__tests__/rls/rls-proof.integration.test.ts` (24 tester). Seed med service_role, query med signInWithPassword-klienter. `verifyJwtClaims()` guard i beforeAll mot falska gröna. Deterministiska `b0`-prefix UUIDs, try/catch cleanup. Kräver `SUPABASE_SERVICE_ROLE_KEY` i `.env.local`.
- **PostgREST select med relationer**: Forward: `Table!column(fields)`. Reverse: `Table(fields)` (auto-detect FK).
- **RLS-policies ar OR -- explicit `.eq()` obligatoriskt**: Supabase-klient queries MASTE alltid ha `.eq("providerId", ...)` / `.eq("userId", ...)`. RLS-policies ar OR -- en publik read-policy (t.ex. `service_public_read`) kombinerad med provider-specifik policy ger provider tillgang till ALLA rader. Upptackt i session 117: provider kunde se alla providers tjänster i dropdown.
- **`@updatedAt` har ingen DB-default**: Supabase-klient måste skicka `updatedAt` explicit vid INSERT/UPSERT. Gäller: User, Provider, Booking, Payment, Horse.
- **RLS ENABLE saknas != policies saknas**: Policies kan existera utan att RLS är aktiverat. Verifiera `pg_tables.rowsecurity = true`.
- **vi.mock Supabase-klient**: `vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))`. I test: `vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: vi.fn().mockReturnValue({ select: ... }) } as never)`.

**Vilken testplaybook?** Swift-fil -> iOS-testflöde. TypeScript/JS-fil -> Webb-testflöde.

### iOS-testflöde

Full `EquinetTests` tar ~4 min pga simulator-overhead (EventKit, WebView, Speech). ViewModel-testerna tar <1s. **Kör alltid Nivå 1 först. Kör Nivå 2 bara inför PR eller vid bred påverkan.**

**Nivå 1 -- Under arbete (default):** Kör bara berörda testsviter:
```bash
xcodebuild test -project Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,id=<UDID>' \
  -only-testing:EquinetTests/BookingsViewModelTests \
  -only-testing:EquinetTests/BookingsModelsTests
```

**Nivå 2 -- Inför PR eller bred påverkan:** Kör full svit en gång:
```bash
xcodebuild test ... -only-testing:EquinetTests
```

**Mappning ändrad fil -> testsvit:**

| Fil | Testsvit |
|-----|----------|
| BookingsModels | BookingsModelsTests + BookingsViewModelTests |
| DashboardViewModel | DashboardViewModelTests |
| CalendarViewModel | CalendarViewModelTests |
| APIClient | APIClientTests |
| CustomersViewModel | CustomersViewModelTests |
| ServicesViewModel | ServicesViewModelTests |
| ReviewsViewModel | ReviewsViewModelTests |
| ProfileViewModel | ProfileViewModelTests |
| AuthManager | AuthManagerTests |

**Långsamma sviter (bara Nivå 2):** CalendarSyncManagerTests (~2.5 min), BridgeHandlerTests (~22s), SpeechRecognizerTests (~23s).

**Observability:**
- Kör testsviten EN gång. Kör ALDRIG om bara för att räkna resultat.
- xcodebuild visar `Executed` tre gånger (suite, bundle, selected) -- det är samma körning, inte tre.
- **Debugging:** Full output, ingen grep -- visar var det hakar.
- **Slutverifiering:** `grep -E "(Executed|failed)" | tail -1` ger en ren sammanfattning.

**Fallback:** Om något känns fel, kör Nivå 2 utan `-only-testing:` och utan grep-filter. Full output visar exakt var det hakar.

### Webb-testflöde

266 testfiler, 3755 tester. **Kör alltid Nivå 1 först. Kör Nivå 2 bara inför PR eller vid bred påverkan.**

**Nivå 1 -- Under arbete (default):** Kör berörda tester + typecheck:
```bash
npx vitest run src/domain/booking          # filtrerat på ändrad sökväg (~1s)
npm run typecheck                           # alltid, fångar importfel (~10s)
```

**Nivå 2 -- Inför PR eller bred påverkan:**
```bash
npm run check:all                           # typecheck + test:run + lint + check:swedish (~50s)
```

**Mappning ändrat område -> verifiering:**

| Område | Nivå 1 | Nivå 2 |
|--------|--------|--------|
| Domain service | `vitest run src/domain/<namn>` | check:all |
| API route | `vitest run src/app/api/<path>` | check:all |
| Auth/middleware | `vitest run src/lib/auth` + typecheck | check:all |
| UI-komponent | typecheck | check:all |
| Feature flag | `vitest run` filtrerat + typecheck | check:all + `flags:validate` |
| Prisma schema | typecheck + `vitest run` berörda routes | check:all + migrate:check |
| Utility/lib | `vitest run src/lib/<namn>` | check:all |

**Tidbudget:**

| Kommando | Tid |
|----------|-----|
| `vitest run <path>` (filtrerat) | ~1s |
| `npm run typecheck` | ~10s |
| `npm run lint` | ~5s |
| `npm run check:swedish` | ~1s |
| `npm run test:run` (alla 3755) | ~32s |
| `npm run check:all` | ~50s |

**Observability:**
- Vitest visar tydlig output med färger -- använd den rakt av, ingen grep.
- Kör aldrig `test:run` två gånger i samma verifieringscykel.
- `check:all` kör alla fyra gates sekventiellt med färgkodad output -- bästa val för Nivå 2.

**Fallback:** Om något känns fel, kör `npm run check:all` utan filtrering.

**Dubbelkörning:** Pre-push-hooken kör samma gates som `check:all` (test + typecheck + lint + swedish). Kör INTE `check:all` manuellt och sedan push -- det blir dubbelt. Antingen: (a) lita på hooken, eller (b) kör `check:all` manuellt och pusha med `--no-verify`.

### E2E -- separat strategi

E2E (35 specs, Playwright) är ett separat verifieringsspår -- inte en del av Nivå 1/2.

- Är INTE default vid vanlig refaktorering, serviceändringar eller modellarbete.
- Kräver egen felsökning: `--headed` för visuell debugging, `--project=cleanup` för datahantering.

**Körvägar:**
- `npm run test:e2e:bootstrap` -- verifiera Supabase + kör prisma migrate (kör innan första E2E-körning)
- `npm run test:e2e:smoke` -- app startar, login fungerar (exploratory-baseline + auth)
- `npm run test:e2e:critical` -- kärnflöden: bokning, betalning, leverantör
- `npm run test:e2e` -- standard-svit (36 specs, exkluderar externa beroenden)
- `npm run test:e2e:external` -- specs med externa beroenden (AI, offline)

**När:** Kör smoke efter breda UI-ändringar. Kör critical efter ändringar i boknings-/betalningsflöden. Kör full bara inför release eller vid oklara regressioner.

Se `.claude/rules/e2e-playbook.md` för strategi och `.claude/rules/e2e.md` för tekniska gotchas.

## Definition of Done

### Kodändring

- [ ] Relevant testnivå körd och grön (Nivå 1 under arbete, Nivå 2 inför PR)
- [ ] Typecheck/build passerar för berörd plattform
- [ ] Inga oförklarade warnings eller errors i output
- [ ] Docs uppdaterade vid behov

### E2E-ändring (tillägg)

- [ ] Berörd spec passerar isolerat: `npx playwright test e2e/<spec>.spec.ts`
- [ ] Seed-data är deterministisk (inga kollisioner vid upprepad körning)
- [ ] Inga nya `waitForTimeout()` utan dokumenterad motivering
- [ ] Passerar 3 gånger i rad lokalt
- [ ] Testet följer E2E-playbooken (stabila selektorer, tydligt flöde, inga dolda beroenden)

---

## Debugging: 5 Whys

När vi hittar en bugg, kör alltid "5 Whys" innan vi börjar fixa. Fråga "varför?" upprepat tills vi hittar rotorsaken. Vi fixar grundproblemet, inte symptomen.

---

## Version & SDK Policy

- **Lita INTE på training data**: När du skriver kod som använder externa SDKs, APIs eller AI-modeller -- STOPP innan du skriver import eller install.
- **Sök upp aktuell version**: Verifiera senaste paketversion, korrekta modell-IDs och aktuellt initialiseringsmönster via sökning.
- **Använd det du hittar**: Skriv kod baserat på aktuell dokumentation, inte på vad du "minns" från träningsdatan.
- **AI modell-IDn: ALLTID alias, ALDRIG daterade.** Använd `claude-sonnet-4-6` (alias), INTE `claude-sonnet-4-6-20250514` (daterat). Daterade IDn kan bli ogiltiga utan förvarning. Upptäckt i S9-4: voice logging trasig i prod pga ogiltigt daterat ID.

---

## Automated Quality Gates

**Lokal (Husky):**
- **Pre-commit:** `npm run check:swedish` + `npm run typecheck` (bara om .ts/.tsx staged)
- **Pre-push:** `npm run check:swedish` + `npm run test:run` + `npm run typecheck` + `npm run lint`
- **Allt-i-ett:** `npm run check:all` (alla 4 gates med färgkodad output)

**CI (GitHub Actions):** Unit tests + coverage, E2E, TypeScript, Build

**Feature Flag Validator:** `npm run flags:validate` -- listar server/klient-gates per flagga

**Claude Code Hooks** (`.claude/hooks/`, konfigurerade i `.claude/settings.local.json`):
- PreToolUse (påminner FÖRE ändring):
  - `api-route-check.sh` -- Checklista vid redigering av API routes (auth, rate limit, Zod, select)
  - `tdd-reminder.sh` -- Påminnelse om TDD + BDD dual-loop för API routes/domain services
  - `feature-flag-check.sh` -- Checklista vid nya feature flags
  - `prisma-migration-check.sh` -- Påminnelse vid schemaändringar
  - `definition-of-done.sh` -- DoD-checklista vid git commit + done/status atomisk check
  - `e2e-check.sh` -- Checklista vid E2E-teständringar
- PostToolUse (verifierar EFTER ändring):
  - `post-api-route-verify.sh` -- Varnar om auth/include/console/.eq()/repository saknas i API route
  - `post-import-check.sh` -- Varnar om server-only import i klient-komponent

---

## Sprintar

> Se [docs/sprints/](docs/sprints/) för aktuell och tidigare sprintar.

---

## Resurser

- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth-dual.ts** - Auth helper (Supabase Auth, DB-lookup för providerId)
- **src/lib/supabase/server.ts** - Supabase server client
- **src/lib/supabase/browser.ts** - Supabase browser client
- [Next.js Docs](https://nextjs.org/docs) | [Prisma Docs](https://www.prisma.io/docs) | [shadcn/ui Docs](https://ui.shadcn.com)

---

## Working with Claude -- Proven Playbook

> Baserat på Q1 2026 teknikspår. Se [retro](docs/retrospectives/2026-technical-cleanup-retro.md) för bakgrund.

### 1. Standard workflow

```
Analys (explore-agenter) -> Pilot (2-3 filer) -> Batch (parallella agenter) -> Pausa vid avtagande värde
```

- **Analys först**: Låt explore-agenter kartlägga innan implementation. Förhindrar att vi löser fel problem.
- **Pilot med riktade tester**: Verifiera mönstret på 2-3 representativa filer. Upptäck teständringar som behövs.
- **Batch med parallella agenter**: 3-4 agenter, 4-5 filer var. Inga merge-konflikter om filerna inte överlappar.
- **Pausa proaktivt**: Om nästa batch kräver mer instruktioner än den förra -- pausa. Avtagande avkastning.

### 2. Hur vi skriver bra prompts

- **Små, avgränsade uppgifter**: "Migrera dessa 5 routes till requireProvider" > "Refaktorera alla routes"
- **Tydliga constraints**: "Rör INTE IDOR-logik", "Ändra INTE affärslogik", "Rör INTE middleware"
- **Explicit mönster**: Visa exakt före/efter-kod i prompten. Agenter kopierar mönster bättre än de tolkar instruktioner.
- **Verifieringssteg**: Avsluta alltid med "kör tester + typecheck + visa resultat"

### 3. När Claude är stark

- **Mekaniska batchändringar**: Rollmigrering (47 routes, 0 regressioner), wrapper-migrering (18 routes)
- **Kodanalys och inventering**: Explore-agenter som läser 20+ filer och producerar strukturerade rapporter
- **Testgenerering**: TDD-cykler, edge case-identifiering, IDOR-bekräftelsetester
- **Dokumentation**: Strukturerade genomgångar med konsekvent format

### 4. När Claude är svag -- och hur vi kompenserar

- **Säkerhetsbedömningar**: Agenten flaggade falskt IDOR-alarm i reschedule. **Kompensera**: verifiera alltid säkerhetspåståenden manuellt i faktisk kod.
- **Filinnehållsjämförelser**: `handoff.json` missidentifierades som duplicat (olika innehåll, samma namn). **Kompensera**: läs filerna själv vid tvetydiga fall.
- **"Allt klart"-påståenden**: PaymentService-filer var untracked men rapporterades inte. **Kompensera**: kör `git status` efter varje refaktoreringssession.

### 5. Viktiga guardrails

- **Kör `git status` efter varje session** -- untracked filer som importeras av aktiv kod = produktionsrisk
- **Kör `npm run lint` före push** -- lint-fel blockerar pre-push hook
- **Anta aldrig att filer är committade** -- verifiera med `git diff --cached --stat`
- **Verifiera kritiska ändringar manuellt** -- särskilt auth, IDOR, payment

### 6. När vi ska pausa teknikspår

- **Avtagande avkastning**: Batch 1 gav 57% LOC-reduktion, batch 3 gav 30% -- rätt att pausa
- **Kvarvarande filer har specialfall**: Om de återstående filerna alla kräver individuell bedömning, batcha inte
- **Produktarbete ger mer värde**: Teknikspår ska stödja features, inte ersätta dem
- **Triggers för nästa spår**: Feature svår att bygga, samma bugg upprepas, tester opålitliga

### 7. Anti-patterns

- **"Migrera allt"** -- Batch till 80%, pausa, ta resten vid behov
- **Flera förändringar i samma steg** -- En concern per commit: rollmigrering ELLER wrapper, inte båda
- **Att inte verifiera output** -- Kör alltid tester + typecheck + lint, inte bara "ser bra ut"
- **Att låta Claude fatta arkitekturbeslut** -- Claude exekverar. Människan beslutar scope, prioritet, och "är detta värt det?"
- **För stora prompts** -- Om prompten är >30 rader, dela upp i steg

---

**Senast uppdaterad**: 2026-04-11
