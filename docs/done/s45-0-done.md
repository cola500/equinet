---
title: "S45-0 Done: Plan-commit-gate"
description: "Pre-commit hook som varnar när story in_progress saknar committad plan-fil"
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

# S45-0 Done: Plan-commit-gate

## Acceptanskriterier

- [x] Hook varnar korrekt när story in_progress utan plan-fil (testat med S99-9)
- [x] Hook varnar INTE när plan-fil finns + committad (S45-0 passerade utan varning)
- [x] Hook varnar INTE vid ren lifecycle-docs-commit (scenario 3 passerade)
- [x] Test med scenariot från S43-1 (story in_progress utan plan) — fångades korrekt

## Definition of Done

- [x] Inga TypeScript-fel (bash-script, ej relevant)
- [x] Säker (inga exec-injections — inga user-inputs interpoleras utan sanitering)
- [x] Tester: 3 manuella scenarietester körda och verifierade
- [x] Feature branch, check:all ej tillämpbar (bash-only ändring, inga .ts-filer)
- [x] Ingen slutanvändar-påverkan — inga hjälpartiklar/testing-guide att uppdatera

## Reviews körda

Kördes: code-reviewer

Trivialt i terms av logik, men yta = 2 filer (`scripts/` + `.husky/`). Kör code-reviewer för att verifiera bash-korrekthet.

## Docs uppdaterade

Ingen docs-uppdatering (intern process-infra, ingen slutanvändar-påverkan).
`docs/guides/git-hooks.md` skapas i S45-3 (samlar alla hooks på ett ställe).

## Verktyg använda

- Läste patterns.md vid planering: N/A (trivial)
- Kollade code-map.md för att hitta filer: N/A (visste redan)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Modell

sonnet

## Lärdomar

- Pre-commit hooken kräver `## Aktualitet verifierad`-sektion i plan-filer (fångades av hooken vid första commit-försöket) — bra att se hooken i aktion direkt.
- `git ls-files --error-unmatch` är rätt sätt att kontrollera om en fil är committad (returnerar non-zero om ej tracked).
- Lifecycle-only-detektering baseras på att inga `src/`, `e2e/`, `scripts/`, `prisma/`, `ios/`-filer är staged — robust nog för normala commits.
