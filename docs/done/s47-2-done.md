---
title: "S47-2 Done: Branch-check pre-commit (BLOCKER)"
description: "Pre-commit hook som blockerar kod-commits på main när story är in_progress."
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

# S47-2 Done: Branch-check pre-commit (BLOCKER)

## Acceptanskriterier

- [x] Hook **blockerar** commit på main när story in_progress och kod-ändringar staged
- [x] Undantag för lifecycle-docs (status.md, session-*.md, retros, sprint-*.md, plans/*, metrics/*)
- [x] Override fungerar (`[override: <motivering>]` i commit-message med -m)
- [x] Test: S46-1 direct-main-scenariot → blockerar (verifierat manuellt)
- [x] Test: tech lead uppdaterar status.md → passerar (lifecycle-only check)
- [x] Test: sprint-plan-commit på main → passerar (docs/plans/ är lifecycle)
- [x] Test: ingen story in_progress → passerar

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (Zod, error handling, ingen XSS/injection — N/A, bash-script)
- [x] Tester: manuella smoke-tester för alla 5 scenarier
- [x] Feature branch, `check:all` grön (4/4), mergad via PR
- [x] Content matchar kod: inga slutanvändar-docs påverkas

## Reviews körda

<!-- Strukturerat format. Alla obligatoriska (per review-matrix.md) måste vara [x]. -->

- [x] code-reviewer — Important-fynd fixat: awk-kolumnfiltrering ersätter grep-pipeline för in_progress-detektionen (undviker false positive om story-titel innehåller "in_progress"). Suggestion om override-timing noterad som kommentar i script.
- [ ] security-reviewer — ej tillämplig (scripts/-fil, inga nya src/app/api/-routes)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen arkitekturändring)

## Docs uppdaterade

Ingen docs-uppdatering (intern process-script, ingen användarvänd ändring).

## Verktyg använda

- Läste patterns.md vid planering: nej (script-story, inget pattern att hämta)
- Kollade code-map.md för att hitta filer: nej (visste redan vilka filer)
- Hittade matchande pattern? nej (hook-mönster finns i befintliga scripts men inget återanvändbart pattern i patterns.md)

## Arkitekturcoverage

Ej tillämplig — ingen designdokument för denna story.

## Modell

sonnet

## Lärdomar

- `git checkout main` misslyckas tyst (med `2>/dev/null`) vid unstaged ändringar på feature branch — smoke-tester bör använda `git stash` + `git stash pop` för att undvika detta.
- `check-plan-commit.sh` har samma latenta in_progress-kolumnbugg (grep på hela raden). Bör fixas i S47-3 eller separat cleanup.
- Override-läsning via COMMIT_EDITMSG fungerar enbart med `git commit -m` — interaktiv commit utan -m läser föregående commits meddelande. Dokumenterat som kommentar i scriptet.
