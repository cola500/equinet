---
title: "Auto-assign vid sessionsstart"
description: "Automatisk tilldelning av nästa story när ingen explicit uppgift ges"
category: rule
status: active
last_updated: 2026-04-01
tags: [workflow, team, automation]
sections:
  - Roller och kommandon
  - Steg
  - Undantag
---

# Auto-assign vid sessionsstart

## Roller och kommandon

Sessioner startas med ett kort kommando som anger roll:

| Kommando | Roll | Plockar stories taggade |
|----------|------|------------------------|
| "kör" | Fullstack | `fullstack` eller otaggade |
| "kör ios" | iOS-utvecklare | `ios` |
| "kör review" | Tech lead / review | Granskar review_requested stories |

Om ingen roll anges: default till fullstack.

**EN SESSION ÅT GÅNGEN.** Alla sessioner delar samma working directory.
Kör aldrig parallella sessioner -- de krockar på branches och filer.
Flöde: en session -> klar -> review -> nästa session.

## STOPP-REGLER (bryt ALDRIG dessa)

1. **Pusha ALDRIG till main.** Alltid feature branch. Pre-push hook blockerar.
2. **Implementera ALDRIG innan planen är godkänd.** Committa planen, säga till Johan att planen är redo, och STOPPA. Gör INGENTING mer förrän Johan säger "godkänd". Ingen research, ingen kod, inget Supabase-anrop. VÄNTA.
3. **Uppdatera ALLTID status.md vid varje commit.**

## Steg

1. Läs `docs/sprints/status.md` -- vilka stories är pending?
2. Läs det aktiva sprint-dokumentet (länkat i status.md) -- vad är detaljerna?
3. Filtrera på din roll (se Roller-tabellen ovan)
4. Välj nästa matchande story enligt prioritetsordningen i sprint-dokumentet
5. Registrera dig i status.md Sessioner-tabell (roll, branch, story)
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
   - Avvikelser eller kända begränsningar
   - **Lärdomar**: Vad var oväntat? Vad skulle du göra annorlunda? Gotchas för framtida sessioner?
   - Committa filen på feature branchen
10. Pusha FEATURE BRANCH (aldrig main!)
11. Uppdatera status.md: story -> "review_requested"
12. Tech lead läser done-filen (inkl lärdomar), granskar kod, och mergar (station 7)

### Rollspecifika regler

**Fullstack:**
- Verifiering: `npm run check:all`
- Tester: Vitest (BDD dual-loop för API/services)
- Review-agenter: security-reviewer (API), cx-ux-reviewer (UI)

**iOS:**
- Verifiering: `xcodebuild test` (se CLAUDE.md iOS-testflöde)
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

**Om alla stories för din roll är klara eller blockerade:**
Rapportera till Johan: "Alla [roll]-stories i [sprint] är klara/blockerade. Vad vill du prioritera?"

**Om en story redan är in_progress av en annan session:**
Hoppa över den. Ta nästa pending story. Rask ALDRIG en story från en aktiv session.

**Om du är osäker på scope eller arkitektur:**
Läs sprint-dokumentets detaljerade uppgifter. Om det inte räcker -- fråga Johan.
