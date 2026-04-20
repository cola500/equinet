---
title: "iOS Key Learnings"
description: "Samlade iOS/Swift/Xcode-lärdomar från native-utvecklingen"
category: rule
status: active
last_updated: 2026-04-20
tags: [ios, swift, xcode, native, mobile-mcp, offline]
paths:
  - "ios/**"
  - "src/app/api/native/**"
sections:
  - Utvecklingsmönster
  - iOS-testflöde
  - Mobile-mcp och simulator-verifiering
  - iOS offline-testning
---

# iOS Key Learnings

> Flyttade från CLAUDE.md för att minska kontextladdning vid webb-arbete.

## QA Fresh-install testflöde (S48-0)

För att verifiera att native login → WebView-sidor fungerar på en ny enhet:

1. Ta bort appen från simulatorn: `xcrun simctl uninstall <UDID> com.equinet.Equinet`
2. Starta appen med `-STAGING`-argument (pekar på staging/prod URL)
3. Logga in med testanvändare via native login-skärm
4. Öppna Mer-menyn → välj en WebView-sida (t.ex. Meddelanden)
5. Verifiera att sidan LADDAR utan "Kunde inte ladda"-fel
6. Om fel: kontrollera `HTTPCookieStorage.shared.cookies(for: baseURL)` i loggarna

**Accepterat resultat:** WebView-sidan laddar och visar autentiserat innehåll direkt efter native login.

**Känd gotcha (S48-0):** `HTTPURLResponse.allHeaderFields` mergar duplicerade `Set-Cookie`-headers i HTTP/2 (Vercel) — bara SISTA värdet bevaras i `[String: String]`-dictionary. Supabase SSR sätter 2 cookie-chunks, men `allHeaderFields` ger bara en. Fix: läs från `HTTPCookieStorage.shared.cookies(for: url)` istället (URLSession parsar alla `Set-Cookie`-headers korrekt).

**URLSession DI i AuthManager:** `AuthManager(keychain:urlSession:)` accepterar en `URLSession`-parameter (default `.shared`) för testbarhet. Tester skapar `URLSessionConfiguration.ephemeral` med `MockURLProtocol` för att intercepta nätverksanrop utan riktiga requests.

---

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
- **iOS haptic rollfördelning (ViewModel vs View)**: ViewModel äger action-haptics (`UINotificationFeedbackGenerator` vid CRUD-success/error). View äger refresh-haptics (pull-to-refresh). Dubbelhaptic uppstår om view lägger `.sensoryFeedback` ovanpå ViewModel-haptic för samma action. **Kolla ALLTID ViewModel för befintliga `UINotificationFeedbackGenerator`-anrop innan view-layer haptics läggs till.**
- **iOS haptic trigger-pattern**: Använd `@State private var hapticX = false` + `.sensoryFeedback(.success, trigger: hapticX)` + `hapticX.toggle()` vid rätt event. **Fel timing:** `.sensoryFeedback(trigger: items.count)` triggar vid initial load OCH varje count-ändring, inte vid explicit user action.

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

## Mobile-mcp och simulator-verifiering

### När använda vad

| Verktyg | När | Styrka | Svaghet |
|---------|-----|--------|---------|
| **XCTest (ViewModel-nivå)** | Logik, state-maskiner, cache-beteende | Snabbt (<1s), deterministiskt, inga beroenden | Testar inte rendering |
| **mobile-mcp** | Visuell verifiering, accessibility tree, screenshots | Ser vad användaren ser, bra för UI-regressioner | Kräver bootad simulator, WebDriverAgent-timeout vid kallstart |
| **ios-offline-verification.sh** | Snabb pre-release-check av offline-kedjan | Helt headless, skriptas i CI | Verifierar bara screenshots, inte element-state |
| **XCUITest** | Komplex UI-interaktion med assertions | Kan assertera på element-properties | SecureField osynligt i accessibility tree, instabilt med WebView |

**Tumregel:** Skriv logik-tester som XCTest. Verifiera UI visuellt med mobile-mcp. Kör shell-skript som pre-release gate.

### Mobile-mcp grundflöde

```
1. mobile_take_screenshot      -- se aktuellt state
2. mobile_list_elements_on_screen -- hitta element + koordinater
3. mobile_click_on_screen_at_coordinates -- interagera
4. mobile_take_screenshot      -- verifiera resultat
```

### Mobile-mcp gotchas

- **WebDriverAgent timeout vid kallstart**: Efter simulator-boot/omstart kan första `mobile_take_screenshot` timeouta. Fix: boota simulator med `simctl boot`, vänta ~10s, försök igen.
- **SecureField osynligt**: iOS `SecureField` listas INTE i accessibility tree via WebDriverAgent. Går inte att tappa på eller skriva i. Fix: använd `--debug-autologin` launch argument istället.
- **`type_keys` med `\n`**: Skickar literal `\n` som text, inte Enter/Return. Använd `submit: true` parameter eller `mobile_press_button` med "Return" istället.
- **Koordinater ändras**: Element-positioner beror på simulator-storlek och dynamisk content. Använd ALLTID `mobile_list_elements_on_screen` för att hitta aktuella koordinater innan klick.
- **Kör ALDRIG parallella mobile-mcp-agenter**: iOS Simulator delar state -- parallella sessioner krockar. Kör alltid sekventiellt.

### Debug-autologin (kringgå SecureField)

Appen stöder `--debug-autologin` launch argument (skyddat med `#if DEBUG`):

```bash
xcrun simctl launch <UDID> com.equinet.Equinet --debug-autologin
# Loggar in som anna@hastvard-goteborg.se automatiskt
# Anpassningsbart: --debug-email <email> --debug-password <pw>
```

Testanvändare finns i `prisma/seed.ts`. Default: Anna (leverantör).

## iOS offline-testning

### Arkitektur

iOS Simulator delar värdmaskinens nätverksstack -- det går inte att stänga av nätverket per simulator. Istället använder vi en debug override-mekanism:

```
simctl spawn defaults write → UserDefaults "debugOffline" → NetworkMonitor pollar varje 1s
→ debugOverrideConnected sätts → isConnected returnerar override → onStatusChanged fires
→ OfflineBanner visas/döljs → DashboardViewModel hoppar över fetch vid offline + cache
```

Alla debug-mekanismer är skyddade med `#if DEBUG` -- noll påverkan i release-builds.

### Tre testnivåer

**Nivå 1 -- XCTest (ViewModel-nivå, <1s):**
```swift
// NetworkMonitorTests: 4 tester (override, callbacks)
// OfflineVerificationUITests: 3 tester (polling, DashboardViewModel-integration)
// OfflineE2ETests: 4 tester (fullständigt offline->reconnect scenario med mock fetcher)
```

Kör: `xcodebuild test ... -only-testing:EquinetTests/NetworkMonitorTests`

**Nivå 2 -- Shell-skript (visuell, ~20s):**
```bash
./scripts/ios-offline-verification.sh "iPhone 17 Pro"
# Tar 4 screenshots: baseline, offline (orange banner), reconnected (grön banner), normal
```

**Nivå 3 -- Mobile-mcp (interaktiv verifiering):**
```
mobile_launch_app (com.equinet.Equinet, --debug-autologin)
mobile_take_screenshot → verifiera dashboard
# Trigga offline via simctl:
simctl spawn <UDID> defaults write com.equinet.Equinet debugOffline -bool true
mobile_take_screenshot → verifiera orange "Ingen internetanslutning" banner
simctl spawn <UDID> defaults delete com.equinet.Equinet debugOffline
mobile_take_screenshot → verifiera grön "Ansluten igen" banner
```

### Fallgropar

- **DashboardViewModel fetchar ÄVEN offline om ingen cache finns.** Korrekt beteende -- utan cache måste den försöka. Testa alltid med pre-populerad cache.
- **SharedDataManager.clearDashboardCache()** behövs i setUp/tearDown för att undvika test-cross-contamination.
- **3s overhead per UserDefaults-polling-test** -- acceptabelt men bör inte multipliceras med för många tester.
- **CI-begränsning**: Offline-testerna kräver iOS Simulator, som inte finns i GitHub Actions utan self-hosted macOS runner. Beslut (S29-2): körs lokalt pre-release.
