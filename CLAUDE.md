---
title: "CLAUDE.md - Utvecklingsguide för Equinet"
description: "Arbetsprocesser, patterns, arkitektur och key learnings för utveckling"
category: root
tags: [development, workflow, architecture, patterns]
status: active
last_updated: 2026-03-02
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
- **MobileToken JWT-auth**: `src/domain/auth/MobileTokenService.ts` -- jose HS256, SHA-256 hash i DB, 90d expiry, max 5 aktiva per user, atomisk rotation via `revokeAndCreate` (`$transaction`). Bearer-auth helper: `authFromMobileToken(request)` i `src/lib/mobile-auth.ts`.
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
- **iOS optimistisk UI**: Spara `oldState` före mutation, uppdatera UI direkt, reverta vid error. Kräver `withStatus()`-copy-metod på Codable struct. Haptic `.success`/`.error` efter resultat.
- **iOS nya Codable-fält bakåtkompatibla**: Nya fält som `serviceId` måste vara optionella (`String?`) om cachad data kan sakna dem. API:t skickar alltid, men SharedDataManager-cache kan ha äldre format.
- **iOS context menu > swipeActions i kalender**: `contextMenu` undviker krock med TabView page-swipe. Ger native long-press-meny med haptic.
- **iOS callback-pattern för navigering**: NativeCalendarView tar `onNavigateToWeb: ((String) -> Void)?` istället för att exponera ContentViews state-binding. Ägaren (ContentView) styr navigeringslogiken.
- **iOS test bundle ID prefix**: Test-target MÅSTE ha bundle ID som är prefix av parent app (`com.equinet.Equinet.EquinetTests`), annars: "Embedded binary's bundle identifier is not prefixed".
- **iOS Xcode 26 kräver explicit .xctestplan**: `shouldAutocreateTestPlan` är otillförlitligt. Skapa ALLTID `EquinetTests.xctestplan` manuellt och referera med `container:EquinetTests.xctestplan` i schemat. Utan fysisk fil: "test plan could not be read".
- **iOS XCTest setup**: `xcodebuild test -project ... -scheme Equinet -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:EquinetTests`
- **iOS CI simctl vs xcodebuild**: `simctl list devices` och `xcodebuild -showdestinations` returnerar OLIKA UDID:er. Använd ALDRIG simctl-UDID som xcodebuild-destination. Använd namnbaserad destination (`name=iPhone 16 Pro`) eller UDID från `xcodebuild -showdestinations`. CI: dynamiskt Xcode-val med `ls -d /Applications/Xcode_*.app | sort -V | tail -1`.
- **iOS CSS-injektion för att dölja webb-chrome**: WKWebView visar webbens BottomTabBar + Header ovanpå native TabView. Fix: injicera CSS i `WebView.swift` med `nav[class*="fixed"][class*="bottom-0"] { display: none !important }` och `header.border-b { display: none !important }`. Använd specifika selektorer, inte generella.
- **iOS NativeMoreView NavigationStack-mönster**: Native meny (SwiftUI List + sektioner) med NavigationLink som pushar WebView-wrapper (MoreWebView) för sub-sidor. Varje push skapar ny WebView-instans med delad BridgeHandler. `webViewReady: .constant(true)` för att undvika splash-overlay.
- **iOS Turbopack hot-reload gotcha**: Nya API route-filer (`src/app/api/*/route.ts`) registreras inte alltid av Turbopack hot-reload. Dev-servern kan returnera 404 trots att filen finns. Fix: starta om dev-servern (`npm run dev`).
- **iOS dual auth-system (JWT + session-cookie)**: Native APIClient använder mobile JWT (Bearer token), WebView-sidor använder session-cookie via NextAuth `useSession()`. De är helt oberoende -- en kan fungera medan den andra failar. Vid "data laddas inte" i WebView: injicera `fetch('/api/auth/session')` via `evaluateJavaScript` och skicka resultatet genom bridge för att se session-status.
- **iOS WKWebView JS-debugging utan Safari Inspector**: Injicera JavaScript via `evaluateJavaScript` som gör `fetch()` och skickar resultat via `window.webkit.messageHandlers.equinet.postMessage()`. Logga i Swift via `AppLogger`. Fungerar på fysiska enheter utan Safari-koppling.
- **iOS Simulator MCP**: `mobile-mcp` (`@mobilenext/mobile-mcp`) for all iOS Simulator-interaktion: screenshot, accessibility tree, tap/swipe/type, launch/install app, screen recording. Anvander XCUITest/WebDriverAgent (inga extra beroenden utover Xcode). Ersatter ios-simulator-mcp vars IDB-baserade verktyg inte fungerar med Xcode 26.
- **iOS UI-verifiering**: Vid iOS UI-andringar -- anvand mobile-mcp for screenshots, accessibility tree och interaktion. Fixa problem direkt utan att fraga.
- **iOS WKWebView retain cycle**: `WKUserContentController.add(_:name:)` håller STARK referens till handler. Wrappa ALLTID i `WeakScriptMessageHandler` med `weak var delegate`. Komplettera med `dismantleUIView` som kör `removeScriptMessageHandler` + `removeAllUserScripts`.
- **iOS viewport-fit=cover statiskt**: Använd `export const viewport: Viewport = { viewportFit: "cover" }` i Next.js layout.tsx -- INTE dynamisk JS-injektion. Ger `env(safe-area-inset-*)` från första rendering. Behåll JS-injektion som fallback.
- **iOS Static DateFormatter**: DateFormatter är dyrt att skapa. Använd `private static let` på struct-nivå i SwiftUI-vyer. Särskilt viktigt i scroll-tunga vyer (kalender, listor).
- **iOS Native Screen Pattern (WebView->SwiftUI)**: 8 steg: **(0) Feature Inventory (OBLIGATORISKT)**: Läs webbsidans page-komponent + alla subkomponenter rad för rad. Lista ALLA datapunkter, interaktioner, navigeringslänkar, dialoger, statuslogik, felhantering, offlinebeteende och feature flags. Skapa tabell `| Feature | Webb | Native | Beslut |` där beslut = Native/Offload/Skip/Later med motivering. Tabellen granskas INNAN implementation startar. "Vi glömde" är inte ett giltigt beslut. (1) Aggregerat API `/api/native/<screen>` med all data i ett anrop, (2) Codable structs + enum med unknown-fallback, (3) SharedDataManager-cache (5min TTL), (4) `@State`-baserad vy med callbacks (`onNavigateToTab`, `onNavigateToWebPath`), (5) Tab-nav via callback, icke-tab via `pendingMorePath` -> Mer-tab -> onChange pushar NavigationPath, (6) Cache-clear i AuthManager.logout(), (7) Nya modellfiler i widget `membershipExceptions` om SharedDataManager refererar dem. **Extra DoD för native-konvertering**: Visuell jämförelse (screenshot webb vs native), interaktionsjämförelse (varje klickbar element har motsvarighet eller beslut), alla datapunkter har beslut, simulator-verifiering med mobile-mcp.
- **iOS pendingMorePath programmatisk navigation**: Sätt `coordinator.pendingMorePath = "/path"` + `coordinator.selectedTab = .more`. NativeMoreView.onChange pushar matchande MoreMenuItem eller temporärt item. Nollställs direkt efter push.
- **iOS NativeMoreView native-routing**: I `navigationDestination(for: MoreMenuItem.self)` -- kolla `item.path == "/provider/X"` -> visa native vy istället för MoreWebView. Lägg till `navigationDestination(for: ModelType.self)` för detalj-push.
- **iOS Segmented Picker för tabs i detaljvy**: Använd `Picker(.segmented)` + `switch` -- INTE SwiftUI TabView (krockar med swipe-to-delete i List). Varje tab är en `@ViewBuilder` computed property.
- **iOS CustomerSheetType enum-pattern**: `enum SheetType: Identifiable` med en enda `.sheet(item:)` modifier. Varje case har egen presentationDetents. Undviker multipla `.sheet`-modifiers som kan krocka.

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

**Senast uppdaterad**: 2026-03-06
