---
title: "Retrospektiv: Native iOS Dashboard"
description: "WebView-dashboard ersatt med native SwiftUI-vy, aggregerat API-endpoint, 5min cache, programmatisk tab-navigation"
category: retrospective
status: active
last_updated: "2026-03-14"
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: Native iOS Dashboard

**Datum:** 2026-03-14
**Scope:** Migrera leverantorens dashboard (Tab 1, "Oversikt") fran WebView till native SwiftUI med aggregerat API-anrop

---

## Resultat

- 7 andrade filer, 4 nya filer, 0 migrationer
- 15 nya tester (TDD, alla grona)
- 3297 totala tester + 64 iOS-tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors, Xcode build = succeeded
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API | `src/app/api/native/dashboard/route.ts` (ny) | Aggregerat GET-endpoint: today bookings, KPI counts, review stats, onboarding status, priority action |
| API Test | `src/app/api/native/dashboard/route.test.ts` (ny) | 15 tester: auth, rate limit, KPI-rakningar, onboarding, priority action, empty state, error |
| iOS Modeller | `DashboardModels.swift` (ny) | 6 Codable structs + PriorityActionType enum med unknown-fallback |
| iOS Cache | `SharedDataManager.swift` | Dashboard-cache med 5 min TTL, clearDashboardCache() |
| iOS APIClient | `APIClient.swift` | fetchDashboard() metod |
| iOS Vy | `NativeDashboardView.swift` (ny) | ~400 rader: KPI-grid, idag-sektion, onboarding-checklista, priority action, tomma tillstand, pull-to-refresh |
| iOS Integration | `AuthenticatedView.swift` | WebViewTab ersatt med NativeDashboardView + pendingMorePath |
| iOS Navigation | `AppCoordinator.swift` | pendingMorePath, dashboard.webPath = nil, default tab = .dashboard |
| iOS Navigation | `NativeMoreView.swift` | pendingPath binding + onChange for programmatisk navigation |
| iOS Auth | `AuthManager.swift` | Cache-clear vid logout (dashboard + calendar + widget) |
| Xcode | `project.pbxproj` | DashboardModels i widget extension membershipExceptions |

## Vad gick bra

### 1. TDD-driven API fangade design tidigt
15 tester skrevs fore implementationen. Tvingade fram tydlig response-shape och edge cases (empty state, no reviews, incomplete onboarding) innan en rad produktionskod.

### 2. Planens "torrkorningsmojligheter" sparade tid
Planen identifierade 3 problem i forvag: logout-cache-lask, NativeMoreView-navigation, datum-hantering. Alla tre var riktiga problem som annars hade dykt upp sent.

### 3. Referensfiler som monsterkopiering
calendar/route.ts och NativeCalendarView.swift anvandes som mall. Samma auth-pattern, samma cache-pattern, samma navigation-callback-pattern. Minimerade designbeslut under implementation.

### 4. Aggregerat API-endpoint istallet for multipla anrop
Ett enda GET-anrop returnerar all dashboard-data (4 parallella Prisma-queries server-side). iOS-klienten behovde bara en fetch-metod och en response-struct. Enklare cache, enklare felhantering.

## Vad kan forbattras

### 1. Widget target-membership ar latt att missa
DashboardModels.swift behover kompileras i bade huvudapp OCH widget extension (for att SharedDataManager ska fungera). Detta kraver manuell redigering av pbxproj. Build-felet var forvirrande ("cannot find type in scope").

**Prioritet:** MEDEL -- gotchan finns dokumenterad i CLAUDE.md men den ar svarhittad under implementation.

### 2. Security reviewer-agent hallucinerade filinnehall
Agenten laste inte den verkliga filen utan genererade en hallucination av koden. Alla observationer baserades pa fabricerat innehall. Agenten tillforde inget varde -- manuell granskning hade ratt.

**Prioritet:** LAG -- agent-tooling-problem, inte projektproblem. Manuell sakerhetscheck tog 30s.

### 3. NativeDashboardView ar 400 rader utan tester
SwiftUI-vyn har KPI-grid, onboarding, idag-sektion, tomma tillstand, error handling -- allt i en fil. Ingen testning utover visuell verifiering. Extrahering av subvyer kan goras senare vid behov.

**Prioritet:** LAG -- read-only vy utan komplex logik, SwiftUI previews ar tillrackliga.

## Patterns att spara

### Native Screen Pattern (WebView -> SwiftUI migration)
Monster for att migrera en WebView-tab till native SwiftUI:

1. **API**: Aggregerat endpoint (`/api/native/<screen>`) med all data i ett anrop. Bearer auth via `authFromMobileToken`.
2. **Modeller**: Codable structs i egen fil. Enum med `unknown`-fallback for server-side typer. Optionella falt for bakatkompat.
3. **Cache**: 5 min TTL i SharedDataManager (App Group UserDefaults). Visa cachad data direkt, hamta ny i bakgrunden.
4. **Vy**: `@State`-baserad (read-only), callbacks for navigation (`onNavigateToTab`, `onNavigateToWebPath`).
5. **Navigation**: Tab-destinationer byter tab. Icke-tab-destinationer satter `pendingMorePath` -> byter till Mer-tab -> onChange pushar NavigationPath.
6. **Logout**: Alla caches rensas i AuthManager.logout().
7. **Widget target**: Nya modellfiler som refereras av SharedDataManager MASTE laggas till i `membershipExceptions`.

### Programmatisk Mer-tab Navigation
For att navigera till en sida i Mer-tabben fran en annan tab:
```
coordinator.pendingMorePath = "/provider/reviews"
coordinator.selectedTab = .more
```
NativeMoreView reagerar via `.onChange(of: pendingPath)` och pushar matchande MoreMenuItem (eller temporar).

### Priority Action Pattern
Server beraknar prioriterad atgard (pending > onboarding > none). Klienten visar ratt kort med ratt ikon och navigering. Undviker duplicerad logik pa klienten.

## 5 Whys (Root-Cause Analysis)

### Problem: Widget target build-fel ("cannot find type DashboardResponse in scope")

1. **Varfor?** SharedDataManager.swift refererar DashboardResponse men typen hittades inte.
2. **Varfor?** DashboardModels.swift kompilerades inte i widget extension target.
3. **Varfor?** Xcode PBXFileSystemSynchronizedRootGroup inkluderar INTE filer i andra targets automatiskt -- membershipExceptions ar en opt-in-lista.
4. **Varfor?** SharedDataManager finns i membershipExceptions (widget behovde den), men dess nya beroende (DashboardModels) lades inte till.
5. **Varfor?** Det finns inget automatiskt beroendeanalys-steg -- manuell pbxproj-redigering kravs.

**Atgard:** Gotchan ar dokumenterad i CLAUDE.md ("iOS widget extension target-membership"). Framover: nar SharedDataManager far nya beroenden (Codable-typer), kontrollera ALLTID membershipExceptions.
**Status:** Implementerad (dokumenterad sedan session 91)

## Larandeeffekt

**Nyckelinsikt:** WebView->Native-migrering ar enklast nar man bygger ett aggregerat API-endpoint som returnerar all data for en skarm i ett anrop. Det ger enkel cache (en nyckel), enkel felhantering (en try/catch), och snabb forsta rendering (visa cache -> hamta ny data i bakgrunden). "Native Screen Pattern" (API -> Models -> Cache -> View -> Integration) kan ateranvandas for kommande skarmar (bokningslista, kundlista).
