---
title: "S45-1: Sprint-avslut-gate"
description: "Pre-commit hook som varnar när ny story startas utan att föregående sprint är korrekt avslutad"
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

# S45-1: Sprint-avslut-gate

## Aktualitet verifierad

**Kommandon körda:** `ls scripts/check-sprint-closure.sh 2>/dev/null`
**Resultat:** Filen existerar inte — nytt arbete.
**Beslut:** Fortsätt

## Approach

1. Skapa `scripts/check-sprint-closure.sh` som:
   - Extraherar aktiv sprint-nummer från status.md
   - Räknar stories med "done" vs totalt i aktiv sprint
   - Om alla done: kollar om retro-fil finns (`docs/retrospectives/*sprint-<N>.md`)
   - Om retro saknas: varnar (ej blockerar)
   - Hoppar över om inga kod/script-filer staged (lifecycle-only commit)

2. Integrera i `.husky/pre-commit` som steg 5

3. Testa med S43→S44-scenariot (alla stories done, retro saknas)

## Filer som ändras/skapas

- `scripts/check-sprint-closure.sh` (ny)
- `.husky/pre-commit` (utökas med steg 5)

## Testscenarier

1. **Aktiv sprint pågår** (någon story pending/in_progress) → ingen varning
2. **Alla done, retro saknas** → [VARNING] visas
3. **Alla done, retro finns** → ingen varning
4. **Lifecycle-only commit** → hoppa över
5. **Tom sprint-tabell** → ingen varning (edge case)

## Risker

- Status.md parsing är känslig för format-ändringar — begränsa grep noga
- Retro-filnamn varierar (datum-format) — anvand glob-match istället för exakt namn
- Hook ska vara snabb (<1s)
