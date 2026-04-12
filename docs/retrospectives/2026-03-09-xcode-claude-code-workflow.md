---
title: "Retro: XCTest-infrastruktur och testbarhet i iOS-appen"
description: "Forsta XCTest-setupen for Equinet iOS-appen -- 24 tester, 3 refaktorerade filer, och laerdomar om Xcodes pbxproj-hantering"
category: retrospective
status: complete
last_updated: 2026-03-09
sections:
  - Vad vi gjorde
  - Vad som gick bra
  - Gotchas upptackta
  - 5 Whys - Varfor tappade Xcode exception sets
  - 5 Whys - Varfor kunde inte testplanen lasas
  - Vad kan forbattras
  - Patterns att spara
  - Workflow-rekommendationer
  - Statistik
---

## Vad vi gjorde

Satte upp den forsta testinfrastrukturen for iOS-appen (26 Swift-filer, noll tidigare tester). Skapade EquinetTests-target i Xcode och skrev 24 tester fordelade over tre faser:

**Fas 1: CalendarModels + WidgetBooking (12 tester)**
Rena Codable-typer utan beroenden -- perfekt startpunkt. Testade JSON-serialisering, edge cases (tomma listor, nil-varden), och round-trip encoding/decoding.

**Fas 2: PendingActionStore (5 tester)**
Refaktorerade save/load/clear med UserDefaults dependency injection. Tidigare anvande klassen `UserDefaults.standard` direkt, vilket gjorde den omojlig att testa isolerat. Nu injiceras UserDefaults via constructor.

**Fas 3: AuthManager (7 tester)**
Extraherade `KeychainStorable`-protokoll fran KeychainHelper, skapade MockKeychainHelper, och anvande constructor injection i AuthManager. Befintliga call-sites forblev oforandrade tack vare adapter-pattern.

## Vad som gick bra

- **PBXFileSystemSynchronizedRootGroup med exceptions** -- vi forstar nu hur Xcode hanterar fil-delning mellan targets. `membershipExceptions` i exception sets styr vilka filer som ingar i respektive target.
- **UserDefaults DI-pattern** fungerade perfekt for PendingActionStore. Minimalt invasiv ändring: en ny `init(defaults:)` parameter med default-varde `UserDefaults.standard`.
- **KeychainStorable protocol + adapter pattern** gav testbar AuthManager utan att andra befintliga call-sites. ProductionKeychain-adaptern wrappar KeychainHelper statiska metoder.
- **Fasindelning efter beroendegrad** (inga beroenden -> UserDefaults -> Keychain) gav smidig progression med tidig feedback.

## Gotchas upptackta

1. **Xcode tappar PBXFileSystemSynchronizedBuildFileExceptionSet vid ny target**: Nar EquinetTests skapades tappade Xcode exception sets for EquinetWidget. Widget-extension kunde inte hitta delade filer (WidgetBooking, SharedDataManager, etc). Fix: manuellt aterstalla exceptions i pbxproj.

2. **Info.plist dubbel-kopiering**: EquinetWidget/Info.plist var INUTI PBXFileSystemSynchronizedRootGroup och kopierades som resurs OCH processades som INFOPLIST_FILE. Fix: membershipExceptions i exception set exkluderar Info.plist fran resource-copy.

3. **Test bundle ID prefix**: EquinetTests bundle ID MASTE vara `com.equinet.Equinet.EquinetTests` (prefixat med parent app's ID), inte `com.equinet.EquinetTests`.

4. **SourceKit false positives**: `@testable import Equinet` visar "No such module" i editorn men kompilerar korrekt. Kant problem med Xcode + synchronized groups.

5. **@Observable kraver @MainActor i tester**: AuthManager ar `@MainActor @Observable`, sa test-klassen maste vara `@MainActor` ocksa.

6. **AuthState Equatable**: Enum utan associated values behover `@retroactive Equatable` conformance i test-target for XCTAssertEqual.

7. **Simulator saknar biometric hardware**: LAContext.canEvaluatePolicy returnerar false, sa AuthManager tar "no biometric" code path. Tester maste ta hansyn till detta.

8. **Xcode 26 kraver explicit .xctestplan-fil**: `shouldAutocreateTestPlan = "YES"` i schemat fungerar INTE tillforlitligt. Xcode skapar en `TestPlans`-referens (`container:EquinetTests`) men genererar inte den fysiska filen. Fix: skapa `EquinetTests.xctestplan` manuellt och referera med `container:EquinetTests.xctestplan` i schemat.

9. **Xcode cachar testplan-referens i UserInterfaceState.xcuserstate**: Aven efter att schemat uppdaterats kan Xcode använde en cachad (trasig) referens. Att rensa xcuserstate hjalper ibland men loser inte grundproblemet.

## 5 Whys: Varfor tappade Xcode exception sets?

1. **Varfor kunde inte widget-extension bygga?** WidgetBooking-typ hittades inte.
2. **Varfor hittades inte WidgetBooking?** membershipExceptions (som delar filer med widget) saknades i pbxproj.
3. **Varfor saknades membershipExceptions?** Xcode hade skrivit om PBXFileSystemSynchronizedRootGroup-sektionen vid target-skapande.
4. **Varfor skrev Xcode om sektionen?** Xcode 26.3 re-serialiserar hela RootGroup-sektionen nar ny target laggs till, och tappar befintliga exception-kopplingar om de inte refereras av den nya targeten.
5. **Varfor validerade inte Xcode att befintliga kopplingar bevarades?** Sannolikt en Xcode-bugg (eller feature): exception sets ar optional och new-target wizard re-genererar bara det den behover.

**Rotorsak**: Xcodes pbxproj-serialisering ar destruktiv vid nya targets -- jamfor ALLTID med original efter target-skapande.

## 5 Whys: Varfor kunde inte testplanen lasas?

1. **Varfor visade Xcode "test plan could not be read"?** Schemat refererade till `container:EquinetTests` men ingen fysisk fil fanns.
2. **Varfor fanns ingen fil?** Xcode 26 auto-genererar testplan-referensen vid target-skapande men sparar planen i binar cache (UserInterfaceState.xcuserstate), inte som separat fil.
3. **Varfor forsvann cachen?** Vi rensade xcuserstate for att fixa andra Xcode-problem (trasig testplan-referens).
4. **Varfor hjalper inte `shouldAutocreateTestPlan = "YES"`?** Nar `TestPlans`-blocket finns i schemat ignorerar Xcode Testables-blocket och forsoker lasa testplan-filen istallet.
5. **Varfor blandar Xcode tva approaches?** Xcode 26 migrerade fran `Testables` till `TestPlans` men GUI:t skapar ibland bada -- inkonsekvent serialisering.

**Rotorsak**: Xcode 26 kraver en fysisk `.xctestplan`-fil nar schemat har ett `TestPlans`-block. Auto-create ar otillforlitligt.
**Åtgärd**: Skapa ALLTID en explicit `.xctestplan`-fil vid nytt test-target. Committa den. Referera med `.xctestplan`-extension i schemat.
**Status**: Implementerad.

## Vad kan forbattras

### 1. Pbxproj-hantering via CLI ar fragilt
Vi spenderade majoritet av sessionstiden pa att fixa pbxproj-problem (tappade exception sets, Info.plist-konflikter, testplan-referenser). Varje manuell Xcode-ändring riskerar att forsta befintlig konfiguration.

**Prioritet:** HOG -- overkvag att använde xcodeproj (Ruby gem) eller tuist for att generera pbxproj deterministiskt.

### 2. Ingen CI for iOS-tester
iOS-testerna kors bara lokalt via CLI. Inga GitHub Actions for xcodebuild test.

**Prioritet:** MEDEL -- nar vi har fler tester ar det vart att lagga till iOS CI.

## Patterns att spara

### UserDefaults DI for testbarhet
Lagg till `defaults: UserDefaults = .standard` som parameter pa metoder som laser/skriver UserDefaults. Icke-brytande -- befintliga anrop fungerar oforandrat. Tester skapar isolerad suite: `UserDefaults(suiteName: "TestName")`.

### KeychainStorable-protokoll + adapter
Extrahera protokoll fran static enum, skapa adapter-struct som wrappar statiska metoder. Injicera via `init(keychain: KeychainStorable = KeychainHelper.shared)`. Mocken ar en enkel in-memory dictionary.

### Xcode test-target setup-checklista
1. Spara backup av pbxproj
2. Skapa target i Xcode GUI
3. Diff pbxproj -- verifiera att exception sets bevarades
4. Fixa bundle ID prefix (maste vara parent-app prefix)
5. Skapa `.xctestplan`-fil manuellt
6. Verifiera med `xcodebuild clean test` fran CLI

## Workflow-rekommendationer

1. **Spara pbxproj-kopia FORE manuella Xcode-steg**: `cp project.pbxproj project.pbxproj.backup`
2. **Jamfor efter**: `diff project.pbxproj.backup project.pbxproj` och verifiera att inga sektioner forsvann.
3. **xcodebuild clean test fran CLI** for CI/snabbverifiering -- snabbare feedback loop an Xcode GUI.
4. **iPhone 17 Pro som standard-simulator** (Xcode 26.3, iOS 26.3.1).
5. **SourceKit-varningar ignoreras** -- `@testable import` false positives ar kanda.
6. **Protokoll-extrahering for testbarhet**: `KeychainStorable`/adapter pattern ar att foredra framfor mocking av statiska metoder.

## Statistik

| Matning | Varde |
|---------|-------|
| Nya iOS-tester | 24 (12 CalendarModels, 5 PendingActionStore, 7 AuthManager) |
| Produktionsfiler refaktorerade | 3 (PendingActionStore, KeychainHelper, AuthManager) |
| Nya testfiler | 4 |
| TS-tester (oforandrade) | 3169 |
| Nya filer totalt | 9 (4 testfiler, 1 testplan, 2 schemes, 2 retros) |
| Andrade filer | 5 (pbxproj, AuthManager, KeychainHelper, PendingActionStore, CLAUDE.md) |
| Regressioner | 0 |
| Simulator | iPhone 17 Pro (iOS 26.3.1) |
| Tid pa pbxproj-fixar | ~60% av sessionen |

## Larandeeffekt

**Nyckelinsikt:** Xcodes pbxproj-format ar brittiskt -- varje manuellt GUI-steg riskerar att forsta befintlig konfiguration. Den viktigaste investeringen for iOS-utveckling med Claude Code ar att ALLTID: (1) spara backup fore Xcode-steg, (2) diffa efterat, (3) verifiera med xcodebuild CLI. Test-target-skapande ar en engangssmarta som kostar mycket forsta gangen men aldrig behover goras om.
