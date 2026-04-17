---
title: "S29-1 Plan: Mobile-mcp offline-verifiering"
description: "Plan för automatiserad iOS offline-verifiering i simulator via mobile-mcp"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Problemanalys
  - Approach
  - Implementation
  - Risker
---

# S29-1: Mobile-mcp offline-verifiering (simulator)

## Problemanalys

iOS Simulator delar host-nätverket -- det finns inget `simctl`-kommando för att stänga av nätverket. Vi behöver en alternativ approach.

**Befintlig arkitektur:**
- `NetworkMonitor.swift` använder NWPathMonitor (realtid)
- `NetworkBannerView.swift` visar orange "Ingen internetanslutning" / grön "Ansluten igen"
- `AuthenticatedView` visar bannern baserat på `coordinator.networkMonitor.isConnected`
- `DashboardViewModel` tar `NetworkStatusProviding` via DI, hanterar stale cache vid offline
- Unit-tester med `MockNetworkStatus` finns redan -- verifierar ViewModel-beteendet

**Vad saknas:** End-to-end verifiering att hela kedjan fungerar i den faktiska appen -- UI renderar bannern, cache visas, retry fungerar.

## Approach: DEBUG-override i NetworkMonitor

Lägg till en `#if DEBUG`-endpoint som låter oss simulera offline programmatiskt:

1. **NetworkMonitor får `debugOverrideConnected: Bool?`** -- när satt, ignorerar NWPathMonitor
2. **Debug-only URL scheme** (`equinet://debug/network?offline=true`) som triggar override
3. **Shell-skript** (`scripts/ios-offline-verification.sh`) som orchestrerar via `simctl openurl` + mobile-mcp screenshots/accessibility checks

Detta ger oss:
- Faktisk UI-rendering (inte bara ViewModel-test)
- Repeterbart utan att röra host-nätverk
- Kan köras i CI (bara simulator + simctl behövs)
- mobile-mcp används för visuell verifiering (screenshots + accessibility tree)

## Implementation

### Filer som ändras/skapas

| Fil | Åtgärd |
|-----|--------|
| `ios/Equinet/Equinet/NetworkMonitor.swift` | Lägg till `#if DEBUG` override |
| `ios/Equinet/Equinet/EquinetApp.swift` | Registrera URL scheme handler |
| `scripts/ios-offline-verification.sh` | Nytt -- orchestration-skript |
| `ios/Equinet/EquinetTests/NetworkMonitorTests.swift` | Nytt -- testa debug override |

### Steg-för-steg

**Steg 1: RED** -- Skriv test för debug override i NetworkMonitor
- `testDebugOverrideDisconnects` -- sätter override, isConnected -> false
- `testDebugOverrideReconnects` -- tar bort override, isConnected -> true
- `testDebugOverrideTriggersCallback` -- onStatusChanged anropas

**Steg 2: GREEN** -- Implementera debug override
- `#if DEBUG` property `debugOverrideConnected: Bool?` i NetworkMonitor
- `isConnected`-computed property som kollar override först, sedan NWPathMonitor
- URL scheme handler i EquinetApp som sätter override

**Steg 3: Shell-skript** -- `scripts/ios-offline-verification.sh`
```
1. Boota simulator (om inte redan igång)
2. Installera och starta appen
3. Vänta på att appen laddats (sleep + screenshot check)
4. Ta baseline screenshot (online)
5. Trigga offline: simctl openurl <device> "equinet://debug/network?offline=true"
6. Vänta 2s
7. Ta screenshot + kolla accessibility tree för "Ingen internetanslutning"
8. Trigga online: simctl openurl <device> "equinet://debug/network?offline=false"
9. Vänta 2s
10. Ta screenshot + kolla accessibility tree för "Ansluten igen"
11. Rapportera PASS/FAIL
```

**Steg 4: Verifiera** -- Kör skriptet mot simulator, bekräfta grönt.

## Risker

| Risk | Mitigation |
|------|------------|
| URL scheme krockar med prod | `#if DEBUG` guard -- URL scheme registreras bara i debug builds |
| NWPathMonitor override leaker till prod | Hela debug-mekanismen wrappas i `#if DEBUG` |
| Timing -- banner hinner inte visas | Generösa sleeps (2s) + retry i skriptet |
| simctl openurl stöds inte i alla Xcode-versioner | Har funnits sedan Xcode 11, borde vara safe |
