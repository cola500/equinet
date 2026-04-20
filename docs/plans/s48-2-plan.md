---
title: "S48-2: gh pr merge-wrapper"
description: "Plan för wrapper-script + git alias som enforcar check-own-pr-merge FÖRE gh pr merge"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Syfte
  - Filer som ändras
  - Approach
  - Risker
---

# S48-2: gh pr merge-wrapper

## Aktualitet verifierad

**Kommandon körda:**
- `ls scripts/gh-pr-merge.sh` → fil existerar inte
- `git config --local alias.merge-pr` → alias finns inte

**Resultat:** Varken script eller alias är satta. S48-2 är fortfarande olöst.

**Beslut:** Fortsätt

## Syfte

Stänger S47-4-luckan: `check-own-pr-merge.sh` måste idag anropas manuellt — det ger ingen enforcement. Dev mergade sig själv 3 ggr under S47 trots att regeln fanns.

Lösning: ett wrapper-script som automatiskt kör checken FÖRE `gh pr merge`, + ett git alias som ersätter vanan att skriva `gh pr merge` direkt.

## Filer som ändras/skapas

| Fil | Ändring |
|-----|---------|
| `scripts/gh-pr-merge.sh` | NY — wrapper-script |
| `.claude/rules/commit-strategy.md` | Uppdatera med alias-dokumentation + ny `git merge-pr`-sektion |

Git alias sätts lokalt via `git config --local alias.merge-pr '!bash scripts/gh-pr-merge.sh'` — lagras i `.git/config`, ej committad.

## Approach

1. Skapa `scripts/gh-pr-merge.sh` per sprint-spec
2. Kör `git config --local alias.merge-pr '!bash scripts/gh-pr-merge.sh'`
3. Verifiera att scriptet blockerar rätt (lokal smoke-test utan riktig PR)
4. Uppdatera `commit-strategy.md` med:
   - Ny sektion "gh pr merge-wrapper" som dokumenterar `git merge-pr <PR> --merge --delete-branch`
   - Instrukion för alias-setup (nytt klone/ny session)
5. Code-reviewer
6. `npm run check:all`
7. Done-fil + PR

## Risker

- Git alias lever i `.git/config` — ny session/klon tappar alias. Mitigering: dokumentera i commit-strategy.md + ev. `scripts/setup-aliases.sh` om det behövs.
- Override-flag måste passas through: `gh-pr-merge.sh` tar `--override` som extra arg via `"$@"` till check-own-pr-merge.

## Commits

1. Plan på main (denna commit)
2. Implementation: `scripts/gh-pr-merge.sh` + `commit-strategy.md` (feature branch)
3. Done-fil (feature branch, samma commit som status-uppdatering)
