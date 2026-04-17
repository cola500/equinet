---
title: "S28-5: iOS offline-verifiering + forbattringar"
description: "Plan for att verifiera och forbattra iOS-appens offline-upplevelse"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Bakgrund
  - Observationer
  - Forbattringar
  - Filer som andras
  - Risker
  - Testplan
---

# S28-5: iOS offline-verifiering + forbattringar

## Bakgrund

iOS-appen har NetworkMonitor (NWPathMonitor), offline-banner, PendingActionStore (retry 3x),
och SharedDataManager med caches i App Group UserDefaults. Webbens Service Worker hanterar
sin egen cache -- iOS och webb har separata offline-kor.

Sprint-storyn kraver: verifiera offline-upplevelse, implementera minst 1 forbattring.

## Observationer (fran kodlasning)

### Vad som fungerar bra
- NetworkMonitor detekterar natverksandring och visar offline-banner
- PendingActionStore kor pending actions med retry vid reconnect
- Widget laser fran SharedDataManager (persistent, inget TTL) -- fungerar offline
- CalendarViewModel har cache-fallback (in-memory -> natverk -> 4h cachad data)
- DashboardViewModel har cache-first loading (visar cachad data direkt)
- AuthManager checkar Supabase session i Keychain (overlever app-omstart)

### Identifierade problem

**Problem 1: Cache-TTL for kort vid offline cold start**
Dashboard/Bookings-cache har 5 min TTL. Om anvandaren startar appen offline efter >5 min
sedan senaste anvandning, ar cachen expired -> felmeddelande istallet for stale data.
Kalendern har 4h TTL -- battre men fortfarande begransat.

**Problem 2: PendingActionStore retryAll() triggas inte vid app resume**
`AuthenticatedView.onChange(scenePhase: .active)` laddar feature flags men kor INTE
`PendingActionStore.retryAll()`. Resultat: om appen aterkommer fran bakgrund med natverk
och pending actions, kors de inte forrn nasta natverksandring.

**Problem 3: Felmeddelande vid offline saknar offlinekontext**
DashboardViewModel visar "Kontrollera din internetanslutning" vid natverksfel, men kanner
inte till att appen ar offline (kollar inte NetworkMonitor). Borde visa "Du ar offline.
Visar sparad data." nar cachad data finns, eller "Du ar offline" utan data.

## Forbattringar

### F1: Tillat stale cache vid offline (hogt varde, lagt risk)

Andra `SharedDataManager.loadXxxCache()` sa att TTL ignoreras nar `NetworkMonitor.isConnected`
ar false. Visa cachad data oavsett alder nar offline. Battre att visa gammal data an felmeddelande.

**Implementation:** Lagg till `static var isOffline = false` pa SharedDataManager.
Satt den fran AuthenticatedView.setupNetworkMonitoring(). Alla cache-load-metoder
kollar `isOffline` och hoppar over TTL-check.

### F2: Retry pending actions vid app resume (lagt risk)

Lagg till `PendingActionStore.retryAll()` i `AuthenticatedView.onChange(scenePhase: .active)`
nar `networkMonitor.isConnected` ar true.

### F3: Battre felmeddelande vid offline (lagt risk)

Injicera NetworkMonitor-status i DashboardViewModel (via initializer). Visa offline-specifikt
meddelande vid natverksfel + offline-status.

## Filer som andras

| Fil | Andring |
|-----|---------|
| `SharedDataManager.swift` | `isOffline`-flagga + TTL-bypass vid offline |
| `AuthenticatedView.swift` | Satt isOffline-flagga, retry vid app resume |
| `DashboardViewModel.swift` | Injicera NetworkMonitor, offline felmeddelande |
| `DashboardViewModelTests.swift` | Tester for cache-first + offline-scenarion |
| `PendingActionStoreTests.swift` | Befintliga tester (verifiera att de fortfarande gar grona) |

## Risker

- **Lag risk**: Andringarna ar sma och isolerade. Cache-TTL-bypass vid offline ar konservativ.
- **Ingen schemaandring**: Inga migrations, inga API-andringar.
- **TestImpact**: Bara iOS-tester paverkas. Webb-tester opaverkade.

## Testplan

### TDD: Red -> Green

1. **DashboardViewModelTests**: Test att stale cache visas vid offline (ny)
2. **DashboardViewModelTests**: Test att offline-felmeddelande visas korrekt (ny)
3. **SharedDataManager**: Test att TTL ignoreras vid offline (ny, om testbar)
4. **PendingActionStore**: Befintliga tester ska fortsatta ga grona

### Manuell verifiering

Kraver simulator -- dokumenteras i done-filen men kan inte automatiseras i XCTest:
- Starta app -> stang av natverk -> verifiera banner + cachad data
- Starta app offline (cold start) -> verifiera att cachad data visas
- Ateraktivera natverk -> verifiera sync + banner forsvinner
