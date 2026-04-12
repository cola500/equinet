---
title: "Auto-assign vid sessionsstart"
description: "Automatisk tilldelning av stories, med stöd för parallella sessioner och domänfiltrering"
category: rule
status: active
last_updated: 2026-04-12
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
| "kör sprint 24" | Kör ALLA stories för sin domän autonomt |
| "kör ios" | Kör som iOS-utvecklare |
| "kör review" | Tech lead / review |

Om ingen roll anges: default till fullstack.

## STOPP-REGLER (bryt ALDRIG dessa)

1. **Pusha ALDRIG till main.** Alltid feature branch + PR.
2. **Implementera ALDRIG innan planen är godkänd.** Committa planen, kör self-review med relevanta subagenter (se `.claude/rules/autonomous-sprint.md` review-matris). Om inga blockerare: planen är godkänd, kör vidare. Om blockerare: fixa och kör review igen. Fråga Johan BARA vid produktbeslut eller scope-oklarheter.
3. **Uppdatera ALLTID status.md vid varje commit.**

---

## Worktree-beslut (FÖRE första story)

Vid sessionsstart, INNAN du plockar en story:

### Steg 1: Läs status.md Sessioner-tabell

Finns det en ANNAN aktiv session (in_progress)?

### Steg 2: Beslut

**Ingen annan session aktiv:**
- Du är FÖRSTA sessionen
- Jobba i huvudrepot (ingen worktree)
- Registrera dig i Sessioner-tabellen med din domän

**En annan session ÄR aktiv:**
- Du är ANDRA sessionen
- Läs sprint-dokumentets domäntaggar (se nedan)
- Identifiera vilken domän den andra sessionen äger
- Välj en ANNAN domän -- du får BARA ta stories med din domän
- Skapa worktree:
  ```bash
  git worktree add ../equinet-<sprint>-<domän> -b feature/<story-id>-<namn> main
  cd ../equinet-<sprint>-<domän>
  npm install
  ```
- Registrera dig i status.md (från HUVUDREPOT, inte worktree)

### KRITISKT: Startordning

Session 1 MÅSTE ha registrerat sig i status.md INNAN session 2 startar. Om status.md Sessioner-tabell är tom och du inte är ensam -- STOPPA och fråga Johan.

---

## Domäntaggar

Varje story i sprint-dokumentet har en domäntagg i kolumnen "Roll" eller "Domän":

| Domän | Filer som berörs | Kan parallelliseras med |
|-------|-----------------|------------------------|
| `webb` | src/domain/*, src/app/api/*, src/components/*, e2e/* | `ios`, `docs` |
| `ios` | ios/Equinet/* | `webb`, `docs` |
| `docs` | docs/*, .claude/rules/*, CLAUDE.md, src/lib/help/* | `webb`, `ios` |
| `infra` | prisma/*, package.json, scripts/*, .github/* | INGEN (alltid sekventiell) |
| `auth` | src/lib/auth-*, src/app/api/auth/* | INGEN (säkerhetskritiskt) |

**Hur du hittar din domän:**
1. Läs sprint-dokumentet -- varje story har domäntagg
2. Läs status.md -- vilken domän äger den andra sessionen?
3. Ta stories med en domän som INTE krockar (se tabellen ovan)

**Om en story har domän `infra` eller `auth`:** Den kan INTE köras parallellt. Bara session 1 (huvudrepo) tar den, efter att parallella stories är klara.

---

## Steg

1. Läs `docs/sprints/status.md` -- vilka stories är pending?
2. Läs det aktiva sprint-dokumentet (länkat i status.md) -- vad är detaljerna?
3. **Worktree-beslut** (se ovan) -- ensam eller parallell?
4. Välj nästa matchande story:
   - **Ensam session:** ta nästa pending story (oavsett domän)
   - **Parallell session:** ta nästa pending story som matchar DIN domän. Hoppa över alla stories med annan domän.
5. Registrera dig i status.md Sessioner-tabell (roll, domän, branch, story)
6. Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
7. Skriv en kort plan i `docs/plans/<story-id>-plan.md` och committa den
   - Vilka filer ändras/skapas
   - Approach (vilka steg, i vilken ordning)
   - Risker eller oklarheter
   - Committa planen FÖRE implementation så tech lead kan läsa den
8. Börja arbeta enligt stationsflödet (.claude/rules/team-workflow.md)
9. När klar: skriv `docs/done/<story-id>-done.md` med:
   - Acceptanskriterier från sprint-dokumentet -- bocka av varje
   - Definition of Done (från CLAUDE.md) -- bocka av varje
   - **Reviews körda** (OBLIGATORISKT -- lista varje):
     - [ ] code-reviewer (station 4, alltid)
     - [ ] security-reviewer (om API/auth ändrats)
     - [ ] cx-ux-reviewer (om UI ändrats)
     - [ ] tech-architect (om arkitektur/plan granskats)
     - Skriv: "Kördes: code-reviewer, security-reviewer" eller "Kördes: code-reviewer (enda relevante)"
   - Avvikelser eller kända begränsningar
   - **Lärdomar**: Vad var oväntat? Vad skulle du göra annorlunda? Gotchas för framtida sessioner?
   - **SAMTIDIGT:** Uppdatera status.md: story -> `done` + commit-hash
   - Committa BÅDA filerna i samma commit
10. Merge via PR:
    ```bash
    git push -u origin feature/<story-id>-<namn>
    gh pr create --base main --head feature/<story-id>-<namn> \
      --title "S<X>-<Y>: kort beskrivning" \
      --body "## Summary\n- ..."
    gh pr merge <PR-nummer> --merge --delete-branch
    ```
11. Gå till nästa pending story i din domän (steg 4)
12. **Om alla stories i din domän är klara:**
    - Meddela Johan: "Alla [domän]-stories klara."
    - **Om du jobbar i worktree:** rensa efter dig:
      ```bash
      cd ~/Development/equinet
      git worktree remove ../equinet-<sprint>-<domän>
      ```

### Rollspecifika regler

**Fullstack:**
- Verifiering: `npm run check:all`
- Tester: Vitest (BDD dual-loop för API/services)
- Review-agenter: security-reviewer (API), cx-ux-reviewer (UI)

**iOS:**
- Verifiering: `xcodebuild test` (se `.claude/rules/ios-learnings.md`)
- Följ iOS Native Screen Pattern (se CLAUDE.md)
- Review-agenter: ios-expert, mobile-mcp för visuell verifiering
- Tester: XCTest för ViewModels, visuell verifiering för UI
- VIKTIGT: Verifiera auth-mekanism (Bearer JWT vs session) innan native UI anropar endpoints

**Tech lead / review:**
- Läs `git log` och `git diff` för senaste commits
- Läs `status.md` för vilka stories som är in_progress
- Kör code-reviewer agent på ändringarna
- Uppdatera status.md med review-resultat

## Undantag

**Om alla stories för din roll/domän är klara eller blockerade:**
Rapportera till Johan: "Alla [roll/domän]-stories i [sprint] är klara/blockerade. Vad vill du prioritera?"

**Om en story redan är in_progress av en annan session:**
Hoppa över den. Ta nästa pending story i din domän. Raska ALDRIG en story från en aktiv session.

**Om du är osäker på scope eller arkitektur:**
Läs sprint-dokumentets detaljerade uppgifter. Om det inte räcker -- fråga Johan.
