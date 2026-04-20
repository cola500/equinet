---
title: "S47-3 Done: Hook-tester (scripts/test-hooks.sh)"
description: "Test-script för alla 6 pre-commit hooks med 27 isolerade scenarier."
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

# S47-3 Done: Hook-tester (scripts/test-hooks.sh)

## Acceptanskriterier

- [x] Tester för alla 6+ hooks (check-sprint-closure, check-plan-commit, check-branch-for-story, check-reviews-done, check-docs-updated, check-own-pr-merge)
- [x] Minst 3 scenarier per hook (pass + fail + override/edge case) — 27 scenarier totalt
- [x] `npm run test:hooks` tillagd i package.json
- [x] Dokumentation: kommentar i skriptet förklarar hur man lägger till test för ny hook (rad 4-15)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (bash-script, ej tillämpligt)
- [x] Säker (inga shell-injektioner, alla temp-repos isolerade)
- [x] 27/27 scenarier gröna
- [x] Feature branch, `check:all` grön (4/4), mergad via PR
- [x] Content matchar kod: inga slutanvändar-docs påverkas

## Reviews körda

<!-- Strukturerat format. Alla obligatoriska (per review-matrix.md) måste vara [x]. -->

- [x] code-reviewer — 3 Important-fynd fixade: trap EXIT för cleanup, assert_fail asymmetri, kommentar om otestade warningsblock i check-docs-updated. 2 suggestions noterade (assert_fail-symmetri fixad, check-own-pr-merge icke-interaktivt läge ej testbart utan mock-gh).
- [ ] security-reviewer — ej tillämplig (scripts/-filer, inga nya API-routes)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen arkitekturändring)

## Docs uppdaterade

Ingen docs-uppdatering (intern process-tooling, ingen användarvänd ändring).

## Verktyg använda

- Läste patterns.md vid planering: nej (skript-story)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern? nej

## Arkitekturcoverage

Ej tillämplig.

## Modell

sonnet

## Lärdomar

- **Subshell-fällan i bash**: `tmpdir=$(setup_repo)` kör funktionen i en subshell → `cd` inuti har ingen effekt på outer shell. Symptom: testskriptet körde mot huvud-repot och skapade testfiler där. Fix: anropa funktioner direkt (inte via `$()`), lagra resultat i global variabel.
- **trap EXIT** skyddar mot ackumulering av temp-kataloger vid oväntat avbrott. Lägg alltid till vid temp-repo-mönster.
- `check-docs-updated.sh` har icke-blockerande varningsblock (Seven Dimensions, ProviderNav, messaging-konvention) som kräver specifik user.email/filstruktur för att triggas. Dessa testas inte i test-hooks.sh — dokumenterat med kommentar.
