---
title: "Tech Lead -- arbetssätt"
description: "Hur tech lead-sessionen arbetar: plan-review, code review, merge, kommunikation"
category: rule
status: active
last_updated: 2026-04-02
tags: [workflow, team, tech-lead, review]
sections:
  - Kommandon
  - Plan-review
  - Code review och merge
  - Kommunikation
  - Vad tech lead INTE gör
---

# Tech Lead -- arbetssätt

## Kommandon

| Johan säger | Tech lead gör |
|-------------|--------------|
| "kör review" | Granska plan eller kod (se nedan) |
| "kör" | Starta utvecklarsession (tech lead gör normalt inte detta) |
| "status" | Läs status.md och rapportera |

## Plan-review (station 1)

Utvecklaren committar en plan på sin feature branch (lokalt).

1. Läs planen **lokalt först**: `git show feature/<branch>:docs/plans/<story>-plan.md`
2. Om inte hittas lokalt: `git fetch origin` och kolla remote
3. Bedöm:
   - Är scope avgränsat? (antal filer, inga arkitekturändringar utan diskussion)
   - Följer den TDD? (RED före GREEN)
   - Saknas något? (auth, tester, edge cases)
   - Risker identifierade?
4. Godkänn eller ge feedback till Johan

## Code review och merge (station 7)

Utvecklaren pushar sin feature branch till remote.

1. `git fetch origin` -- hämta senaste
2. `git log --oneline main..origin/feature/<branch>` -- vilka commits?
3. `git diff --stat main..origin/feature/<branch>` -- vilka filer?
4. Granska: sampla 1-2 filändringar i detalj
5. Checka ut branchen: `git checkout feature/<branch>`
6. Kör `npm run check:all` (webb) eller relevant iOS-testsvit
7. Om godkänt: skapa PR och merga via GitHub:
   ```bash
   gh pr create --base main --head feature/<branch> \
     --title "S<X>-<Y>: kort beskrivning" \
     --body "## Summary\n- ...\n\n## Test plan\n- ..."
   # Vänta på CI (Quality Gate Passed)
   gh pr merge <PR-nummer> --merge --delete-branch
   ```
8. Om problem: meddela Johan, utvecklaren fixar
9. **OMEDELBART efter merge: uppdatera status.md** -> story "done" + commit-hash. Committa + pusha. ALDRIG skjuta på detta -- det har glömts 5+ gånger.

## Kommunikation

- **Git är kanalen.** Läs lokala branches, git log, git diff.
- **Kolla lokalt först** -- utvecklaren och tech lead delar working directory.
- **status.md** -- läs och uppdatera vid merge.
- **Committa aldrig till en annan sessions branch** -- vänta tills den är klar.

## Vad tech lead INTE gör

- Implementerar features (det gör utvecklarsessionen)
- Committar till working directory medan en utvecklarsession pågår
- Pushar till main utan att ha kört quality gates
- Godkänner planer utan att ha läst dem
