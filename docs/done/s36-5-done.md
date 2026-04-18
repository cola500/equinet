---
title: "S36-5 Done: Modellval-avvikelse-larm i metrics:report"
description: "M8-sektion i generate-metrics.sh som flaggar stories med felaktigt modellval"
category: plan
status: archived
last_updated: 2026-04-18
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

# S36-5 Done: Modellval-avvikelse-larm i metrics:report

## Acceptanskriterier

- [x] M8-sektion i metrics-rapport (`npm run metrics:report`)
- [x] S35-1 flaggas som avvikelse (verifierat: typ=säkerhetskritisk, förväntat=opus, faktisk=sonnet)
- [x] Minst 10 stories kontrolleras retroaktivt (15 kontrollerade)
- [x] `npm run check:all` grön

**Avvikelser funna:** 2 (s35-1 + s35-1-5) — båda giltiga, kända cross-cutting security-stories som kördes med sonnet.

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga nya säkerhetsrisker)
- [x] `npm run check:all` 4/4 gröna (4163 tester)
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: ingen (trivial story — bash-funktion i generate-metrics.sh, <1h, inga API-ytor, ingen UI)

## Docs uppdaterade

Ingen docs-uppdatering (intern metrics-utökning, ingen användarvänd funktionalitet). Memory `project_model_selection_metrics.md` uppdaterad med pekare till M8.

## Verktyg använda

- Läste patterns.md vid planering: nej
- Kollade code-map.md: nej
- Hittade matchande pattern: nej (återanvände mönster från M7/S36-4)

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Modell

sonnet

## Lärdomar

- `S[0-9]+-0.*design` matchade s36-0 (som HADE "S36-0" och "design" i titeln) — regex för "story implementerar X" måste vara mer specifikt ("implementerar S\d+-0", inte bara co-occurrence)
- `arkitekturdesign` matchade "N/A -- ingen tidigare arkitekturdesign" i done-filer — filtrera bort N/A-rader FÖRE grep
- Bash heredoc med `$(function_call)` expanderar direkt — inga citattecken-problem
- Faktisk detektions-precision: 2 giltiga av 2 flaggade = 100% precision på detta dataset
