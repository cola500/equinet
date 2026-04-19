---
title: "Done S39-1: Claude-hook paths → $CLAUDE_PROJECT_DIR"
description: "Alla hooks i .claude/settings.json använder $CLAUDE_PROJECT_DIR"
category: plan
status: archived
last_updated: 2026-04-19
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

# Done S39-1: Claude-hook paths → $CLAUDE_PROJECT_DIR

## Acceptanskriterier

- [x] Alla hooks i `.claude/settings.json` använder `$CLAUDE_PROJECT_DIR`
- [x] Hooks fungerar i huvudrepo (ingen regression — hooks triggades normalt under sessionen)
- [x] `npm run check:all` grön (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (config-ändring, ingen säkerhetspåverkan)
- [x] `check:all` grön
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: ingen (trivial story — mekanisk textbyte, <15 min, check:all grön)

## Docs uppdaterade

Ingen docs-uppdatering (intern config-ändring, ingen användarvänd beteendeändring)

## Verktyg använda

- Läste patterns.md vid planering: N/A (trivial)
- Kollade code-map.md: nej (visste redan)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A.

## Modell

sonnet

## Lärdomar

`$CLAUDE_PROJECT_DIR` sätts av Claude Code-runtime för hooks, men inte i vanliga shell-sessioner. Kan inte verifieras med `echo $CLAUDE_PROJECT_DIR` i Bash-verktyget. Ändringen är low-risk — om variabeln saknas i något kontext failar hooken gracefully (ingen blockering av commit).
