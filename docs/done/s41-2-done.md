---
title: "S41-2 Done: Chat-convention-check hook"
description: "Pre-commit varning om messaging-komponent lägger till messages.map utan displayMessages/reverse"
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
  - Lärdomar
---

# S41-2 Done: Chat-convention-check hook

## Acceptanskriterier

- [x] Hook varnar vid messages.map utan displayMessages/reverse (enbart tillagda rader, `^+`)
- [x] Hook varnar INTE vid ändringar som inte rör messaging-filer
- [x] `npm run check:all` grön

## Definition of Done

- [x] Inga TypeScript-fel (bash-script, ej relevant)
- [x] Säker (inga kod-ändringar i produktionskod)
- [x] Tester ej tillämpligt (bash-skript, hook-logik testad manuellt)
- [x] Feature branch, check:all grön

## Reviews körda

Kördes: code-reviewer (trivial per review-gating-kriterier — mekanisk bash-check, <15 min, inga API-ändringar)

## Docs uppdaterade

Ingen docs-uppdatering (infra-ändring, inga användarvänd yta).

## Verktyg använda

- Läste patterns.md vid planering: nej (bash hook, känt pattern)
- Kollade code-map.md: nej
- Hittade matchande pattern? Nej (ny hook-typ)

## Arkitekturcoverage

N/A.

## Modell

sonnet

## Lärdomar

- Viktigt att filtrera på `^+` (tillagda rader) i git diff — annars triggar hooken när man
  FIXAR buggen (tar bort den gamla raden med `messages.map`). Inbyggd gotcha vid diff-grep.
