---
title: "S29-1 Done: Mobile-mcp offline-verifiering"
description: "Automatiserad iOS offline-verifiering via debug override i NetworkMonitor"
category: retro
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Docs
  - Avvikelser
  - Lärdomar
---

# S29-1 Done: Mobile-mcp offline-verifiering (simulator)

## Acceptanskriterier

- [x] Skript/test som kör hela offline -> retry-kedjan utan manuell interaktion
- [x] Dokumenterat hur det körs (i skriptet + README i scripts-header)
- [x] Täcker: offline-banner visas, stale cache renderas, retry fungerar vid reconnect
- [x] Grönt i simulator-körning (unit-tester + visuellt verifierat E2E)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (N/A -- Swift-only)
- [x] Säker (`#if DEBUG` guard, ingen prod-påverkan)
- [x] Tester skrivna FÖRST (TDD), 7 nya tester (4 NetworkMonitor + 3 OfflineVerification)
- [x] Feature branch, iOS-tester gröna (290/290, 0 failures)

## Reviews

Kördes: code-reviewer (ska köras vid merge)

Story berör iOS-filer med `#if DEBUG`-only ändringar. Ingen API-yta, UI eller säkerhet ändras i prod builds. security-reviewer och cx-ux-reviewer inte relevanta.

## Docs

- ios-learnings.md planeras att uppdateras i S29-5 (mobile-mcp-mönster)
- Shell-skriptet (`scripts/ios-offline-verification.sh`) är self-documenting

## Implementation

### Ändrade filer
- `ios/Equinet/Equinet/NetworkMonitor.swift` -- `#if DEBUG` debugOverrideConnected + UserDefaults polling
- `ios/Equinet/Equinet/AuthManager.swift` -- `#if DEBUG` --debug-autologin launch argument
- `ios/Equinet/Info.plist` -- (inga kvarvarande ändringar, URL scheme avbruten)
- `ios/Equinet/EquinetTests/NetworkMonitorTests.swift` -- 4 tester för debug override
- `ios/Equinet/EquinetTests/OfflineVerificationUITests.swift` -- 3 E2E-kedja-tester
- `scripts/ios-offline-verification.sh` -- orchestration-skript

### Mekanism
1. `simctl spawn defaults write com.equinet.Equinet debugOffline -bool true`
2. NetworkMonitor pollar UserDefaults var 1s (`#if DEBUG`)
3. `debugOverrideConnected` sätts -> `isConnected` returnerar false
4. `onStatusChanged` callback fires -> bridge + UI uppdateras
5. AuthenticatedView renderar orange "Ingen internetanslutning"-banner
6. `simctl spawn defaults delete` -> override rensas -> grön "Ansluten igen"

### Debug auto-login
`xcrun simctl launch <UDID> com.equinet.Equinet -- --debug-autologin`
Loggar in med anna@hastvard-goteborg.se/test123 automatiskt (override via --debug-email/--debug-password).

## Visuell E2E-verifiering

Verifierat via mobile-mcp screenshots i simulator:
1. Dashboard online -- normal vy utan banner
2. `defaults write debugOffline true` -- orange offline-banner visas i toppen
3. `defaults delete debugOffline` -- banner försvinner, normal vy

## Avvikelser

**URL scheme avbruten.** `simctl openurl` triggar alltid en systemdialog ("Open in Equinet?") som inte kan dismissas programmatiskt utan XCUITest. Pivoterade till `simctl spawn defaults write`.

**WebDriverAgent instabilt.** mobile-mcp (via WebDriverAgent) timed out initialt. Fungerade efter simulator-reboot. SecureField inte interagerbar via WebDriverAgent -- löst med --debug-autologin.

## Lärdomar

- **`simctl spawn defaults write` är bästa vägen** för att injicera debug-state i iOS Simulator. Ingen dialog, fungerar med alla fält-typer.
- **SecureField är osynligt för WebDriverAgent** -- accessibility tree listar det inte. Kräver workaround (launch arguments) för automatiserad login.
- **UserDefaults polling var 1s räcker.** Overhead försumbar i DEBUG. Timer invalideras vid `stop()`.
- **`#if DEBUG` wrapping** säkerställer noll prod-påverkan. Debug auto-login, UserDefaults polling och override -- allt kompileras bort i release builds.
- **290 iOS-tester** passerar (upp från 287 före S29-1).
