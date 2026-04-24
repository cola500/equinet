---
title: "Auto-assign vid sessionsstart"
description: "Hur agenter plockar stories och kör dem — förenklat flöde"
category: rule
status: active
last_updated: 2026-04-24
tags: [workflow, team, automation, parallel]
sections:
  - Roller och kommandon
  - STOPP-REGLER
  - Worktree-beslut
  - Domäntaggar
  - Steg
  - Rollspecifika regler
  - Undantag
---

# Auto-assign vid sessionsstart

## Roller och kommandon

| Kommando | Vad händer |
|----------|-----------|
| "kör" | Plockar nästa pending story för sin roll |
| "kör S24-1" | Plockar specifik story |
| "kör sprint 24" | Kör ALLA stories autonomt |
| "kör ios" | Kör som iOS-utvecklare |
| "kör review" | Tech lead / review |

Om ingen roll anges: default till fullstack.

---

## STOPP-REGLER (bryt ALDRIG dessa)

1. **Pusha ALDRIG till main.** Alltid feature branch + PR.
2. **Implementera ALDRIG utan tester.** RED måste komma innan GREEN.
3. **`npm run check:all` MÅSTE vara grön** innan PR skapas.

---

## Worktree-beslut (FÖRE första story)

### Steg 1: Läs status.md Sessioner-tabell

Finns det en ANNAN aktiv session (in_progress)?

### Steg 2: Beslut

**Ingen annan session aktiv:**
- Jobba i huvudrepot (ingen worktree)

**En annan session ÄR aktiv:**
- Läs domäntaggar i sprint-dokumentet
- Välj domän som INTE krockar med den andra sessionen
- Skapa worktree:
  ```bash
  git worktree add ../equinet-<sprint>-<domän> -b feature/<story-id>-<namn> main
  cd ../equinet-<sprint>-<domän>
  npm install
  ```

---

## Domäntaggar

| Domän | Filer | Kan parallelliseras med |
|-------|-------|------------------------|
| `webb` | src/domain/*, src/app/api/*, src/components/* | `ios`, `docs` |
| `ios` | ios/Equinet/* | `webb`, `docs` |
| `docs` | docs/*, .claude/rules/* | `webb`, `ios` |
| `infra` | prisma/*, package.json | INGEN |
| `auth` | src/lib/auth-*, src/app/api/auth/* | INGEN |

---

## Steg

1. Läs `docs/sprints/status.md` — vilka stories är pending?
2. Läs det aktiva sprint-dokumentet — vad är detaljerna?
3. **Worktree-beslut** — ensam eller parallell?
4. Välj nästa matchande story
5. Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
6. Kör storyn enligt 4-stegsflödet (se `team-workflow.md`):
   - TDD: RED → GREEN
   - `npm run check:all`
   - Review om det behövs (ny API-route → security-reviewer, väsentlig logik → code-reviewer)
   - Push → PR → merge
7. Uppdatera `status.md`: story → `done` + commit-hash
8. Gå till nästa pending story

**Ingen plan-fil krävs. Ingen done-fil krävs.**
PR-description är tillräcklig historik.

---

## Rollspecifika regler

**Fullstack:**
- Verifiering: `npm run check:all`
- Tester: Vitest (BDD dual-loop för API/services)
- Review: security-reviewer (API-routes), code-reviewer (väsentlig logik)

**iOS:**
- Verifiering: `xcodebuild test` (se `.claude/rules/ios-learnings.md`)
- Tester: XCTest för ViewModels
- Review: ios-expert vid komplex SwiftUI
- VIKTIGT: Verifiera auth-mekanism (Bearer JWT) innan native UI anropar endpoints

**Tech lead / review:**
- Läs `git diff` + `status.md`
- Kör code-reviewer + security-reviewer vid behov
- Merga via `gh pr merge`
- Uppdatera `status.md` med done + commit-hash

---

## Undantag

**Om alla stories för din domän är klara:**
Rapportera till Johan: "Alla [domän]-stories i [sprint] klara."

**Om en story redan är in_progress:**
Hoppa över. Ta nästa pending.

**Om scope är oklar:**
Fråga Johan. Implementera aldrig utan tydlig förståelse av vad som ska byggas.
