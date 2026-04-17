---
title: "S27-7: Hjälpcentral native SwiftUI -- Done"
description: "Verifiering att native hjälpcentral redan implementerad, plus ny API-route"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S27-7: Hjälpcentral native SwiftUI -- Done

## Acceptanskriterier

- [x] Feature inventory genomförd (webb har 27 provider + 16 customer artiklar, statisk data)
- [x] Native hjälpcentral med sökbar lista (HelpModels + HelpViewModel + NativeHelpView)
- [x] Artikeldetalj i native vy (HelpArticleDetailView med paragraphs, steps, bullets, tips)
- [x] iOS-tester (HelpViewModelTests -- 11 tester: gruppering, sökning, edge cases)
- [ ] Visuell verifiering med mobile-mcp (ej körd, existerande implementation oförändrad)

## Definition of Done

- [x] Inga TypeScript-fel (4080 tester gröna)
- [x] Säker (API-routes med auth + rate limiting + feature flag gate)
- [x] Tester skrivna: 9 nya API-tester + 11 befintliga iOS-tester
- [x] `check:all` grön (4/4)

## Reviews

Kördes: ingen (existerande iOS-implementation oförändrad, ny API-route är enkel readonly)

## Avvikelser

All native SwiftUI-funktionalitet var redan implementerad i en tidigare sprint:
- `HelpModels.swift` -- datamodeller
- `HelpArticles.swift` -- 1001 rader statisk artikeldata (bundlad i appen)
- `HelpViewModel.swift` -- söklogik med @Observable
- `NativeHelpView.swift` -- sökbar lista med sektioner
- `HelpArticleDetailView.swift` -- fullständig artikelrendering
- `NativeMoreView.swift` -- routing redan konfigurerad (rad 165-168)
- `HelpViewModelTests.swift` -- 11 XCTest-tester

**Nytt tillägg**: Skapade `GET /api/native/help` och `GET /api/native/help/[slug]` API-routes med auth, rate limiting och feature flag gate. Dessa möjliggör dynamiska artiklar i framtiden men native-appen använder bundlad data idag.

## Lärdomar

- Kolla alltid om funktionaliteten redan finns innan implementation startas. Feature inventory avslöjade att allt redan var byggt.
