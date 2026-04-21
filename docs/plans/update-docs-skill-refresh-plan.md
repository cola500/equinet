---
title: "Plan: update-docs skill refresh"
description: "Genomlysning av .claude/skills/update-docs/SKILL.md gav fem brister att fixa. Filen är tracked (övriga skills gitignored — separat A-backlog-rad)."
category: plan
status: active
last_updated: 2026-04-21
sections:
  - Problem
  - Scope
  - Acceptanskriterier
---

# Plan: update-docs skill refresh

## Problem

Genomlysning 2026-04-21 identifierade:

1. Svenska tecken felkodade (`kor`, `andrats`) — ironiskt eftersom skillen predikar korrekta å/ä/ö
2. Checklistan missar nya docs-kategorier (operations/, ideas/, rules/review-*, arkitektur-patterns, messaging-*)
3. Verifieringssteg saknar `check:all`, `docs:validate`, `test:hooks`
4. S47-hook-medvetenhet saknas (override-mönster)
5. "Skapa aldrig nya docs" för strikt — legitima undantag finns (audit, pilot, design)

**Filen är tracked** i git trots att `.claude/skills/` är i .gitignore (rad 100) — legacy-state. Övriga 13 skills är otracked. Separat backlog-rad skapas för att adressera det (A från B+A-beslutet).

## Scope

Uppdatera enbart `.claude/skills/update-docs/SKILL.md`. Ingen gitignore-ändring, inga andra skills.

## Acceptanskriterier

- [ ] Alla svenska tecken korrekta (å, ä, ö)
- [ ] Checklistan täcker architecture/ (inkl patterns + messaging), operations/, ideas/, rules/review-*
- [ ] Verifieringssteg inkluderar check:all, docs:validate, test:hooks
- [ ] Override-mekanismen nämnd
- [ ] Skapande-regeln nyanserad med undantag
- [ ] Filen ≤150 rader
