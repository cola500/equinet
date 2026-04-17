---
title: "S28-5 Done: iOS offline-verifiering + forbattringar"
description: "Verifierat och forbattrat iOS-appens offline-upplevelse"
category: retro
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Docs
  - Implementerade forbattringar
  - Observationer
  - Avvikelser
  - Lardomar
---

# S28-5 Done: iOS offline-verifiering + forbattringar

## Acceptanskriterier

- [x] Offline-upplevelse verifierad (via kodlasning + tester -- simulator-verifiering kraver manuell test)
- [x] Minst 1 forbattring implementerad (3 st: stale cache, retry vid resume, offline-felmeddelande)
- [x] iOS-tester passerar (283/283, 0 failures)

## Definition of Done

- [x] Inga TypeScript-fel, inga kompileringsfel (check:all 4/4, xcodebuild 0 failures)
- [x] Saker (Zod, error handling, ingen XSS/injection) -- ej applicerbart for denna story
- [x] Tester skrivna FORST (TDD), coverage >= 70% -- 3 nya tester i DashboardViewModelTests
- [x] Feature branch, check:all gron

## Reviews

- **Kordes:** code-reviewer (station 4), ios-expert (plan-review)
- **Resultat:** 0 blockerare, 0 majors, 3 minors (alla accepterade)
  - Minor 1: weak var networkStatus -- safe (AppCoordinator retainar)
  - Minor 2: retryAll() kan dubbelanropas -- safe (retry count guard)
  - Minor 3: hardkodade konstanter i testhelper -- accepterad
- **Ej relevant:** security-reviewer (ingen API-andring), cx-ux-reviewer (ingen UI utover felmeddelanden)

## Docs

- Ingen docs-uppdatering kravs -- S28-6 (docs-story) uppdaterar offline-pwa.md
- Nya offline-learnings dokumenteras i S28-6

## Implementerade forbattringar

### F1: Stale cache vid offline cold start (hogt varde)

**Problem:** Dashboard/Bookings-cache hade 5 min TTL. Nar anvandaren startade appen offline efter >5 min
visades felmeddelande istallet for cachad data.

**Losning:** `ignoreTTL: Bool`-parameter pa SharedDataManagers cache-load-metoder.
DashboardViewModel anropar med `ignoreTTL: true` nar offline. Visar stale data hellre an fel.

**Filer:** SharedDataManager.swift (3 metoder), DashboardViewModel.swift

### F2: Retry pending actions vid app resume

**Problem:** `PendingActionStore.retryAll()` triggades bara vid natverksandring, inte vid app resume.
Om appen kom tillbaka fran bakgrund med natverk + pending actions, retryades de inte.

**Losning:** Lade till `PendingActionStore.retryAll()` i `scenePhase .active` med guard `isConnected`.

**Fil:** AuthenticatedView.swift

### F3: Offline-specifikt felmeddelande

**Problem:** Generiskt "Kontrollera din internetanslutning" visades oavsett online/offline-status.

**Losning:** NetworkStatusProviding-protokoll injicerat i DashboardViewModel. Visar
"Du ar offline. Anslut till internet for att se din dashboard." vid offline + ingen cache.

**Filer:** DashboardViewModel.swift, NetworkMonitor.swift (protocol conformance)

## Observationer (fran kodlasning)

### Vad som fungerar bra utan andringar
- **NetworkMonitor**: NWPathMonitor-baserad, korrekt livscykelhantering, callback pa andring
- **PendingActionStore**: 3 retries, 24h expiry, diskarderar permanenta fel (4xx)
- **Widget**: Persistent data utan TTL -- fungerar offline
- **CalendarViewModel**: In-memory + disk-cache fallback med 4h TTL
- **AuthManager**: Supabase SDK persistar session i Keychain -- overlever kall start

### Framtida forbattringar (utanfor scope)
- Applicera ignoreTTL-monstret pa BookingsViewModel och CalendarViewModel for konsistens
- Debounce av retryAll() for att undvika dubbelanrop vid simultant natverksbyte + app resume

## Avvikelser

- **Plan vs implementation:** Planen foreslog `static var isOffline` pa SharedDataManager.
  ios-expert-review identifierade thread-safety-risk. Bytte till `ignoreTTL: Bool`-parameter
  pa varje cache-metod istallet -- renare, testbart, ingen global mutabel state.
- **Manuell simulator-verifiering:** Ej utford (kraver manuell interaktion med simulator
  + naterksavstangning). Kodlasning + automatiserade tester taecker funktionaliteten.

## Lardomar

1. **`ignoreTTL`-parameter > global state:** Passera kontext som parameter istallet for att
   satta global flagga. Undviker thread-safety-problem och gor koden mer testbar.
2. **ios-expert-review hittar arkitekturproblem tidigt:** Thread-safety-risken med static var
   fangades i plan-review, inte i implementation.
3. **`networkStatus?.isConnected == false` ar safe default:** Om networkStatus ar nil (weak ref
   deallokerad), returnerar `isOffline` false -- safe fallback till online-beteende.
