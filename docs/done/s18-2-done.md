---
title: "S18-2 Done: Hjälpcenter native"
description: "28 provider-hjälpartiklar portade till native SwiftUI med sök och sektionsgruppering"
category: retro
status: active
last_updated: 2026-04-09
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S18-2 Done: Hjälpcenter native

## Acceptanskriterier

- [x] Alla provider-artiklar visas grupperade per sektion (28 artiklar, 11 sektioner)
- [x] Sök filtrerar i realtid (titel, summary, keywords, content inkl headings)
- [x] Artikelvy renderar paragrafer, steg-listor, punkt-listor och tips
- [x] Feature flag-gate (help_center finns i feature-flag-definitions, NativeMoreView filtrerar)
- [x] Fungerar offline (all data statisk, inbäddad i appen)
- [x] Tester: 12 HelpViewModel-tester (sök, gruppering, edge cases)

## Definition of Done

- [x] Fungerar som förväntat, inga kompileringsfel
- [x] Säker (ingen API, ingen extern data)
- [x] Unit tests skrivna FÖRST (TDD), 12 tester gröna
- [x] Feature branch, alla tester gröna

## Reviews

- **code-reviewer**: Kördes. Inga blockers eller majors. 4 minor (navigationDestination-placering, searchableText computed, plan-diskrepans, Section vs DisclosureGroup). 2 suggestions (HelpContent Hashable, tip-färg).
- **ios-expert**: Kördes (plan-review). 1 falskt-alarm blocker (help_center i AppCoordinator -- flaggor hämtas dynamiskt). 3 minor (artikelantal, testfil, heading-sökning). 2 suggestions (platt lista, AttributedString).
- security-reviewer: Ej relevant (ingen API, ingen auth, statisk data)
- cx-ux-reviewer: Ej relevant (iOS native, ej webbändringar)

## Avvikelser

- **Section istället för DisclosureGroup**: Planen föreslog DisclosureGroup men Section i List ger bättre native look-and-feel och fungerar smidigare med .searchable().
- **Orange tips istället för blå**: Webbens blå tip-rutor ersattes med orange (lightbulb-ikon) för att matcha iOS-konventioner.
- **28 artiklar, inte 22**: Planen hade fel antal initialt, korrigerades under review.

## Lärdomar

- **Statisk data-migrering är snabb**: Ingen API, ingen auth, inget asynkront. Fokus på korrekt portning av textinnehåll.
- **Feature flags hämtas dynamiskt**: iOS AppCoordinator hämtar ALLA flaggor från `/api/feature-flags`. Inga flaggor behöver explicit listas i iOS-koden.
- **Section > DisclosureGroup i List-kontext**: SwiftUI Section ger native grouped-list styling och .searchable()-integration utan extra arbete.
- **searchableText som computed property**: Bra mönster för sökning -- håller logiken testbar utan att koppla den till ViewModel.
