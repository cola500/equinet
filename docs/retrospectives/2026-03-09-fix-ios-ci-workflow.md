---
title: Fix iOS CI Workflow
description: Fixade simulator- och Xcode-versionsfel i GitHub Actions iOS-tests workflow
category: retrospective
status: published
last_updated: 2026-03-09
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: Fix iOS CI Workflow

**Datum:** 2026-03-09
**Scope:** Fixade iOS Build & Tests CI-jobb som failade i PR #78

---

## Resultat

- 1 andrad fil (`.github/workflows/ios-tests.yml`)
- 2 commits (dynamiskt Xcode-val + namnbaserad simulator-destination)
- 3282 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session (kort)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| CI | `.github/workflows/ios-tests.yml` | Dynamiskt Xcode-val, diagnostik-steg, namnbaserad simulator-destination |

## Vad gick bra

### 1. Diagnostik-steg avslojad rotorsak snabbt
Att lagga till "List available Xcode versions" och "List available simulators" som CI-steg gjorde att andra koerningen gav full insyn: Xcode 26.3 fanns, iPhone 16 Pro fanns, men `simctl`-UDID matchade inte `xcodebuild`-destinationer. Utan diagnostiken hade felsoekningen tagit laengre.

### 2. Inkrementell fix istallet for ofverdriven engineering
Foersta foersoeket anvande dynamisk UDID-lookup via python3-parsning av simctl JSON. Nar det failade bytte vi till den enklaste loesningen: namnbaserad destination (`name=iPhone 16 Pro`) som bekraeftats tillgaenglig. Enklare = baettre.

## Vad kan forbattras

### 1. Testa CI-aendringar lokalt foerst
`simctl list devices` och `xcodebuild -showdestinations` ger olika resultat. Vi antog att simctl-UDID:n skulle fungera med xcodebuild utan att verifiera. En lokal `xcodebuild -showdestinations -scheme Equinet` hade avslojat problemet direkt.

**Prioritet:** MEDEL -- sparar en CI-runda (~2 min) per iteration.

### 2. Hardkodad simulator-namn ar fragilt
`iPhone 16 Pro` fungerar nu men kan saknas pa framtida runner-versioner. En mer robust loesning vore att parsa `xcodebuild -showdestinations` (inte `simctl`), men komplexiteten ar inte motiverad just nu.

**Prioritet:** LAG -- fungerar med nuvarande setup, kan fixas om det bryts igen.

## Patterns att spara

### simctl vs xcodebuild destination-mismatch
`xcrun simctl list devices` och `xcodebuild -showdestinations -scheme X` returnerar OLIKA enhets-UDID:er. Använd ALDRIG simctl-UDID:er som xcodebuild-destination. Använd antingen:
1. Namnbaserad destination: `platform=iOS Simulator,name=iPhone 16 Pro`
2. UDID fran `xcodebuild -showdestinations` (inte simctl)

### Dynamiskt Xcode-val i CI
```bash
XCODE_PATH=$(ls -d /Applications/Xcode_*.app 2>/dev/null | sort -V | tail -1)
sudo xcode-select -s "$XCODE_PATH/Contents/Developer"
```
Valjer senaste tillgaengliga Xcode automatiskt. Undviker hardkodad version som bryts vid runner-uppdateringar.

### CI-diagnostik for iOS
Lagg ALLTID till diagnostik-steg i iOS CI-workflows:
- `ls /Applications | grep Xcode` -- tillgaengliga Xcode-versioner
- `xcrun simctl list devices available` -- tillgaengliga simulatorer
- `xcodebuild -version` -- aktiv Xcode-version

Dessa kostar ~1s och sparar minuter vid felsoekning.

## 5 Whys (Root-Cause Analysis)

### Problem: simctl UDID fungerade inte som xcodebuild-destination
1. Varfor failade testerna? xcodebuild hittade inte simulatorn med given UDID.
2. Varfor var UDID:n fel? simctl returnerade en UDID som xcodebuild inte kande igen.
3. Varfor skiljer sig UDID:erna? simctl och xcodebuild har separata enhetsregister -- simctl listar runtime-devices, xcodebuild listar scheme-kompatibla destinations.
4. Varfor antog vi att de var samma? Vi antog att "available device" i simctl = "valid destination" i xcodebuild utan att verifiera.
5. Varfor verifierade vi inte? Vi hade ingen diagnostik-output fran foersta koerningen och testade inte lokalt.

**Åtgärd:** Diagnostik-steg tillagda i CI. Dokumenterat att simctl och xcodebuild har separata enhetsregister.
**Status:** Implementerad

### Problem: Hardkodad Xcode_16 matchade inte deployment target 26.2
1. Varfor failade bygget? Xcode 16 saknar iOS 26 SDK.
2. Varfor var Xcode 16 hardkodad? Workflowen skapades nar Xcode 16 var aktuell.
3. Varfor uppdaterades den inte? Inget automatiskt val av Xcode-version fanns.
4. Varfor hade vi ingen dynamisk selektion? Workflowen foljde ett statiskt CI-recept utan framtidssaekring.
5. Varfor? Forsta versionen av iOS CI-workflowen -- ingen erfarenhet av runner-uppdateringar annu.

**Åtgärd:** Dynamiskt Xcode-val med `sort -V | tail -1`. Valjer alltid senaste.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** `simctl` och `xcodebuild` har separata enhetsregister. Använd ALDRIG simctl-UDID:er som xcodebuild-destination. For CI: namnbaserade destinationer ar enklast och mest robusta. Lagg alltid till diagnostik-steg i iOS workflows -- de kostar nastan inget men sparar hela CI-rundor vid fel.
