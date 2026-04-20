---
title: "S47-1 Done: Review-obligatorisk-gate (pre-commit BLOCKER)"
description: "Done-fil för S47-1 — review-gate implementerad och testad"
category: plan
status: archived
last_updated: 2026-04-20
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S47-1 Done: Review-obligatorisk-gate (pre-commit BLOCKER)

## Acceptanskriterier

- [x] Hook **blockerar** done-fil-commit när obligatoriska reviews saknas
- [x] Override-mekanism fungerar (`[override: text]` i subject-raden)
- [x] Trivial-gating-undantag (code-reviewer markerad "trivial story" hoppar över check)
- [x] Test: S46-1-scenariot → blockerar (route.ts + saknar security-reviewer)
- [x] Test: korrekt done-fil → passerar (alla [x])
- [x] Test: docs-only story → passerar utan reviews
- [x] Test: override fungerar (template-placeholder <...> matchar ej)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (rena bash-scripts)
- [x] Säker (while IFS= read -r, override begränsat till subject, LC_ALL=C)
- [x] check:all 4/4 gröna
- [x] Feature branch, mergad via PR

## Reviews körda

<!-- Strukturerat format. Alla obligatoriska (per review-matrix.md) måste vara [x]. -->

- [x] code-reviewer — 2 critical buggar hittade och fixade (ACTUAL_SET section-naiv, override COMMIT_EDITMSG-stale)
- [x] security-reviewer — 4 Important fixade (word-splitting, override subject-only, main-branch warning, unknown-ID warning)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen arkitekturändring, enbart process-script)

## Docs uppdaterade

Ingen docs-uppdatering (intern process-script, ingen användarvänd ändring).
CLAUDE.md Key Learnings påverkas ej — mönstret är nytt och dokumenteras i scriptet självt.

## Verktyg använda

- Läste patterns.md vid planering: nej (process-script, ej domänspecifikt)
- Kollade code-map.md för att hitta filer: nej (visste redan vilka filer)
- Hittade matchande pattern: nej
- Varför: S47-1 är en process-enforcement-story, inte en domain-feature

## Arkitekturcoverage

Designdokument: `docs/sprints/sprint-47.md` (S47-1-avsnittet)
Alla numrerade beslut implementerade: ja

- Trigger: pre-commit med `docs/done/*.md` staged ✓
- Logik 1-8 (story-id, branch-diff, matris-lookup, required_set, done-parsning, actual_set, jämförelse, blocka) ✓
- Override: `[override: <motivering>]` i commit-message subject ✓
- Felmeddelande: story, fil, krävs, hittat, saknar ✓

## Modell

sonnet

## Lärdomar

- **COMMIT_EDITMSG stale-risk**: Om föregående commit innehöll template-text med `[override: ...]` hade override-check:en bypassat gaten. Fix: begränsa till subject-raden + kräv att motivering börjar med bokstav/siffra.
- **Sections-naiv parsing**: `grep -E "- [x]..."` på hela done-filen matchar checkboxar i Acceptanskriterier-sektionen. Alltid extrahera specifiik sektion med `awk` vid parsing av markdown-filer med liknande struktur.
- **LC_ALL=C för CI-robusthet**: awk-mönster med svenska tecken (ö) kan misslyckas i CI-miljöer med `LANG=C`. Prefixera awk-anrop med `LC_ALL=C` för portabilitet.
- **Word-splitting i for-loopar**: använd alltid `while IFS= read -r VAR; do ... done <<< "$LIST"` för filnamnsiteratorn — `for VAR in $LIST` är sårbart för filnamn med mellanslag.
