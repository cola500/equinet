---
title: "S36-6 Done: Seven Dimensions-tvingad slicing-trigger"
description: "Pre-commit hook varnar vid oslicat epic i status.md-backlog"
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

# S36-6 Done: Seven Dimensions-tvingad slicing-trigger

## Acceptanskriterier

- [x] Hook varnar vid "epic" eller effort >3 dagar utan länk
- [x] Hook varnar INTE vid små backlog-rader
- [x] Hook varnar INTE när länk till epic-dokumentet finns
- [x] `story-refinement.md` uppdaterad med referens
- [x] `npm run check:all` grön

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga nya säkerhetsrisker)
- [x] `npm run check:all` 4/4 gröna (4163 tester)
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: ingen (trivial story — 20 rader bash, <45 min, inga API-ytor, ingen UI)

## Docs uppdaterade

Uppdaterade: `.claude/rules/story-refinement.md` (not om automatiserad påminnelse)

## Verktyg använda

- Läste patterns.md vid planering: nej
- Kollade code-map.md: nej
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Modell

sonnet

## Lärdomar

- Markdown-relativa paths (`../ideas/epic-*.md`) matchar inte `docs/ideas/epic-*.md` — kolla alltid faktiska länkformat i befintliga filer innan man skriver grep-pattern
- Placera ny sektion MELLAN tech lead-varningen och early-exit (samma lärodom som S36-3: always check where early exits are)
