---
title: "S47-4 Done: Uppgradera S45-varningar till BLOCKERS med override"
description: "4 varnings-hooks uppgraderade till BLOCKERs med explicit override-mekanism."
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Lärdomar
---

# S47-4 Done: Uppgradera S45-varningar till BLOCKERS med override

## Acceptanskriterier

- [x] check-plan-commit.sh: exit 0 → exit 1 när plan saknas (utan override)
- [x] check-sprint-closure.sh: exit 0 → exit 1 när retro saknas (utan override)
- [x] check-multi-commit.sh (ny): extraherat från pre-push, exit 1 om < 2 commits (utan override)
- [x] pre-push: inline multi-commit-gate ersatt med anrop till check-multi-commit.sh
- [x] check-own-pr-merge.sh: non-interaktivt läge exit 0 → exit 1 utan --override
- [x] Override-mönster: [override: <motivering>] i commit-meddelande, motivering MÅSTE starta med bokstav/siffra
- [x] test-hooks.sh uppdaterad: 27 → 33 scenarier (BLOCK-assertions + override-scenarion + test_multi_commit)
- [x] commit-strategy.md: override-dokumentation tillagd

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (bash-script, ej tillämpligt)
- [x] Säker (inga shell-injektioner, GIT_DIR-expansion via git rev-parse, PR-nummer validerat med regex)
- [x] 33/33 scenarier gröna (npm run test:hooks)
- [x] Feature branch, check:all grön (4/4), mergad via PR
- [x] Content matchar kod: inga slutanvändar-docs påverkas (intern process-tooling)

## Reviews körda

<!-- Strukturerat format. Alla obligatoriska (per review-matrix.md) måste vara [x]. -->

- [x] code-reviewer — 1 Critical + 2 Important fixade: pre-commit saknade || exit 1 (hooks blockerade aldrig i praktiken), GIT_DIR-expansion → git rev-parse --git-dir, ocitatad glob i check-sprint-closure. 2 Suggestions noterade (main-branch check i check-multi-commit, done-substring-match) — ej fixade (låg risk).
- [ ] security-reviewer — ej tillämplig (scripts/-filer, inga nya API-routes)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen arkitekturändring)

## Docs uppdaterade

- [x] `.claude/rules/commit-strategy.md` — ny sektion "Override-mönster" med syntax för alla 3 varianter

Ingen README/NFR/hjälpartikel-uppdatering (intern process-tooling, ingen användarvänd ändring).

## Verktyg använda

- Läste patterns.md vid planering: nej (skript-story)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern? nej

## Arkitekturcoverage

Ej tillämplig (ingen designstory).

## Modell

sonnet

## Lärdomar

- **Critical-buggen i pre-commit**: En hook som returnerar exit 1 har ingen effekt om anrops-raden saknar `|| exit 1`. `bash scripts/script.sh` utan exit-propagering är en tyst failure — BLOCKERN blockerade aldrig. Alltid lägg till `|| exit 1` i hooken när skriptet uppgraderas till BLOCKER.
- **GIT_DIR-expansion**: `${GIT_DIR:-.git}` är opålitlig vid manuell körning (miljövariabeln kan manipuleras). `$(git rev-parse --git-dir)` är säkrare och portable.
- **Ocitatat glob**: `ls $VAR_WITH_GLOB` är fragil. Använd alltid literal pattern direkt: `ls docs/retrospectives/*sprint-N*.md`.
