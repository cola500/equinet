---
title: "S36-3 Done: Tech lead-på-feature-branch-varning"
description: "Hook-varning implementerad för tech lead som committar lifecycle-docs på dev:s feature branch"
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

# S36-3 Done: Tech lead-på-feature-branch-varning

## Acceptanskriterier

- [x] Hook varnar på feature branch + tech lead-email + bara lifecycle-docs
- [x] Hook varnar INTE på main
- [x] Hook varnar INTE när kod ändras (inte rent docs-commit)
- [x] `parallel-sessions.md` uppdaterad med hook-referens
- [x] Manuell test: skapa feature branch, committa status.md → se varning
- [x] `npm run check:all` grön

**Testresultat:**
- Test 1 (feature branch + status.md): varning visades korrekt
- Test 2 (main + status.md): ingen varning (script på main har inte varnings-koden, korrekt)
- Test 3 (feature branch + scripts/): ingen varning

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen ny säkerhetspåverkan)
- [x] `npm run check:all` grön (4163 tester, 4/4 gates)
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: ingen (trivial story — mekanisk script-ändring, <30 min, inga API-ytor, ingen UI)

## Docs uppdaterade

Uppdaterade: `.claude/rules/parallel-sessions.md` (hook-referens)

## Verktyg använda

- Läste patterns.md vid planering: nej (liten script-story)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Modell

sonnet

## Lärdomar

- `git restore <fil>` återställer till senast COMMITTAD version, inte till senast editerad. Vid testflöden som inkluderar `git restore` — committa ändringar FÖRST eller undvik restore på ostagade filer.
- early-exit i bash-scripts (`exit 0`) blockerar all kod som kommer efter. Om en ny check behöver köras alltid — placera den FÖRE early exit, inte efter.
