---
title: "S8-2 Done: Business insights native iOS"
description: "Acceptanskriterier och DoD for native business insights migration"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S8-2 Done: Business insights native iOS

## Acceptanskriterier

- [x] Feature inventory genomford
- [x] Native vy visar intakter, tjanstefordelning, kundretention
- [x] Swift Charts for grafer (inte WebView Recharts)
- [x] ViewModel-tester (13 XCTest, BDD inre loop)
- [x] API route-tester med integrationstester (11 Vitest, BDD yttre loop)
- [x] `npm run check:all` passerar (3905 tester grona)
- [x] iOS-tester grona (13/13)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Bearer JWT auth, rate limiting, business_insights feature flag, ownership check)
- [x] Tester skrivna FORST, coverage OK
- [x] Feature branch, alla tester grona

## Avvikelser

1. **Berakningslogik duplicerad** mellan `/api/provider/insights` och `/api/native/insights`. Planerat beslut -- extrahera till delad service vid behov (refactoring).
2. **Ingen Redis-cache pa native route** -- webbrouten anvander Upstash Redis-cache (10 min). Native routen forlitar sig pa SharedDataManager (5 min, klient-side). Kan laggas till vid behov.
3. **Info-popovers** implementerade som vanliga labels -- SwiftUI `.help()` modifier ar iOS 17+ och ger begransad kontroll. Kan forbattras med `.popover()` vid behov.

## Lardomar

1. **Swift Charts forsta gangen**: Enkel integration. `import Charts` + `Chart { BarMark/LineMark }` ar rent och deklarativt. Forsta anvandningen i projektet -- kan ateranvandas for andra analytics-vyer.
2. **Heatmap pre-computation fungerade bra**: ViewModel transformerar API-data till 2D-matris med max-varde. Vyn laser bara fran matrisen -- ingen berakningslogik i body. Testbart i XCTest (7 av 13 tester testar heatmap-logik).
3. **Cache per period ar enkel men effektiv**: `insights_cache_\(months)` ger tre separata caches. `clearAllInsightsCache()` rensar alla tre vid logout. Undviker stale data vid periodbytte.
4. **Simulator launch failed**: DerivedData blev stale efter parallella sessioner. `rm -rf DerivedData/Equinet-*` + simulator reboot fixade det. Vanligt efter branch-byten.
