---
title: "S8-1 Done: Annonsering native iOS"
description: "Acceptanskriterier och DoD for native announcements migration"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S8-1 Done: Annonsering native iOS

## Acceptanskriterier

- [x] Feature inventory genomford och granskad
- [x] Native vy visar leverantorens rutt-annonser (oppna + avslutade sektioner)
- [x] Skapa ny annons -- offloadad till WebView (beslut i plan)
- [x] ViewModel-tester (12 XCTest, BDD inre loop)
- [x] API route-tester med integrationstester (18 Vitest, BDD yttre loop)
- [x] `npm run check:all` passerar (3894 tester grona)
- [x] iOS-tester grona (12/12)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Bearer JWT auth, rate limiting, ownership check, feature flag gate)
- [x] Tester skrivna FORST, coverage OK
- [x] SwiftUI Pro review genomford (5 fixar)
- [x] Feature branch, alla tester grona

## Avvikelser

1. **Skapa ny annons** och **annonsdetaljer+bokningar** offloadades till WebView (planerat beslut). Migreras vid behov i framtida sprint.
2. **Haptics i ViewModel** (`UINotificationFeedbackGenerator`) -- behallt for konsistens med befintliga ViewModels (ServicesViewModel, CustomersViewModel). Noterat i SwiftUI Pro review som forbattringsforslag.
3. **Binding(get:set:) i confirmationDialog** -- behallt for konsistens med befintligt monster (NativeServicesView).

## Lardomar

1. **Parallella sessioner kan overskriva filer**: En annan session bytte branch och modifierade filer under min session. Alla iOS-andringar (APIClient, NativeMoreView, SharedDataManager, pbxproj) reverterades och behove tillampas pa nytt. **Slutsats**: Delad working directory ar fragilt -- kontrollera alltid `git branch` och `git status` fore commit.
2. **Widget target membership ar kritiskt**: SharedDataManager anvands av widget target. Alla modeller som refereras fran SharedDataManager MASTE laggas till i `membershipExceptions` i pbxproj, annars far widget target kompileringsfel.
3. **Date vs String i Codable**: JSONDecoder utan dateDecodingStrategy hanterar inte ISO-datum automatiskt. Alla befintliga modeller anvander String for datum -- folj konventionen.
4. **Cache i tester**: SharedDataManager-cache overlever mellan testkkorningar i simulator. Rensa alltid cache i `setUp()` for tester som testar felhantering (annars serveras cachad data istallet for felmeddelande).
