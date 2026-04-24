---
title: "S55-1: iOS demo mode — done"
description: "Acceptanskriterier och DoD för S55-1"
category: done
status: done
last_updated: 2026-04-24
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S55-1: iOS demo mode — Done

## Acceptanskriterier

- [x] Mer-fliken visar bara "Min profil" i demo mode
- [x] Profilen döljer Verifiering, Exportera data i demo mode
- [x] Radera konto döljs i demo mode
- [x] Omboka- och Återkommande-sektionerna döljs i demo mode
- [x] Normalt läge (demo_mode false) opåverkat

**Visuell verifiering:** Utförd med mobile-mcp (iPhone 17 Pro simulator) med `FEATURE_DEMO_MODE=true` injicerat i dev-server. Mer-fliken visade bara "Mitt företag → Min profil". Profil-Inställningar-fliken visade bara Bokningsinställningar + Tillgänglighet (korrekt per spec).

## Definition of Done

- [x] Inga TypeScript-fel — ej tillämpligt (Swift-only)
- [x] Bygget rent: `xcodebuild build` — 0 errors, 0 warnings (utöver befintlig Swift 6 warning i testfil)
- [x] ProfileViewModelTests: 16/16 gröna
- [x] Säker — inga API-anrop, inga nya routes, ren UI-filtrering
- [x] Feature branch `feature/s55-1-ios-demo-mode` skapad

## Reviews körda

- [x] code-reviewer — inga blockers/majors. Suggestions åtgärdade: `guard let` istället för `[0]`-access i NativeMoreView, kommentar om avsiktligt synliga sektioner i NativeProfileView.
- [ ] ios-expert — SKIPPAD (code-reviewer flaggade inga iOS-specifika fynd; seriell körning per review-matrix.md S53-S55 experiment)

## Docs uppdaterade

Ingen docs-uppdatering — ren intern iOS-filtrering baserat på befintlig feature flag. Ingen ny feature synlig för slutanvändare (demo mode var redan aktivt på webb).

## Verktyg använda

- Läste patterns.md vid planering: nej (trivial UI-filtrering, ingen domänlogik)
- Kollade code-map.md för att hitta filer: nej (visste redan vilka filer)
- Hittade matchande pattern: nej — ingen liknande iOS-filtrering sedan tidigare

## Arkitekturcoverage

Ingen designstory — storyn implementerade en specificerad feature direkt utan föregående designdokument.

## Modell

sonnet

## Lärdomar

- **`NEXT_PUBLIC_DEMO_MODE` vs `FEATURE_DEMO_MODE`**: Webb-appen använder `isDemoMode()` som läser `NEXT_PUBLIC_DEMO_MODE`. Feature flags-API:et använder `FEATURE_DEMO_MODE`. iOS-appen läser från API:et — behöver alltså `FEATURE_DEMO_MODE=true` för att testa lokalt, inte `NEXT_PUBLIC_DEMO_MODE`.
- **Edge Config tar prioritet över lokal DB**: Om `EDGE_CONFIG` är konfigurerad läses DB-overrides aldrig (bara Edge Config → env → code default). Lokal DB-testning av feature flags fungerar inte utan att koppla bort Edge Config eller sätta env-var direkt.
- **debug-autologin via `xcrun simctl launch`**: Fungerar inkonsekvent — kräver att dev-servern hinner starta och att WebView laddar klart innan splash-timeout. Manuell inloggning mer tillförlitlig för simulator-test.
- **Visuell verifiering av demo mode**: Enklast att testa med `FEATURE_DEMO_MODE=true` i `.env.local` + restart av dev-server + omstart av appen (rensar cachedFeatureFlags i UserDefaults och hämtar nya från API).
