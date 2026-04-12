---
title: "iOS Key Learnings"
description: "Samlade iOS/Swift/Xcode-lärdomar från native-utvecklingen"
category: rule
status: active
last_updated: 2026-04-12
tags: [ios, swift, xcode, native]
paths:
  - "ios/**"
  - "src/app/api/native/**"
sections:
  - Utvecklingsmönster
  - iOS-testflöde
---

# iOS Key Learnings

> Flyttade från CLAUDE.md för att minska kontextladdning vid webb-arbete.

## Utvecklingsmönster

- **iOS import OSLog gotcha**: `os.Logger`-stränginterpolering kräver `import OSLog` i den anropande filen, inte bara där Logger definieras. Swift resolvar `OSLogMessage` vid call-site.
- **iOS widget extension target-membership**: Nya .swift-filer som används av delade filer (KeychainHelper, SharedDataManager) MÅSTE läggas till i `membershipExceptions` i `project.pbxproj` för widget extension target.
- **iOS Xcode target-skapande förstör pbxproj**: Xcode re-serialiserar PBXFileSystemSynchronizedRootGroup vid ny target och tappar befintliga `PBXFileSystemSynchronizedBuildFileExceptionSet`. ALLTID spara backup + diff efter manuella Xcode-steg.
- **iOS Xcode DerivedData vid branch-byte**: Efter `git merge`/`checkout` som lägger till nya .swift-filer kan Xcode ge "Cannot find type X in scope" trots att filerna finns på disk. Fix: `rm -rf ~/Library/Developer/Xcode/DerivedData/Equinet-*`, stäng och öppna om projektet, bygg.
- **iOS optimistisk UI**: Spara `oldState` före mutation, uppdatera UI direkt, reverta vid error. Kräver `withStatus()`-copy-metod på Codable struct. Haptic `.success`/`.error` efter resultat.
- **iOS nya Codable-fält bakåtkompatibla**: Nya fält som `serviceId` måste vara optionella (`String?`) om cachad data kan sakna dem.
- **iOS context menu > swipeActions i kalender**: `contextMenu` undviker krock med TabView page-swipe.
- **iOS callback-pattern för navigering**: NativeCalendarView tar `onNavigateToWeb: ((String) -> Void)?` istället för att exponera ContentViews state-binding.
- **iOS test bundle ID prefix**: Test-target MÅSTE ha bundle ID som är prefix av parent app (`com.equinet.Equinet.EquinetTests`).
- **iOS Xcode 26 kräver explicit .xctestplan**: `shouldAutocreateTestPlan` är otillförlitligt. Skapa ALLTID `EquinetTests.xctestplan` manuellt.
- **iOS XCTest setup**: `xcodebuild test -project ... -scheme Equinet -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:EquinetTests`
- **iOS CI simctl vs xcodebuild**: `simctl list devices` och `xcodebuild -showdestinations` returnerar OLIKA UDID:er. Använd namnbaserad destination (`name=iPhone 17 Pro`).
- **iOS CSS-injektion för att dölja webb-chrome**: WKWebView visar webbens BottomTabBar + Header ovanpå native TabView. Fix: injicera CSS i `WebView.swift`.
- **iOS NativeMoreView NavigationStack-mönster**: Native meny (SwiftUI List + sektioner) med NavigationLink som pushar WebView-wrapper.
- **iOS Turbopack hot-reload gotcha**: Nya API route-filer registreras inte alltid av Turbopack. Fix: starta om dev-servern.
- **iOS Swift Charts**: `import Charts` i SwiftUI-filer. `Chart { BarMark(x:y:) }` for bar charts, `LineMark(x:y:series:)` for line charts.
- **iOS HeatmapMatrix pre-computation**: Transformera API heatmap-data till 2D-matris i ViewModel. Vyn läser bara från matrisen.
- **iOS SharedDataManager cache per parameter**: `insights_cache_\(months)` ger separata caches för varje variabel.
- **iOS auth via Supabase Swift SDK**: Login via `SupabaseManager.client.auth.signIn()`, session exchange via `/api/auth/native-session-exchange` (PKCE).
- **iOS WKWebView JS-debugging utan Safari Inspector**: Injicera JavaScript via `evaluateJavaScript`, logga i Swift via `AppLogger`.
- **iOS Simulator MCP**: `mobile-mcp` (`@mobilenext/mobile-mcp`) för all iOS Simulator-interaktion.
- **iOS UI-verifiering**: Vid iOS UI-ändringar -- använd mobile-mcp för screenshots och interaktion.
- **iOS WKWebView retain cycle**: `WKUserContentController.add(_:name:)` håller STARK referens. Wrappa i `WeakScriptMessageHandler` med `weak var delegate`.
- **iOS viewport-fit=cover statiskt**: Använd `export const viewport: Viewport = { viewportFit: "cover" }` i layout.tsx.
- **iOS Static DateFormatter**: DateFormatter är dyrt att skapa. Använd `private static let` på struct-nivå.
- **iOS Native Screen Pattern (WebView->SwiftUI)**: 8 steg med Feature Inventory (OBLIGATORISKT). Se CLAUDE.md för fullständigt mönster.
- **iOS pendingMorePath programmatisk navigation**: Sätt `coordinator.pendingMorePath` + `coordinator.selectedTab = .more`.
- **iOS NativeMoreView native-routing**: Kolla `item.path` i `navigationDestination` -> visa native vy istället för MoreWebView.
- **iOS Segmented Picker för tabs i detaljvy**: Använd `Picker(.segmented)` + `switch` -- INTE SwiftUI TabView.
- **iOS CustomerSheetType enum-pattern**: `enum SheetType: Identifiable` med en enda `.sheet(item:)` modifier.
- **iOS Feature Flag-mönster**: APIClient `fetchFeatureFlags()` utan Bearer. AppCoordinator med UserDefaults-cache.
- **iOS URL(string:relativeTo:) inte appendingPathComponent**: `appendingPathComponent()` URL-encodar `/`.

## iOS-testflöde

Full `EquinetTests` tar ~4 min pga simulator-overhead. ViewModel-testerna tar <1s. **Kör alltid Nivå 1 först.**

**Nivå 1 -- Under arbete (default):** Kör bara berörda testsviter:
```bash
xcodebuild test -project Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,id=<UDID>' \
  -only-testing:EquinetTests/BookingsViewModelTests
```

**Nivå 2 -- Inför PR:** Kör full svit en gång:
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
