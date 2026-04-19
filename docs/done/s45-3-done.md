---
title: "S45-3 Done: Tech-lead-merge-gate"
description: "Station 7-regel i team-workflow.md + check-own-pr-merge.sh script"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Lärdomar
---

# S45-3 Done: Tech-lead-merge-gate

## Acceptanskriterier

- [x] Regel tillagd i team-workflow.md Station 7 (granskad och godkänd av Johan före commit)
- [x] `last_updated` uppdaterad i team-workflow.md
- [x] `scripts/check-own-pr-merge.sh` fungerar (manuellt testat: saknat argument, icke-interaktivt läge)
- [x] Undantag för `.claude/rules/*` implementerat
- [x] Icke-interaktivt fallback (CI/pipe) — exit 0 utan att blocka

## Definition of Done

- [x] Inga TypeScript-fel (bash + python3 inline)
- [x] Säker (inga shell-injections, PR-nummer valideras som argument)
- [x] Manuella tester körda
- [x] Feature branch, check:all ej tillämpbar (bash-only + rule-doc)
- [x] Ingen slutanvändar-påverkan

## Reviews körda

Kördes: code-reviewer + tech-architect (regel-ändring)

## Docs uppdaterade

- [x] `.claude/rules/team-workflow.md` Station 7 uppdaterad

`docs/guides/git-hooks.md` samlar alla fyra S45-hooks — skapas i S45-4 eller separat backlog-rad.

## Verktyg använda

- Läste patterns.md: N/A
- Kollade code-map.md: N/A
- Matchande pattern: nej

## Arkitekturcoverage

N/A

## Modell

sonnet

## Lärdomar

- Rule-commit hamnade på main istället för feature-branchen (checkout-miss). Cherry-pick + reset --hard löste det utan dataförlust. Varning: `git checkout main && git checkout -b <branch>` — kontrollera alltid `git branch --show-current` INNAN commit.
- `read -rp` blockerar i icke-interaktiva shells (CI, pipe). Guard `[[ ! -t 0 ]]` fångar det.
- `gh pr view --json files` ger fillistning för undantags-check utan extra API-anrop.
