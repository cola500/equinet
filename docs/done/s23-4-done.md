---
title: "S23-4 Done: Feature flag fil-mapping"
description: "Feature flag till fil-mapping i kodkartan via grep"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
---

# S23-4 Done: Feature flag fil-mapping

## Acceptanskriterier

- [x] Varje feature flag listad med alla filer som refererar den
- [x] Agenter kan snabbt se "vilka filer berörs om jag slår av X?"
- [x] Integrerat i generate-code-map.sh (körs med `npm run codemap`)

## Definition of Done

- [x] Scriptet genererar korrekt flag-mapping (427 rader totalt)
- [x] Testfiler och definitions-filen exkluderas från mappningen
- [x] Trasig hook-referens (auto-review.sh) borttagen från settings.json

## Reviews

- Kördes: inga subagenter (verktygsskript)
