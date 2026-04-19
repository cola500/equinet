---
title: "S45-3: Tech-lead-merge-gate"
description: "Förtydliga Station 7 i team-workflow.md + script som varnar vid egen PR-merge"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Risker
---

# S45-3: Tech-lead-merge-gate

## Aktualitet verifierad

**Kommandon körda:** `grep -n "Dev MERGAR ALDRIG\|own-pr-merge" .claude/rules/team-workflow.md scripts/ 2>/dev/null`
**Resultat:** Ingen träff — regeln saknas, scriptet saknas.
**Beslut:** Fortsätt

## Approach

**Del 1: Regel-förtydligande i team-workflow.md Station 7**

Lägg till explicit stycke direkt efter rubriken:

> **Dev MERGAR ALDRIG egen PR — tech lead är alltid gatekeeper.**
>
> Flow: Dev pushar feature branch → tech lead triggas via "kör review" → tech lead granskar + skapar PR + mergar. Om Dev skapar PR själv: tech lead måste triggas explicit innan merge. Undantag: rule-docs-ändringar (`.claude/rules/*`) kan mergas av den som gjorde dem efter self-review.

**Del 2: `scripts/check-own-pr-merge.sh`**

Bash-script som anropas manuellt (`bash scripts/check-own-pr-merge.sh <PR-nummer>`) innan `gh pr merge`:
- Hämtar PR-author via `gh pr view`
- Jämför med `gh api user`
- Varnar och ber om bekräftelse om samma person
- Skriver ut undantag om PR rör `.claude/rules/*`

## Filer som ändras

- `.claude/rules/team-workflow.md` (Station 7 + last_updated)
- `scripts/check-own-pr-merge.sh` (ny)

## Risker

- Scriptet är manuellt — ingen automatisk enforcement (kräver Pro för branch protection)
- `read -p` för interaktivt läge fungerar inte i icke-interaktiva shells (CI) → sätt fallback
