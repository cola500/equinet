---
title: "S18-2: Hjälpcenter native"
description: "Porta leverantörs-hjälpartiklar till native SwiftUI med sök och sektionsgruppering"
category: plan
status: wip
last_updated: 2026-04-09
sections:
  - Scope
  - Feature Inventory
  - Approach
  - Filer
  - TDD
  - Risker
---

# S18-2: Hjälpcenter native

## Scope

Porta 28 provider-hjälpartiklar (11 sektioner) till native SwiftUI.
All data statisk -- ingen API behövs. Perfekt för native och fungerar offline.

## Feature Inventory

| Feature | Webb | Native | Beslut |
|---------|------|--------|--------|
| Sökfält med debounce | `SearchField` filtrerar titel+summary+keywords+content | `@State searchText` + `.searchable()` | Native |
| Accordion-sektioner | `DisclosureGroup`-liknande UI per section | SwiftUI `DisclosureGroup` | Native |
| Artikelvy: paragrafer | Renderas som `<p>` | `Text()` | Native |
| Artikelvy: steg-lista | Numrerade steg | Numrerad lista med `ForEach` | Native |
| Artikelvy: punkt-lista | `<ul><li>` | Bullet `Text("-- ")` | Native |
| Artikelvy: tips | Blå ruta med tip-text | Blå bakgrund `RoundedRectangle` | Native |
| Artikelvy: heading per block | `<h3>` i content-block | `Text().font(.headline)` | Native |
| Feature flag gate | `help_center` flag i webb | Feature flag via AppCoordinator | Native |
| 11 sektioner | Kom igang, Profil, Tjänster, Kalender, Bokningar, Dagligt arbete, Ruttplanering, Omdomen, Kunder, Planering, Hästar, Integrationer, Konto | Samma | Native |
| Platt lista vid aktiv sokning | Webb visar platt | Platt lista vid sok, sektioner vid tom sok | Native |

**Auth:** Ingen -- statisk data, inget API-anrop.
**Feature flag:** `help_center` finns i feature-flag-definitions (default-on). iOS hamtar dynamiskt via `/api/feature-flags`. NativeMoreView har redan `featureFlag: "help_center"` pa menyposten.

## Approach

1. **HelpModels.swift** -- Codable structs som matchar webbens typer
2. **HelpArticles.swift** -- Statisk data (alla 22 artiklar, portade fran TS)
3. **HelpViewModel.swift** -- Sok + gruppering per sektion
4. **NativeHelpView.swift** -- Lista med `.searchable()` + `DisclosureGroup` per sektion
5. **HelpArticleDetailView.swift** -- Renderar content-block (paragraphs, steps, bullets, tips, headings)
6. **NativeMoreView koppling** -- Byt WebView-fallback till native vy for `/provider/help`

## Filer

| Fil | Aktion |
|-----|--------|
| `ios/Equinet/Equinet/HelpModels.swift` | Ny |
| `ios/Equinet/Equinet/HelpArticles.swift` | Ny |
| `ios/Equinet/Equinet/HelpViewModel.swift` | Ny |
| `ios/Equinet/Equinet/NativeHelpView.swift` | Ny |
| `ios/Equinet/Equinet/HelpArticleDetailView.swift` | Ny |
| `ios/Equinet/Equinet/NativeMoreView.swift` | Redigera (lagg till native route) |
| `ios/Equinet/EquinetTests/HelpViewModelTests.swift` | Ny |

## TDD

ViewModel-tester (XCTest):
- `testSearchFindsArticleByTitle` -- sok pa titel
- `testSearchFindsArticleByKeyword` -- sok pa keyword
- `testSearchFindsArticleByContent` -- sok i content (paragraphs/steps/bullets)
- `testSearchReturnsEmptyForNoMatch` -- tom sokning
- `testSectionsGroupedCorrectly` -- alla sektioner finns
- `testEmptySearchReturnsAll` -- tom sok = alla artiklar

## Risker

- **Lag**: Inga -- all data ar statisk, inga API-beroenden
- **Textmangd**: 22 artiklar ar mycket Swift-kod. Lösning: strukturerad data i array, inte handskriven per artikel
- **Uppdatering**: Artiklar maste uppdateras pa tva stallen (TS + Swift). Acceptabel tradeoff for native UX + offline
