---
title: "S47-5 Plan: Sprint-avslut-review-gate"
description: "Pre-commit hook som blockerar retro-commit direkt på main + regel-förtydligande i autonomous-sprint.md"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Aktualitet verifierad
  - Scope
  - Implementation
  - Tester
  - Risker
---

# S47-5 Plan: Sprint-avslut-review-gate

## Aktualitet verifierad

**Kommandon körda:** `ls scripts/check-*.sh`, `cat .husky/pre-commit`, `cat scripts/test-hooks.sh`
**Resultat:** 8 befintliga hook-scripts. S45-sprint-avslut-problemet är ej åtgärdat. `autonomous-sprint.md` saknar sprint-avslut-som-story-regel.
**Beslut:** Fortsätt med implementation.

## Scope

Tre delar:

1. **`scripts/check-sprint-retro.sh`** — ny hook som blockerar retro-commit direkt på main
2. **`.husky/pre-commit`** — lägga till anrop av ny hook
3. **`docs/sprints/autonomous-sprint.md`** — förtydligande om sprint-avslut som story
4. **`scripts/test-hooks.sh`** — tester för ny hook

## Implementation

### Hook-logik (`check-sprint-retro.sh`)

```
Trigger: pre-commit med docs/retrospectives/<datum>-sprint-<N>.md staged

1. Kolla om någon retro-fil är staged (pattern: docs/retrospectives/*sprint*.md)
2. Om ingen: exit 0 (ej relevant)
3. Kolla current branch
4. Om feature branch: exit 0 (korrekt flöde)
5. Om main (eller annan ej-feature-branch):
   - Kolla override i COMMIT_EDITMSG
   - Om override: exit 0 med logg
   - Annars: BLOCKERA med tydligt felmeddelande
```

### Felmeddelande

```
[BLOCKER] Retro-commit direkt på main.
  Staged: docs/retrospectives/2026-04-20-sprint-47.md
  Current branch: main

Sprint-avslut ska granskas av tech lead innan merge.
Skapa feature branch: git checkout -b feature/s47-avslut
Eller: lägg [override: <motivering>] i commit-message.
```

### Tillägg i `.husky/pre-commit`

Lägg till steg 8 efter befintliga 7 steg:
```bash
# 8. Sprint-retro-gate (BLOCKER om retro committas direkt på main)
bash scripts/check-sprint-retro.sh || exit 1
```

### Tillägg i `autonomous-sprint.md`

I "Steg 3. Done-fil + status-uppdatering" eller "Sprint-avslut" sektionen:
> **Sprint-avslut är en story med egen review.** Retro + status.md-ändringar + docs-sync (README/NFR/CLAUDE.md) ska granskas av tech lead innan merge, på samma sätt som en feature-story. Dev får inte committa retro direkt på main.

## Tester

Minst 3 scenarier i `test-hooks.sh`:

1. **Ingen retro staged → passerar** (exit 0)
2. **Retro staged på main → BLOCKERAR** (exit 1)
3. **Retro staged på feature branch → passerar** (exit 0)
4. **Retro staged på main + override → passerar** (exit 0)

## Risker

- **Låg risk:** Hook rör bara retro-filer, inga befintliga filer ändras beteende.
- **Falsk positiv:** Om tech lead committar retro direkt på main (medvetet) — override finns.
