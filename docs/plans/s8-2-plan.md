---
title: "S8-2: Business insights native iOS"
description: "Plan for migrating the business insights screen from WebView to native SwiftUI"
category: plan
status: wip
last_updated: 2026-04-02
sections:
  - Feature Inventory
  - Beslut
  - Approach
  - Filer som andras/skapas
  - Risker
---

# S8-2: Business insights native iOS

## Feature Inventory

Webb-sidan `/provider/insights` har foljande features:

| Feature | Webb | Native | Beslut |
|---------|------|--------|--------|
| 5 KPI-kort (avbokning, no-show, snittbokningsvarde, unika kunder, manuella) | Rutnät med fargkodade varningar | Native cards | **Native** -- enkel data-rendering |
| Periodvaljare (3/6/12 manader) | 3 knappar, default 6 | Native Picker | **Native** -- enkel segmented control |
| Tjanstefordelning (horizontal bar chart) | Recharts BarChart | Swift Charts | **Native** -- Swift Charts ersatter Recharts |
| Tidsanalys (heatmap grid) | CSS grid med farggradering | SwiftUI Grid | **Native** -- Grid + fargade celler |
| Kundretention (line chart) | Recharts LineChart | Swift Charts | **Native** -- Swift Charts ersatter Recharts |
| Info-popovers per KPI/chart | InfoPopover komponent | Native popover | **Native** -- `.popover()` eller `.help()` |
| Offline-hantering | useOnlineStatus + felvy | Inte relevant | **Skip** -- native har egen NetworkMonitor |
| Retry-logik (max 3) | useState + toast | ViewModel retry | **Native** -- automatisk retry vid pull-to-refresh |

### Auth-verifiering

- GET `/api/provider/insights?months=N` -- anvander `auth()` (session-cookie). **Behover native endpoint med Bearer JWT.**

### Feature flags

- **`business_insights`** -- klient-side gate pa UI-navigering (NativeMoreView meny-synlighet).
- Webb-sidan gatear pa klient-sida (`useFeatureFlag`), ingen server-gate pa API-routen.
- Native endpoint kan ata antingen utan server-gate (folja webb-monstre) eller lagga till en. **Beslut: lagg till `route_planning` INTE -- anvand ingen server-gate (foljer befintlig API-route som saknar det).**

## Beslut

1. **Helt native** -- Alla element migreras till SwiftUI. Swift Charts ersatter Recharts.
2. **Aggregerat API** -- `/api/native/insights` med Bearer JWT. Ateranvander samma berakningslogik som befintlig route.
3. **Periodvaljare** -- Segmented Picker med 3/6/12.
4. **Heatmap** -- SwiftUI Grid med fargade RoundedRectangle-celler.
5. **Cache** -- SharedDataManager med 5 min TTL (servern cachar 10 min i Redis ocksa).
6. **Ingen server feature flag** -- Foljer befintlig `/api/provider/insights` som inte har nagon.

## Approach

### Fas 1: API (BDD dual-loop)
1. RED: Integrations- + unit-tester for `/api/native/insights` (GET)
2. GREEN: Implementera endpoint med `authFromMobileToken`, rate limit
   - Ateranvand berakningslogiken fran befintlig route (extrahera gemensam funktion)

### Fas 2: iOS modeller + ViewModel
3. Codable structs i `InsightsModels.swift` (KPIs, serviceBreakdown, timeHeatmap, customerRetention)
4. `InsightsViewModel.swift` med DI-protokoll, periodval-state
5. XCTest for ViewModel (mock-adapter)

### Fas 3: iOS vy + routing
6. `NativeInsightsView.swift` -- KPI-kort, period-picker, 3 chart-sektioner
7. Koppla in NativeMoreView routing
8. APIClient-metod: `fetchInsights(months:)`
9. SharedDataManager-cache (5 min TTL)

### Fas 4: Verifiering
10. `npm run check:all`
11. iOS-tester
12. Visuell verifiering med mobile-mcp

## Filer som andras/skapas

### Nya filer
- `src/app/api/native/insights/route.ts` -- GET
- `src/app/api/native/insights/route.test.ts`
- `ios/Equinet/Equinet/InsightsModels.swift`
- `ios/Equinet/Equinet/InsightsViewModel.swift`
- `ios/Equinet/Equinet/NativeInsightsView.swift`
- `ios/Equinet/EquinetTests/InsightsViewModelTests.swift`

### Andrade filer
- `ios/Equinet/Equinet/NativeMoreView.swift` -- routing for native vy
- `ios/Equinet/Equinet/APIClient.swift` -- ny metod
- `ios/Equinet/Equinet/SharedDataManager.swift` -- insights cache
- `ios/Equinet/Equinet.xcodeproj/project.pbxproj` -- widget membership for InsightsModels

## Risker

1. **Swift Charts** -- Forsta anvandningen i projektet. Behover importera Charts-framework. Tillgangligt fran iOS 16+.
2. **Heatmap-rendering** -- CSS grid till SwiftUI Grid krav anpassning. 7 dagar x ~12 timmar = ~84 celler. Maste vara performant.
3. **Berakningslogik-duplicering** -- Befintlig route har komplex berakningslogik. Extrahera till delad service for att undvika duplicering.
4. **Cache-staleness vid periodbytte** -- Olika perioder ger olika data. Cache-nyckel maste inkludera period.
