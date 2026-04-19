---
title: "Plan: iOS XCUITest Bootstrap"
description: "Bootstrap-plan för att lägga till XCUITest UI-testsvit i Equinet iOS-appen"
category: plan
status: draft
last_updated: 2026-04-19
sections:
  - Målbild
  - Bakgrund och motivering
  - Setup-steg
  - Test-fixtures och auth
  - Prioriterade testflöden
  - CI-integration
  - Effort-uppskattning
  - Backlog-placering
  - Beslut
---

# Plan: iOS XCUITest Bootstrap

## Målbild

Lägga till en smoke-nivå XCUITest-svit som täcker login + 3 kritiska native-flöden. Sviten ska köras lokalt och eventuellt i CI.

**Scope:** Smoke, inte full coverage. Vi vill ha automatiserade visuella regressionstest för de vanligaste native-vyerna.

---

## Bakgrund och motivering

**Nuläge:**
- 223 XCTest unit-tester (ViewModels, models, auth, etc.)
- 0 XCUITest UI-tester
- Ad-hoc mobile-mcp-audits (S38-0, S42-4) -- men dessa är manuella

**Problem:**
- Native-konverteringar (dashboard, bokningar, kunder, tjänster, mer, profil) saknar automatiserad regressionstest
- Varje sprint-ändring kan bryta native-UI utan att vi vet
- mobile-mcp är bra för enstaka audits men inte för kontinuerlig verifiering

**Alternativ:**
- Swift Snapshot Testing (iOS Snapshot-tester i backloggen) -- fångar visuella regressioner men kräver golden images
- XCUITest -- mer robust, kan testa flöden, inte bara screenshots
- Båda kan kombineras på sikt

**Valt:** XCUITest-bootstrap nu, snapshot-tester som nästa steg efter XCUITest är stabilt.

---

## Setup-steg

### 1. Skapa EquinetUITests target i Xcode

```
File > New > Target > iOS UI Testing Bundle
Target name: EquinetUITests
Bundle ID: com.equinet.EquinetUITests
```

**Konfiguration:**
- Host application: Equinet
- Deployment target: iOS 17.0+ (matchar app-target)

### 2. Hantera WebDriverAgent-dependency

XCUITest kräver WebDriverAgent (WDA) för simulator-kommunikation. Xcode inkluderar detta automatiskt -- inga extra beroenden behövs.

**OBS:** WDA kan vara instabilt på minor Xcode-uppdateringar. Dokumentera XcodeVersion i CI-setup.

### 3. Test-scheme och konfiguration

Skapa `EquinetUITests.xcscheme`:
- Build action: Equinet + EquinetUITests
- Test action: EquinetUITests
- Environment variable: `XCTEST_AUTH_MODE=mobileToken` (se Auth nedan)

### 4. Simulator-setup

Använd samma simulator som mobile-mcp:
```bash
# Hitta tillgängliga simulatorer
xcrun simctl list devices | grep -E "iPhone 16|iPhone 15"
```

Rekommendera: iPhone 16 (latest iOS).

---

## Test-fixtures och auth

### Problem med WebView-login

XCUITest kan INTE interagera direkt med Supabase WebView-login pga:
1. WebView är en "black box" för XCUITest
2. OAuth-redirects är svåra att hantera

### Lösning: MobileToken auth

Använda det befintliga MobileToken JWT-systemet:
1. Generera en MobileToken via API för test-provider
2. Injicera token via `launchArguments`/`launchEnvironment`
3. App-koden (AppCoordinator) detekterar token och hoppar över WebView-login

**Implementation:**
```swift
// I EquinetUITests setUp():
let app = XCUIApplication()
app.launchEnvironment["XCTEST_MOBILE_TOKEN"] = TestFixtures.providerToken
app.launchArguments += ["-UITestingMode", "true"]
app.launch()
```

```swift
// I AppCoordinator (om token finns i launchEnvironment):
if let token = ProcessInfo.processInfo.environment["XCTEST_MOBILE_TOKEN"] {
    // Bypass WebView login -- injicera token direkt
    keychainHelper.saveToken(token)
    navigateToDashboard()
}
```

**Testdata:** Använd samma test-credentials som E2E (provider@example.com / ProviderPass123!). Generera token i test-setup via `/api/auth/mobile-token`.

### TestFixtures.swift

```swift
struct TestFixtures {
    static let providerEmail = "provider@example.com"
    // Token genereras mot lokal dev-server (http://localhost:3000)
    static func generateToken(for email: String) -> String { ... }
}
```

---

## Prioriterade testflöden (smoke-nivå)

Baserat på S42-4 native-flöde-audit:

### Test 1: App-launch + Dashboard laddas

```swift
func testDashboardLoads() {
    let dashboard = app.otherElements["NativeDashboardView"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 10))
    // Verifiera att stat-cards visas
    XCTAssertTrue(app.staticTexts["Bokningar"].exists)
}
```

### Test 2: Navigation till Bokningar

```swift
func testNavigateToBookings() {
    app.tabBars.buttons["Bokningar"].tap()
    let bookingsView = app.otherElements["NativeBookingsView"]
    XCTAssertTrue(bookingsView.waitForExistence(timeout: 10))
}
```

### Test 3: Navigation till Tjänster + tjänst-lista laddas

```swift
func testNavigateToServices() {
    app.tabBars.buttons["Tjänster"].tap()
    let servicesView = app.otherElements["NativeServicesView"]
    XCTAssertTrue(servicesView.waitForExistence(timeout: 10))
}
```

**Accessibility identifiers att lägga till i native-vyer:**
- `NativeDashboardView` på ContentView container
- `NativeBookingsView` på BookingsView container
- `NativeServicesView` på ServicesView container

---

## CI-integration

### Alternativ A: Lokal-only (rekommenderat initialt)

Kör i developer-maskiner, INTE i CI. Skäl:
- macOS-runner i GitHub Actions kostar ~$0.08/min (vs $0.008 för ubuntu)
- En 5-min XCUITest-körning = ~$0.40 per run
- Med 10 PRs/sprint = ~$4/sprint -- rimligt men onödigt

**Setup:** Kör manuellt med `xcodebuild test -scheme EquinetUITests` eller via Xcode.

### Alternativ B: CI på macOS-runner (framtida)

```yaml
# .github/workflows/ios-ui-tests.yml
jobs:
  xcuitest:
    runs-on: macos-15
    steps:
      - name: Boot Simulator
        run: xcrun simctl boot "iPhone 16"
      - name: Run XCUITests
        run: |
          xcodebuild test \
            -project ios/Equinet/Equinet.xcodeproj \
            -scheme EquinetUITests \
            -destination 'platform=iOS Simulator,name=iPhone 16'
```

**Kostnad-kalkyl:** Kör bara på merge till main (inte varje PR-push). ~2 körningar/sprint à 10 min = $1.60/sprint.

---

## Effort-uppskattning

| Steg | Effort |
|------|--------|
| Skapa EquinetUITests target | 30 min |
| Implementera token-auth bypass i AppCoordinator | 1h |
| Skriva TestFixtures + generateToken-helper | 1h |
| Skriva 3 smoke-tester | 1h |
| Lägga till accessibility identifiers i native-vyer | 30 min |
| Verifiera kör i lokal simulator | 30 min |
| **Total** | **~4.5h** |

CI-integration (+2-3h om vi vill ha det från start).

---

## Backlog-placering

**Rekommendation: post-launch, inte pre-launch.**

**Motivering:**
- Ingen lanserings-blocker -- vi har 223 unit-tester + mobile-mcp audits
- Effort är ~0.5 dag men kräver native-kod-ändring (token-bypass i AppCoordinator)
- After lansering kan vi mäta vilka native-flöden som faktiskt är kritiska via användardata

**Pre-launch-alternativ:** Om S42-4 (iOS audit) avslöjar ett specifikt flöde som är trasigt OCH som unit-tester inte fångar -- lyft XCUITest för det flödet.

---

## Beslut

| Datum | Beslut |
|-------|--------|
| 2026-04-19 | Plan skapad baserat på S42-4 audit-fynd. Post-launch placering rekommenderad. |

**Nästa steg:**
1. Kör S42-4 iOS-audit -- samla faktiska fynd
2. Beslut: pre-launch eller post-launch baserat på fynd
3. Om pre-launch: börja med token-auth bypass (är det svåraste steget)
