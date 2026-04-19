---
title: "S45-0: Plan-commit-gate"
description: "Pre-commit hook som varnar när story är in_progress utan committad plan-fil"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Testscenarier
  - Risker
---

# S45-0: Plan-commit-gate

## Aktualitet verifierad

**Kommandon körda:** `ls scripts/check-plan-commit.sh 2>/dev/null`
**Resultat:** Filen existerar inte — nytt arbete.
**Beslut:** Fortsätt

## Approach

1. Skapa `scripts/check-plan-commit.sh` som:
   - Letar upp aktiva story-IDs i `docs/sprints/status.md` (rader med "in_progress")
   - För varje story: kontrollerar om `docs/plans/<story-id>-plan.md` finns OCH är committad (via `git ls-files`)
   - Skriver varning (exit 0) om filen saknas — blockerar ej
   - Hoppar över om enbart lifecycle-docs är staged (retro, done-fil, session-fil)

2. Integrera i `.husky/pre-commit` som steg 4

3. Testa med S43-1-scenariot (story in_progress utan plan-fil)

## Filer som ändras/skapas

- `scripts/check-plan-commit.sh` (ny)
- `.husky/pre-commit` (utökas med steg 4)

## Testscenarier

1. **Trigger-scenario**: status.md har S45-0 in_progress + docs/plans/s45-0-plan.md committad → ingen varning
2. **Saknad plan**: status.md har en story in_progress utan plan-fil → varning
3. **Lifecycle-only commit**: bara retro/done-fil staged → ingen varning (tidigt avslut)
4. **Inga aktiva stories**: status.md har bara done-stories → ingen varning

## Risker

- `grep`-parsing av status.md kan ge false positives om tabellformatet ändras → begränsa mönstret noga
- Plan-fil kan ha versaler i story-ID → normalisera till lowercase i filsökning
- Hook ska vara snabb (<1s) — inga dyra kommandon
