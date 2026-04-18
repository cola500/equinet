---
title: "S36-6 Plan: Seven Dimensions-tvingad slicing-trigger"
description: "Pre-commit hook varnar när status.md-backlog-rad tyder på oslicat epic"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - User story
  - Påverkade filer
  - Approach
  - Arkitekturcoverage
  - Risker
---

# S36-6 Plan: Seven Dimensions-tvingad slicing-trigger

## Aktualitet verifierad

**Kommandon körda:**
- `ls .claude/rules/story-refinement.md` → finns (S33)
- `ls docs/ideas/epic-messaging.md` → finns (S33 testkörning)

**Beslut:** Fortsätt.

## User story

Som tech lead vill jag få en varning när en backlog-rad tyder på ett oslicat epic, så att jag inte missar att köra Seven Dimensions-processen.

## Påverkade filer

1. `scripts/check-docs-updated.sh` — ny sektion efter tech lead-varningen
2. `.claude/rules/story-refinement.md` — not om hooken

## Approach

Ny sektion i check-docs-updated.sh, placerad EFTER tech lead-varningen (och FÖRE early-exit):

Triggerkriteria: status.md är staged OCH ny rad innehåller "epic" ELLER effort >3 dagar
("3 dagar", "4 dagar", ..., "9 dagar" eller "X sprintar") UTAN länk till `docs/ideas/epic-*.md`.

Varning blockerar inte.

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Risker

- **Falsk positiv:** Befintliga backlog-rader som skrivs om utan länk. Acceptabelt — varning är mjuk.
- **Regex-precision:** "3 dagar" kan dyka upp i motiveringstext utan att vara ett effort-värde. Acceptabelt per story-avgränsning.
