---
title: "S29-2 Plan: E2E iOS offline-flöde"
description: "Fullständigt E2E-test av iOS offline-kedjan via XCTest + simctl"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Approach
  - Implementation
  - Risker
---

# S29-2: E2E för iOS offline-flödet

## Approach

Bygg ut S29-1:s mekanism till ett fullständigt E2E-test som verifierar hela kedjan
i en verklig app-instans. Testet kör som XCTest (inte XCUITest) med async/await
och använder UserDefaults-polling + debug autologin.

**Scenario:**
1. Anna (leverantör) startar appen (--debug-autologin)
2. Online: dashboard laddas, data visas
3. Tappar nät (debugOffline=true): offline-banner visas, stale cache renderas
4. Navigerar (byter tab): stale cache fortsätter visas
5. Återfår nät (debugOffline=false): banner försvinner, fresh data hämtas

**Varför XCTest och inte XCUITest:**
- Vi har redan NetworkMonitor debug override som simulerar offline
- XCTest kan testa ViewModels direkt (snabbare, stabilare)
- XCUITest kräver separat target + WebDriverAgent (instabilt med SecureField)
- Shell-skriptet från S29-1 finns kvar för visuell verifiering

## Implementation

### Filer

| Fil | Åtgärd |
|-----|--------|
| `ios/Equinet/EquinetTests/OfflineE2ETests.swift` | Nytt -- fullständigt E2E scenario |
| `scripts/ios-offline-verification.sh` | Uppdatera med 3x retry + PASS/FAIL rapport |

### Steg

1. **RED**: Skriv OfflineE2ETests med fullständigt scenario
2. **GREEN**: Implementera (allt finns redan -- mest orchestration)
3. **Verify**: Kör 3 gånger i rad -- inte flaky?
4. **Beslut**: CI eller lokalt pre-release?

## Risker

| Risk | Mitigation |
|------|------------|
| Timer-baserade tester kan vara flaky | Generösa timeouts (2s) + explicit wait |
| DashboardViewModel fetch kräver server | Mock fetcher i test |
