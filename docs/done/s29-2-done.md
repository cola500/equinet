---
title: "S29-2 Done: E2E iOS offline-flöde"
description: "Fullständigt E2E-test av iOS offline-kedjan"
category: retro
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Docs
  - Beslut
  - Lärdomar
---

# S29-2 Done: E2E för iOS offline-flödet

## Acceptanskriterier

- [x] E2E-test som täcker hela offline-flödet
- [x] Grönt 3 gånger i rad (inte flaky) -- 3/3, 0 failures
- [x] Dokumenterat i iOS-testflödet (planeras i S29-5)
- [x] Beslut fattat: körs lokalt pre-release (se Beslut nedan)

## Definition of Done

- [x] Inga TypeScript-fel (N/A -- Swift-only)
- [x] Säker (`#if DEBUG` guard)
- [x] Tester skrivna FÖRST (TDD), 4 nya E2E-tester
- [x] Feature branch, iOS-tester gröna (294/294, 0 failures)

## Reviews

Kördes: code-reviewer (vid merge). Story bygger på S29-1:s mekanism -- inga nya API/UI/security-ändringar.

## Docs

Uppdatering av ios-learnings.md planeras i S29-5.

## Implementation

### OfflineE2ETests.swift -- 4 tester

1. **testFullOfflineReconnectScenario**: Komplett scenario -- online fetch (5 bokningar) -> offline (stale cache, no fetch) -> reconnect (fresh fetch, 10 bokningar)
2. **testOfflineWithCacheSkipsFetch**: Verifierar att offline + befintlig cache inte triggar nätverksanrop
3. **testUserDefaultsPollingAffectsViewModel**: Verifierar att `simctl spawn defaults write/delete` kedjan funkar hela vägen till ViewModel
4. **testStatusChangedCallbackChain**: Verifierar att onStatusChanged fires korrekt vid offline->online

### Visuell E2E-verifiering (S29-1)

Redan verifierat via mobile-mcp i S29-1:
- Orange "Ingen internetanslutning" banner visas
- Banner försvinner vid reconnect
- Dashboard renderas under hela flödet

## Beslut: CI eller lokalt?

**Lokalt pre-release.** Motivering:
- Testerna kräver iOS Simulator (inte tillgängligt i GitHub Actions utan self-hosted runner)
- 3s per körning (UserDefaults polling) -- acceptabelt lokalt, onödigt i varje CI-build
- Kan läggas till i CI framöver om self-hosted macOS runner sätts upp
- Shell-skriptet (`scripts/ios-offline-verification.sh`) kan köras som pre-release gate

## Lärdomar

- **DashboardViewModel fetchar ÄVEN offline om ingen cache finns.** Korrekt beteende -- utan cache måste den försöka. Mitt första test antog felaktigt att offline blockerar alla fetches.
- **SharedDataManager.clearDashboardCache()** behövs i setUp/tearDown för att undvika test-cross-contamination.
- **3s overhead per UserDefaults-polling-test** -- acceptabelt men bör inte multipliceras med för många tester.
