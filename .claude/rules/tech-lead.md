---
title: "Tech Lead -- arbetssätt"
description: "Hur tech lead-sessionen arbetar: plan-review, code review, merge, kommunikation"
category: rule
status: active
last_updated: 2026-04-22
tags: [workflow, team, tech-lead, review]
paths:
  - "docs/sprints/*"
  - "docs/done/*"
sections:
  - Kommandon
  - Plan-review
  - Code review och merge
  - Djävulens-advokat-review (när körs)
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
3. **OBLIGATORISK subagent-checklista** (kör ALLA som matchar):
   - [ ] API route eller webhook? -> tech-architect
   - [ ] iOS Swift-filer? -> SwiftUI Pro
   - [ ] UI-komponenter? -> cx-ux-reviewer
   - [ ] Säkerhet/auth? -> security-reviewer
   - [ ] Ingen av ovan? -> bara Lead
4. Bedöm:
   - Är scope avgränsat?
   - Följer den TDD/BDD?
   - Saknas något? (auth, tester, edge cases)
   - Risker identifierade?
5. Godkänn eller ge feedback till Johan

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

## Djävulens-advokat-review (när körs)

Tech lead-reviews efter Dev:s egen review är värdefulla **bara med skepsis-prompt** ("vad missade Dev?") OCH **bara för specifika merge-typer**. Annars överlappar de Dev:s egen review och kostar tokens utan ROI.

Källa: process-kost-retro 2026-04-22. S51-0 + S51-0.1 djävulens-advokat-reviews förbrukade ~300k tokens tillsammans, hittade 2 buggar utan launch-impact och 3 edge-case-vektorer. Negativ ROI för generell tillämpning.

### Kör djävulens-advokat-review NÄR

- **Auth/säkerhetskod** ändrades (`src/lib/*auth*`, `src/app/api/admin/*`, `src/app/api/auth/*`, `middleware.ts`)
- **Schema-ändring** (`prisma/schema.prisma`)
- **Payment-kod** (`src/app/api/**/payment*/**`, `StripePaymentGateway.ts`, `PaymentService.ts`)
- **Dev:s egen review hittade Blocker eller Major** — något djupare kan finnas i samma branch
- **Story klassad som pre-launch-blocker** (från sprint-planen) — extra skepsis motiverad

### Kör INTE djävulens-advokat-review vid

- Docs-only-stories
- Trivial-gating-stories (<15 min, ≤1 fil per `team-workflow.md` Station 4)
- Ren refactoring utan ny logik
- Test-migrering (ingen ny produktionskod)
- Dev:s egen review hittade bara Minors
- Infra-scripts som inte är auth-relaterade

### Istället för full subagent-review

För övriga merge-typer:
1. Läs done-filen
2. Granska `git diff --stat main..<merge-commit>` och sampla 1-2 filer
3. Notera procedurbrott (self-merge, skippade reviews, etc.) utan att starta subagenter
4. Ge tummen upp eller nedåt i text

### Prompt-mall för djävulens-advokat-review

När review ska köras:

> "Post-merge oberoende review av [story-ID], commit `<hash>`. Dev körde redan [lista Dev:s reviewers]. Din uppgift: hitta vad Dev:s reviews missade. Var skeptisk. [Kontext-specifika fokusområden.] Leverera: Blockers/Majors/Minors/Täckning/Gap. Under [ordgräns] ord."

Prompten MÅSTE innehålla "vad missade Dev?" explicit. Utan det blir reviewern parallellt arbete, inte second opinion.

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
