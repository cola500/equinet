---
title: Retrospektiv - Forbattra Bokningar-tabben
description: UX-forbattringar av NativeBookingsView - statuspill, tap target fix, Menu-pattern, visuell hierarki
category: retrospective
status: complete
last_updated: 2026-03-16
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - 5 Whys
  - Patterns att spara
  - Larandeeffekt
---

# Retrospektiv: Forbattra Bokningar-tabben (NativeBookingsView)

**Datum:** 2026-03-16
**Scope:** 9 UX-forbattringar av bokningskorten i iOS-appens Bokningar-tab

---

## Resultat

- 1 andrad fil (NativeBookingsView.swift), 0 nya filer, 0 migrationer
- 0 nya tester (ren iOS SwiftUI UI-andring, verifierad via mobile-mcp)
- 133 iOS-tester (inga regressioner), 3488 unit-tester (oforandrade)
- xcodebuild clean build = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| iOS UI | NativeBookingsView.swift | 9 UX-forbattringar: statuspill, tap target fix (.buttonStyle(.plain) + .fixedSize()), visuell hierarki (padding 16, .subheadline datum), breed borttagen, anteckningar som badge, Menu-pattern for confirmed, vansterkant per status, pending highlight, accessibility med status |

## Vad gick bra

### 1. Plan-driven implementation
Alla 9 andringar var tydligt specificerade i planen med exakta radnummer och kodsnippets. Implementation gick snabbt och kravde ingen utforskning.

### 2. Mobile-mcp verifiering fangade build-problemet
Utan visuell verifiering via mobile-mcp hade vi inte upptackt att den installerade appen var inaktuell. Screenshots + accessibility-tradet bevisade att andringarna inte var aktiva, vilket ledde till att vi hittade DerivedData-problemet.

### 3. Alla forbattringar i en fil
Alla 9 andringar var isolerade till en enda fil utan beroenden till andra lager (inget API, ingen modell-andring). Detta minimerade risken for regressioner.

## Vad kan forbattras

### 1. xcodebuild build-artefakt-sokvag maste vara konsekvent

Sessionen slosade ~10 minuter pa att felsoka varfor den installerade appen inte reflekterade kodandringar. Rotorsak: `xcodebuild build` (CLI) skriver till DerivedData, men `mobile-mcp install_app` anvande den lokala `build/`-katalogen som Xcode IDE hade skapat tidigare.

**Prioritet:** HOG -- detta slap tid varje iOS-session

### 2. Ingen confirmed-status testdata

Vi kunde inte visuellt verifiera Menu-patternet for confirmed-bokningar eftersom testdatan bara hade completed-status. Framtida sessioner bor sakerstalla att testdata tacker alla status.

**Prioritet:** LAG -- koden kompilerar, monstret ar valbeskrivet

## 5 Whys (Root-Cause Analysis)

### Problem: Installerad app visade gammal kod trots lyckad build

1. **Varfor visade appen gammal kod?** For att `mobile-mcp install_app` installerade fran `ios/Equinet/build/Build/Products/` som inneholl en gammal build.
2. **Varfor var den gammal?** For att `xcodebuild build` (CLI utan `-derivedDataPath`) skriver till `~/Library/Developer/Xcode/DerivedData/`, INTE till projektets lokala `build/`-katalog.
3. **Varfor skriver den dit?** For att Xcode-projektets build settings anvander default DerivedData-sokvag, medan den lokala `build/`-katalogen skapades av Xcode IDE med custom build location.
4. **Varfor anvander vi tva olika sokvagar?** For att vi aldrig standardiserat vilken sokvag som anvands for CLI-builds vs IDE-builds.
5. **Varfor standardiserade vi inte?** For att det inte var ett problem forran vi borjade anvanda `xcodebuild` fran CLI (via Claude Code) istallet for Xcode IDE.

**Atgard:** Dokumentera i CLAUDE.md att `xcodebuild` (CLI) bygger till DerivedData. Anvand alltid DerivedData-sokvagen for `mobile-mcp install_app`, eller lagg till `-derivedDataPath build` i xcodebuild-kommandot for att tvinga lokal output.

**Status:** Att gora (dokumenteras i CLAUDE.md denna session)

## Patterns att spara

### iOS xcodebuild DerivedData-sokvag for mobile-mcp
`xcodebuild build` utan `-derivedDataPath` skriver till `~/Library/Developer/Xcode/DerivedData/<Project>-<hash>/Build/Products/Debug-iphonesimulator/`. Den lokala `build/`-katalogen ar Xcode IDEs output och uppdateras INTE av CLI-builds. For `mobile-mcp install_app`: kolla BUILT_PRODUCTS_DIR med `xcodebuild -showBuildSettings | grep BUILT_PRODUCTS_DIR` och anvand den sokvagen.

### SwiftUI Button tap target isolation
`Button` i SwiftUI List expanderar touch-target till minst 44x44pt (Apple HIG). For sma knappar inuti List-rader: `.buttonStyle(.plain)` + `.fixedSize()` begransar touch-arean till knappens faktiska storlek. Utan detta registreras taps pa hela raden som knapptryck.

### Menu for sekundara actions
`Menu { ... } label: { Image(systemName: "ellipsis.circle") }` ar idealiskt for 3+ sekundara actions pa ett kort. Primarknappen (t.ex. "Genomford") far full bredd, Menu-knappen ar kompakt med 44x44pt minarea. Reducerar visuellt brus utan att dolja funktionalitet.

## Larandeeffekt

**Nyckelinsikt:** `xcodebuild` CLI och Xcode IDE anvander OLIKA build-output-kataloger som default. CLI gar till DerivedData, IDE kan ga till lokal `build/`. Vid `mobile-mcp install_app` maste man alltid verifiera att man installerar fran ratt sokvag -- annars installeras en inaktuell binary och det ser ut som att kodandringar inte fungerar.
