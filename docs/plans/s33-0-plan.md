---
title: "Plan: S33-0 Process tweaks"
description: "4 mindre process-justeringar från S31/S32-retros"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Kontext
  - Approach
  - Faser
  - Verifiering
---

# Plan: S33-0 Process tweaks

## Aktualitet verifierad

Backlog-liknande story -- verifierar att varje tweak faktiskt behövs.

- **Kommando körda:**
  ```bash
  grep -c "metrics:report" .claude/rules/autonomous-sprint.md   # 0
  grep -c "Modell:" .claude/rules/auto-assign.md                # 0
  grep -ci "tech lead" .claude/rules/parallel-sessions.md       # 2 (bara nämnd, inte regel)
  grep -c "audit" docs/plans/TEMPLATE.md                        # 0
  ```

- **Resultat:** Alla 4 tweaks saknas fortfarande. Ingen dubblering. Problemen från retro gäller.

- **Beslut:** Problemet finns -- fortsätt med plan.

## Kontext

S31/S32-retros identifierade 4 konkreta process-gap. Alla är små docs/rules-ändringar utan kodpåverkan. Ingen ny logik, inga tester, bara formalisering av lärdomar.

## Approach

En commit per tweak för tydlig historik. Alla i samma feature branch + PR.

## Faser

### Fas 1: TEMPLATE.md -- audit-verifiering

Utöka `## Aktualitet verifierad`-sektionen med en andra kategori för audit-stories.

### Fas 2: autonomous-sprint.md -- metrics:report obligatoriskt

Lägg till `npm run metrics:report` som steg i "Per sprint (vid avslut)"-checklistan.

### Fas 3: auto-assign.md -- "Modell:"-fält

Lägg till rad i done-fil-krav Steg 9: `**Modell:** opus / sonnet / haiku`.

### Fas 4: parallel-sessions.md -- tech lead räknas som session

Lägg till en mening under "Översikt" eller relevant sektion: "Tech lead är också en session när den rör working tree."

## Verifiering

- `npm run check:all` grön
- Pre-commit-hook grön (svenska tecken)
- Grep-verifiering: alla 4 ändringar landade i rätt filer
- Ingen TypeScript/kod-påverkan (docs-only)
