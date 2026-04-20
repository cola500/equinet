---
title: "S47-5 Done: Sprint-avslut-review-gate"
description: "Pre-commit hook blockerar retro-commit direkt på main. Sprint-avslut kräver feature branch + PR."
category: guide
status: active
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

# S47-5 Done: Sprint-avslut-review-gate

## Acceptanskriterier

- [x] `autonomous-sprint.md` uppdaterad med sprint-avslut-som-story-regel
- [x] Hook blockerar retro-commit direkt på main utan feature branch
- [x] Override fungerar för tech lead (`[override: <motivering>]`)
- [x] Test: Dev committar retro på main → blockerar
- [x] Test: retro-commit på feature/sprint-X-avslut → passerar

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga auth/injection-ytor i bash-script)
- [x] Tester skrivna FÖRST, 37/37 gröna
- [x] Feature branch, `check:all` grön (4/4), mergad via PR
- [x] Docs: `autonomous-sprint.md` uppdaterad (sprint-avslut-som-story-regel)

## Reviews körda

- [x] code-reviewer — inga kritiska problem. Viktigt: lade till `git rev-parse`-guard i toppen av scriptet (konsistent med andra hooks). Mönster och logik korrekt.
- [ ] security-reviewer — ej tillämplig (bash-script, inga auth/input-surfaces)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen arkitekturändring)

## Docs uppdaterade

- [x] `.claude/rules/autonomous-sprint.md` — sprint-avslut-som-story-regel tillagd i Steg 3

Ingen README/NFR-uppdatering behövs (intern process-enforcement, ingen användarvänd ändring).

## Verktyg använda

- Läste patterns.md vid planering: nej (hook-patterns utlästa direkt från befintliga scripts)
- Kollade code-map.md för att hitta filer: nej (visste redan vilka filer)
- Hittade matchande pattern: ja — samma override-regex som `check-branch-for-story.sh` och `check-sprint-closure.sh`

## Arkitekturcoverage

Designdokument: `docs/sprints/sprint-47.md` (S47-5-sektionen)

| Beslut | Implementerat |
|--------|---------------|
| Hook blockerar retro-commit direkt på main | Ja |
| Feature branch → passerar | Ja |
| Override med motivering | Ja |
| autonomous-sprint.md förtydligande | Ja |
| Test: 4 scenarier | Ja (37/37 totalt) |

Alla numrerade beslut implementerade: ja.

## Modell

sonnet

## Lärdomar

- **`git rev-parse`-guard är obligatorisk** i alla pre-commit hooks med `set -euo pipefail`. Om scriptet körs utanför ett git-repo (t.ex. i CI-kontext) returnerar `git diff --cached` fel och `set -e` dödar scriptet med exit 1 → falskt BLOCKER. Guard: `git rev-parse --git-dir > /dev/null 2>&1 || exit 0`.
- Sprint-avslut är konceptuellt lika med en feature-story men det var inte formaliserat. Nu är det tydligt i `autonomous-sprint.md`.
