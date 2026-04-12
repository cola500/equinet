---
title: "Retrospektiv: Mer-fliken -- saknade menyalternativ + feature flag-stod"
description: "Komplettera iOS Mer-fliken med 6 saknade menyalternativ, feature flag-filtrering och UserDefaults-cache"
category: retrospective
status: complete
last_updated: 2026-03-16
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - Larandeeffekt
---

# Retrospektiv: Mer-fliken -- saknade menyalternativ + feature flag-stod

**Datum:** 2026-03-16
**Scope:** Komplettera iOS Mer-fliken med alla 11 menyalternativ fran webben + feature flag-medvetenhet

---

## Resultat

- 4 andrade filer, 1 ny fil, 0 nya migrationer
- 12 nya XCTest-tester (alla grona)
- 145 totala iOS-tester (inga regressioner)
- Build: 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| iOS View | NativeMoreView.swift | +6 menyalternativ, "Planering"-sektion, featureFlag-property pa MoreMenuItem, visibleSections-filtrering, fixad item-ordning (Insikter fore Recensioner) |
| iOS API | APIClient.swift | +fetchFeatureFlags() publik endpoint utan Bearer-token, URL(string:relativeTo:) |
| iOS State | AppCoordinator.swift | +featureFlags state, +loadFeatureFlags() med UserDefaults-cache |
| iOS Lifecycle | AuthenticatedView.swift | +scenePhase for reload vid app-resume, skicka featureFlags till NativeMoreView |
| iOS Test | MoreMenuTests.swift | 12 tester: sektionsstruktur, flagg-filtrering (alla true/false/tom/partiell), item-identitet |

## Vad gick bra

### 1. Valforberedd plan med agenttorkoring
Planen inkluderade ios-expert + cx-ux-reviewer feedback som fangade 8 specifika problem INNAN implementation. Torkoringen hittade ytterligare 4 buggar (URL-encoding, scenePhase, filplacering, parameterordning). Resultatet: noll ovaentade problem under implementation.

### 2. Snabb verifieringscykel
Hela implementationen (4 filer + tester + simulator-verifiering) tog ~30 minuter. Monstret "lagg till property -> uppdatera anrop -> bygg -> testa -> verifiera visuellt" ar nu valintegrerat.

### 3. Feature flag-filtrering bekraftad visuellt
`group_bookings: false` i dev-miljon resulterade i att Gruppbokningar doldes i simulatorn -- exakt ratt beteende. Bevisar att hela kedjan (API -> AppCoordinator -> NativeMoreView filtering) fungerar korrekt.

## Vad kan forbattras

### 1. Build-artefakter trackas i git
`ios/Equinet/build/` saknar gitignore-regel. Rotens `/build` matchar bara rotmappen. Over 280 binara build-filer dyker upp i `git diff`.

**Prioritet:** HOG -- maste fixas innan nasta commit, annars svaller repot med binarer.

### 2. Testet raeknade fel pa icke-flaggade items
Forsta testkorningen failade: forvantade 5 icke-flaggade items men det var 4 (Hjalp har `help_center`-flagga). Enkel off-by-one men visar att manuell rakning av flaggade vs icke-flaggade items ar feltbenaget.

**Prioritet:** LAG -- inga atergarder behovs, testet fangade felet.

## Patterns att spara

### iOS Feature Flag-monster
1. **APIClient**: Publik endpoint utan Bearer via `URLSession.shared.data(from:)` (inte `performRequest`)
2. **AppCoordinator**: `[String: Bool]` state + UserDefaults-cache. Ladda cachad vid start, hamta friskt i bakgrunden.
3. **AuthenticatedView**: Trigger via `.onAppear` + `.onChange(of: scenePhase)` for reload vid app-resume.
4. **NativeMoreView**: `visibleSections` computed property filtrerar baserat pa `featureFlags` dict. Tomma sektioner doljs via `.compactMap`.
5. **handlePendingPath**: Soker ALLTID i `allMenuSections` (inte filtrerade) -- navigering till flagg-gated sidor ska fungera via deep links aven om flaggan ar av.

### URL(string:relativeTo:) for iOS API-anrop
Använd ALDRIG `appendingPathComponent()` for URL-stranggar med `/` -- det URL-encodar snedstreck. Använd `URL(string: path, relativeTo: baseURL)` som i `refreshToken()` och `fetchFeatureFlags()`.

## Larandeeffekt

**Nyckelinsikt:** En valforberedd plan med agent-feedback och torkoring eliminerar nastan alla implementationsproblem. De 8 agent-punkterna + 4 torkorningsfixar sparade uppskattningsvis 30+ minuters debugging. Investera i planering for iOS-arbete dar build-cykler ar langa.
