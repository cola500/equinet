---
title: "S36-4 Done: Docs-matris compliance-check post-merge"
description: "scripts/check-docs-compliance.sh + M7 i generate-metrics.sh"
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

# S36-4 Done: Docs-matris compliance-check post-merge

## Acceptanskriterier

- [x] `scripts/check-docs-compliance.sh` fungerar fristående (11 gap identifierade)
- [x] `generate-metrics.sh` kör compliance-check som M7-sektion
- [x] Minst en historisk story flaggas som gap (11 gap funna)
- [x] Falska positiv-rate rimlig (≤50%) — ~2/11 = ~18% efter regex-fixar
- [x] `npm run check:all` grön

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga nya säkerhetsrisker)
- [x] `npm run check:all` 4/4 gröna (4163 tester)
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: ingen (trivial story — nytt script utan affärslogik, <1.5h, inga API-ytor, ingen UI)

## Docs uppdaterade

Uppdaterade: `.claude/rules/documentation.md` (not om retroaktiv docs-check via metrics:report)

## Verktyg använda

- Läste patterns.md vid planering: nej (script-story)
- Kollade code-map.md: nej (visste redan)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Modell

sonnet

## Lärdomar

- `grep -qiE "ny.*auth"` matchar "nya routes eller auth-ändringar" — ordföljd i regex räcker inte, behöver word-boundary eller mer specifika termer
- Done-filer använder två format: `Uppdaterade: <lista>` och bullet-lista under `## Docs uppdaterade`. Bägge måste hanteras
- Bash `if grep -q ...` suppressar exit-kod — det är bra men gör det svårt att debugga när inget matchas
- early exit i script (`exit 0`) är en gemensam fallgrop för checks som ska köras alltid
