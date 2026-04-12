---
title: "Retrospektiv: iOS-app refaktorering och hardning"
description: "Strukturerad loggning, brand-farg extension, idiomatisk SwiftUI, safe unwraps och tillganglighet"
category: retrospective
status: active
last_updated: "2026-03-09"
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: iOS-app refaktorering och hardning

**Datum:** 2026-03-09
**Scope:** Stadning och hardning av iOS-appen infor App Store-submission

---

## Resultat

- 17 andrade filer, 2 nya filer (AppLogger.swift, Color+Brand.swift)
- 0 nya TS-tester (rent Swift/iOS-arbete)
- 3169 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Xcode build = succeeded
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| iOS Loggning | AppLogger.swift (ny), 9 Swift-filer | Alla print() -> os.Logger med kategorier och ratt logniva |
| iOS UI | Color+Brand.swift (ny), NativeLoginView, BiometricPromptView, SplashView | Color.equinetGreen extension, borttagen duplicering |
| iOS Arkitektur | ContentView.swift, NetworkMonitor.swift | .onChange(of:) istallet for callback-pattern, borttagen onStatusChanged |
| iOS Felhantering | NativeCalendarView, CalendarSyncManager, CalendarViewModel | Force unwraps -> safe unwrap, datumvalidering med Bool-retur |
| iOS Tillgänglighet | NativeCalendarView | VoiceOver-labels pa bokningsblock och now-line |
| Xcode projekt | project.pbxproj | AppLogger.swift tillagd i widget extension target |

## Vad gick bra

### 1. Systematisk plan med arkitektgranskning
Planen hade redan strukits ned fran 88 issues till ~20 relevanta efter tech-arkitektgranskning. Det betydde att vi inte slasade tid pa falska problem (APIClient "race condition" som inte existerade, Constants.swift som var overflod).

### 2. Parallell filredigering
Fas 1 (loggning) kravde ändringar i 9 filer. Genom att lasa alla filer parallellt och gora alla editeringar i block gick det snabbt. Samma monster i fas 2 (3 filer + 1 ny).

### 3. Saker loggning fran start
Planen specificerade exakt vilka vardon som INTE far loggas (tokens, cookies). Resultatet ar att alla AppLogger-anrop bara loggar metadata (success/failure, identifiers), aldrig kansliga vardon.

## Vad kan forbattras

### 1. Xcode-projekt-integration missades initialt
Nya Swift-filer (AppLogger.swift, Color+Brand.swift) lades inte till i Xcode-projektets widget extension target. Builden failade och kravde manuell fix av project.pbxproj.

**Prioritet:** HOG -- varje ny Swift-fil som delas med widget extension maste laggas till i membershipExceptions.

### 2. import OSLog missades
os.Logger-strangintepolering kraver `import OSLog` pa anropssidan, inte bara dar Logger definieras. Alla 9 filer saknade importen och builden failade.

**Prioritet:** HOG -- detta ar en Swift-gotcha som maste dokumenteras.

## Patterns att spara

### AppLogger-monster
`AppLogger.swift` definierar kategoriserade `Logger`-instanser. Anropande filer maste ha `import OSLog`. Lognnivaer: `.error()` (fel), `.warning()` (ovantat men hanterat), `.info()` (normala handelser), `.debug()` (utvecklingsdetaljer). Logga ALDRIG kansliga vardon.

### Color extension for brand-farger
`Color+Brand.swift` med `static let equinetGreen` istallet for duplicerade Color-literaler. Extrahera vid 3+ forekomster.

### .onChange(of:) over callback-closures
I SwiftUI med @Observable: använd `.onChange(of: observable.property)` istallet for callback-closures som riskerar stale captures av struct-vardon.

### updateEvent Bool-retur for datumvalidering
CalendarSyncManager.updateEvent returnerar Bool. Anroparen skippar mapping vid false. Forhindrar events utan datum.

## 5 Whys (Root-Cause Analysis)

### Problem: Xcode build failade -- "cannot find AppLogger in scope"
1. Varfor? KeychainHelper.swift kunde inte hitta AppLogger.
2. Varfor? KeychainHelper.swift kompileras i widget extension target, men AppLogger.swift ingick inte dar.
3. Varfor? PBXFileSystemSynchronizedRootGroup inkluderar filer automatiskt i huvudtarget, men widget extension kraver explicit membershipExceptions.
4. Varfor? Vi la till AppLogger.swift som ny fil utan att kontrollera om den behover delas med widget extension.
5. Varfor? Det finns ingen checklista for "ny Swift-fil i delat iOS-projekt" som paminnar om target-membership.

**Åtgärd:** Dokumenterat i CLAUDE.md som gotcha. Vid ny Swift-fil som anvands av delade filer (KeychainHelper, SharedDataManager, etc): lagg till i membershipExceptions.
**Status:** Implementerad

### Problem: Xcode build failade -- "import of defining module 'os' missing"
1. Varfor? AppLogger.keychain.error("...\\(var)") failade i KeychainHelper.swift.
2. Varfor? Logger-strangintepolering använder OSLogMessage som kraver import OSLog.
3. Varfor? Swift resolvar strangintepolering pa anropssidan, inte dar Logger definieras.
4. Varfor? os.Logger har en specialiserad StringInterpolation som inte ar tillgänglig utan explicit import.
5. Varfor? Swift-kompilatorn kan inte transitivt exponera specialiserade typer fran importerade moduler.

**Åtgärd:** Alla filer som anropar AppLogger maste ha `import OSLog`. Dokumenterat som pattern.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** Swift-projekt med delade filer (app + widget extension) kraver sarskild uppmarksamhet vid nya filer. Bade target-membership (pbxproj) och transitiva imports (OSLog) maste hanteras explicit. En snabb `xcodebuild` efter varje fas hade fangar bada problemen tidigare.
