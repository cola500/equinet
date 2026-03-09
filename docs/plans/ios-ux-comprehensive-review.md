---
title: "iOS App -- Komplett UX-genomgång och förbättringar"
description: "Systematisk genomgång: säkerhet, loggning, tillgänglighet, testning och native-känsla"
category: plan
status: in_progress
last_updated: 2026-03-09
sections:
  - Context
  - Riskanalys
  - Session A
  - Session B
  - Session C
  - Session D
  - Session E
  - Session F
  - Session G
  - Sessionsordning
tags:
  - ios
  - ux
  - security
  - testing
---

# Plan: iOS App -- Komplett UX-genomgång och förbättringar

## Context

iOS-appen (26 Swift-filer, 24 XCTest) är en hybrid WKWebView-app med native SwiftUI-overlays för login, kalender, push, tal och widget. Grundfunktionaliteten finns, men en systematisk genomgång avslöjar säkerhetsluckor, tillgänglighetsgap, saknad testning och möjligheter till mer native känsla.

Målet: lyfta appen från "funktionell hybrid" till "polerad native-upplevelse".

**Simulator**: iPhone 17 Pro (tillgänglig i Xcode 26, OS 26.3.1)
**Build-kommando**: `xcodebuild build -project Equinet.xcodeproj -scheme Equinet -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet`
**Test-kommando**: `xcodebuild test -project Equinet.xcodeproj -scheme Equinet -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:EquinetTests`

---

## Riskanalys (simulering)

Identifierade risker från torrköring -- alla har mitigeringar nedan.

| # | Risk | Allvarlighet | Mitigering |
|---|------|-------------|------------|
| R1 | AppLogger.swift måste inkluderas i widget extension target -- KeychainHelper.swift kompileras av BÅDA targets | **HÖG** | Behåll `print()` i KeychainHelper.swift (enda delade filen). AppLogger i alla övriga. |
| R2 | PendingBookingAction retryCount -- breaking change för cachad data | **MEDEL** | `retryCount` optional med default 0: `var retryCount: Int = 0` |
| R3 | NetworkMonitor callback-borttagning -- reconnect-logik (banner, retryAll, bridge) lever i callbacken | **MEDEL** | Flytta ALL logik till `.onChange(of: networkMonitor.isConnected)` i ContentView |
| R4 | clearMobileToken() är synkron men APIClient.unregisterDeviceToken() är async (actor) | **LÅG** | Fire-and-forget `Task { try? await ... }` före Keychain-rensning |
| R5 | WebView data-rensning + ny WebView skapas samtidigt | **LÅG** | Rensa data, SEDAN sätt nytt webViewId. `removeData` är async men behöver inte väntas på. |
| R6 | Dynamic Type på logo-ikoner (48pt, 64pt) -- semantisk font kan se fel ut | **LÅG** | Behåll `.system(size:)` för dekorativa ikoner, byt bara text-fonter |
| R7 | GitHub Actions Xcode 26 tillgänglighet | **MEDEL** | Verifiera `macos-latest` runner-version före implementering. Fallback: `macos-15` med Xcode select. |
| R8 | WKHTTPCookieStoreObserver (LF-2) -- `cookiesDidChange` för ALLA cookies | **MEDEL** | Filtrera på cookie-namn pattern (`authjs.session-token` / `__Secure-authjs.session-token`) |

---

## Session A: Säkerhet + Loggning + Brand (QW-1, QW-2, QW-3, QW-5)

### Fas 1: QW-5 -- Color+Brand.swift

**Ny fil:** `ios/Equinet/Equinet/Color+Brand.swift`
```swift
extension Color {
    static let equinetGreen = Color(red: 0.16, green: 0.65, blue: 0.47)
}
```

**Ändringar:**
- `NativeLoginView.swift`: Ta bort `private let brandGreen = ...`, ersätt alla `brandGreen` -> `Color.equinetGreen`
- `BiometricPromptView.swift`: Samma
- `SplashView.swift`: `Color(red: 0.16, green: 0.65, blue: 0.47)` -> `Color.equinetGreen`
- `NativeTabBar.swift`: `Color.accentColor` -> `Color.equinetGreen` på aktiv tab

**Ingen widget-påverkan** -- widget-filerna använder inte brand-färger.

### Fas 2: QW-3 -- AppLogger

**Ny fil:** `ios/Equinet/Equinet/AppLogger.swift`
Kategorier: auth, bridge, calendar, keychain, network, push, speech, webview, sync

**Print-ersättningar (~33 st) i 10 filer:**
- `BridgeHandler.swift` -> AppLogger.bridge
- `WebView.swift` -> AppLogger.webview
- `AppDelegate.swift` -> AppLogger.push
- `PushManager.swift` -> AppLogger.push (VIKTIGT: logga INTE device token -- känslig data)
- `SpeechRecognizer.swift` -> AppLogger.speech
- `PendingActionStore.swift` -> AppLogger.sync
- `CalendarViewModel.swift` -> AppLogger.calendar
- `CalendarSyncManager.swift` -> AppLogger.calendar
- `AuthManager.swift` -> AppLogger.auth

**UNDANTAG (R1):** `KeychainHelper.swift` -- BEHÅLL `print()`. Filen kompileras av widget extension target som inte har AppLogger.

**KRAV:** Varje fil som använder AppLogger MÅSTE ha `import OSLog`.

### Fas 3: QW-1 -- Push-token avregistrering

**Fil:** `BridgeHandler.swift`, metod `clearMobileToken()`

**Logik (R4-mitigerad):**
- Unregistrera device token INNAN Keychain rensas (behöver JWT för auth)
- Fire-and-forget med `try?` -- blockerar inte logout vid nätverksfel

### Fas 4: QW-2 -- WebView-data rensning

**Filer:** `ContentView.swift`, `WebView.swift`

- Ny `@State private var webViewId = UUID()`
- `.onChange(of: authManager.state)` -- vid `.loggedOut`: rensa alla cookies/localStorage/IndexedDB
- `.id(webViewId)` på WebView för att tvinga re-creation
- `import WebKit` i ContentView

**Verifiering fas A:** `xcodebuild clean build` -- båda targets måste kompilera.

---

## Session B: Haptics + Backoff + NetworkMonitor (QW-4, MI-1, MI-4)

### Fas 1: QW-4 -- Haptic-konsistens

- AuthManager: haptic `.success` efter lyckad login/biometric
- NativeCalendarView: selection haptic på filter pills
- ContentView: impact haptic på "Försök igen"-knapp

### Fas 2: MI-4 -- NetworkMonitor onChange-pattern

- Ta bort `onStatusChanged` callback och `getConnectionType()`
- Flytta ALL reconnect-logik till `.onChange(of: networkMonitor.isConnected)` i ContentView

### Fas 3: MI-1 -- PendingActionStore backoff + resiliens

- `retryCount` på PendingBookingAction (optional default 0, bakåtkompatibelt)
- Exponentiell backoff med jitter
- Max 5 retries -> discard
- Circuit breaker: 2 konsekutiva failures -> break loop
- Module-level `isRetrying` guard

**Verifiering fas B:** `xcodebuild build` + `xcodebuild test -only-testing:EquinetTests`

---

## Session C: DI + Tester (MI-2, MI-7)

### Fas 1: MI-2 -- CalendarViewModel DI

- Protokoll: `CalendarDataFetching`, `CalendarCaching`, `CalendarSyncing`
- Adapter-structs för production
- Constructor injection med defaults
- `CalendarViewModelTests.swift` (~15-20 tester)

### Fas 2: MI-7 -- BridgeHandler testbarhet

- Protokoll: `SpeechRecognizable`
- Constructor injection i BridgeHandler
- `BridgeHandlerTests.swift` (~10-15 tester)

**Verifiering fas C:** `xcodebuild test -only-testing:EquinetTests`

---

## Session D: Tillgänglighet + Native Feel (MI-3, MI-5, LF-1)

### Fas 1: MI-3 -- Dynamic Type

- Byt fixed font sizes till semantiska (.title3, .caption2) -- behåll dekorativa ikoner

### Fas 2: MI-5 -- Kalender-övergångsanimationer

- Transition på native calendar VStack
- ProgressView för loading state

### Fas 3: LF-1 -- VoiceOver-granskning

- Bokningsblock: combine children, accessibility labels/hints/traits
- Filter pills: isSelected trait
- Now-line: updatesFrequently trait
- Tab bar: isSelected trait
- Date header: adjustableAction

**Verifiering fas D:** `xcodebuild build` + manuell VoiceOver-test

---

## Session E: Robusthet (MI-6, LF-2)

### Fas 1: MI-6 -- APIClient felkategorisering

- Nya error cases: `rateLimited`, `timeout`
- 429-hantering med Retry-After
- Differentierade felmeddelanden i CalendarViewModel

### Fas 2: LF-2 -- WebView cookie-livscykel

- WKHTTPCookieStoreObserver
- Filtrera på session-token cookies
- 401-detektion -> auto-logout

**Verifiering fas E:** `xcodebuild build` + manuell test

---

## Session F: Infrastruktur (LF-3, LF-4)

### Fas 1: LF-3 -- iOS CI-pipeline

- `.github/workflows/ios-tests.yml`
- Trigger: push/PR som rör `ios/**`

### Fas 2: LF-4 -- Widget background refresh

- BGAppRefreshTaskRequest
- Background handler för widget-data-refresh

**Verifiering fas F:** `xcodebuild build`

---

## Session G: Testcoverage (LF-5)

### Fas 1: SpeechRecognizer tester

- AudioSessionConfigurable-protokoll + DI
- 15+ tester

### Fas 2: CalendarSyncManager tester

- EventStoreProtocol + DI
- 15+ tester

**Verifiering fas G:** `xcodebuild test -only-testing:EquinetTests`

---

## Sessionsordning

| Session | Innehåll | Nya tester | Nya filer | Påverkan |
|---------|----------|-----------|-----------|----------|
| **A** | QW-5 + QW-3 + QW-1 + QW-2 | 0 | Color+Brand.swift, AppLogger.swift | Säkerhet + loggning |
| **B** | QW-4 + MI-4 + MI-1 | ~8 | 0 | Tillförlitlighet + haptics |
| **C** | MI-2 + MI-7 | ~30 | CalendarViewModelTests.swift, BridgeHandlerTests.swift | Testbarhet |
| **D** | MI-3 + MI-5 + LF-1 | 0 | 0 | Tillgänglighet + native feel |
| **E** | MI-6 + LF-2 | ~5 | 0 | Robusthet |
| **F** | LF-3 + LF-4 | 0 | ios-tests.yml | Infrastruktur |
| **G** | LF-5 | ~30 | 2 testfiler | Testcoverage |

**Totalt:** ~73 nya tester, 3 nya produktionsfiler, ~20 ändrade filer
