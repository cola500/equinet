---
title: "S40-0 Done: Svenska + datum-veckodag + touch-target 44pt"
description: "Hackathon-prototypen SmartReplyChips polerad till prod-standard"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Avvikelser och lärdomar
---

# S40-0 Done

## Acceptanskriterier

- [x] **Före-screenshot sparad** (`docs/metrics/smart-replies-ux/2026-04-19/before-desktop.png` + `before-mobile.png`)
- [x] 4 templates (inte 5), "Min adress"-borttagen
- [x] Svenska omformulerade enligt S40-spec
- [x] Datum-format inkluderar veckodag ("måndag 13 april")
- [x] Touch-target ≥44pt (`min-h-[44px] sm:min-h-0` -- även fixat Suggestion från code-reviewer)
- [x] `SmartReplyVars` uppstädat (ingen oanvänd `adress`)
- [x] `npm run check:all` grön (4167 tester, 4/4 gates)

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Säker (inga API-ändringar, ren UI-komponent)
- [x] `check:all` grön
- [x] Feature branch + PR

## Reviews körda

- [x] code-reviewer: Kördes. Findings:
  - **Major (deferred)**: Saknade tester för `expandTemplate` -- adresseras i S40-1 som explicit innehåller TDD för `expandTemplate`.
  - **Suggestion (fixad)**: `min-h-[44px]` utan `sm:min-h-0` -- fixat direkt.
  - **Suggestion**: Datum kan wrappa i chip på 375px -- acceptabelt, visuellt verifierat.

## Docs uppdaterade

Ingen docs-uppdatering -- intern UI-polish, ingen beteendeändring synlig för användaren utöver att chips nu ser bättre ut och har korrekta texter. Hjälpartikel och testing-guide uppdateras i S40-2 (som täcker hela smart-replies-featuren inklusive feature flag).

## Verktyg använda

- Läste patterns.md vid planering: N/A (trivial polish-story)
- Kollade code-map.md: nej (visste redan vilka filer)
- Hittade matchande pattern: "Touch target min-h-[44px] sm:min-h-0" från ui-components.md

## Arkitekturcoverage

N/A (ingen arkitekturdesign-story för denna).

## Modell

sonnet

## Avvikelser och lärdomar

- Before-screenshots togs framgångsrikt med Playwright MCP mot dev-servern (redan igång på port 3000) och test-provider `provider@example.com`.
- `sm:min-h-0` saknas ofta när man lyfter touch-target manuellt -- kom ihåg att titta på ui-components.md-mönstret direkt.
- `adress`-fältet i SmartReplyVars hade domän-fel (leverantören åker till kunden, inte tvärtom). Rätt beteende: ta bort fältet helt, inte ersätta det.
