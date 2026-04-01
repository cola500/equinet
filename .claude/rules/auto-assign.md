---
title: "Auto-assign vid sessionsstart"
description: "Automatisk tilldelning av nasta story nar ingen explicit uppgift ges"
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
| "kor" | Fullstack | `fullstack` eller otaggade |
| "kor ios" | iOS-utvecklare | `ios` |
| "kor review" | Tech lead / review | Granskar review_requested stories |

Om ingen roll anges: default till fullstack.

**EN SESSION AT GANGEN.** Alla sessioner delar samma working directory.
Kor aldrig parallella sessioner -- de krockar pa branches och filer.
Flode: en session -> klar -> review -> nasta session.

## STOPP-REGLER (bryt ALDRIG dessa)

1. **Pusha ALDRIG till main.** Alltid feature branch. Pre-push hook blockerar.
2. **Implementera ALDRIG innan planen ar godkand.** Committa planen, VANTA pa att Johan sager "godkand", borja SEDAN.
3. **Uppdatera ALLTID status.md vid varje commit.**

## Steg

1. Las `docs/sprints/status.md` -- vilka stories ar pending?
2. Las det aktiva sprint-dokumentet (lankat i status.md) -- vad ar detaljerna?
3. Filtrera pa din roll (se Roller-tabellen ovan)
4. Valj nasta matchande story enligt prioritetsordningen i sprint-dokumentet
5. Registrera dig i status.md Sessioner-tabell (roll, branch, story)
6. Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
7. Skriv en kort plan i `docs/plans/<story-id>-plan.md` och committa den
   - Vilka filer andras/skapas
   - Approach (vilka steg, i vilken ordning)
   - Risker eller oklarheter
   - Committa planen FORE implementation sa tech lead kan lasa den
7. Borja arbeta enligt stationsfloden (.claude/rules/team-workflow.md)
8. Nar klar: skriv `docs/done/<story-id>-done.md` med:
   - Acceptanskriterier fran sprint-dokumentet -- bocka av varje
   - Definition of Done (fran CLAUDE.md) -- bocka av varje
   - Avvikelser eller kanda begransningar
   - **Lardomar**: Vad var ovantat? Vad skulle du gora annorlunda? Gotchas for framtida sessioner?
   - Committa filen pa feature branchen
9. Pusha FEATURE BRANCH (aldrig main!)
10. Uppdatera status.md: story -> "review_requested"
11. Tech lead laser done-filen (inkl lardomar), granskar kod, och mergar (station 7)

### Rollspecifika regler

**Fullstack:**
- Verifiering: `npm run check:all`
- Tester: Vitest (BDD dual-loop for API/services)
- Review-agenter: security-reviewer (API), cx-ux-reviewer (UI)

**iOS:**
- Verifiering: `xcodebuild test` (se CLAUDE.md iOS-testflode)
- Folj iOS Native Screen Pattern (se CLAUDE.md)
- Review-agenter: ios-expert, mobile-mcp for visuell verifiering
- Tester: XCTest for ViewModels, visuell verifiering for UI
- VIKTIGT: Verifiera auth-mekanism (Bearer JWT vs session) innan native UI anropar endpoints

**Tech lead / review:**
- Las `git log` och `git diff` for senaste commits
- Las `status.md` for vilka stories som ar in_progress
- Kor code-reviewer agent pa andringarna
- Uppdatera status.md med review-resultat

## Undantag

**Om alla stories for din roll ar klara eller blockerade:**
Rapportera till Johan: "Alla [roll]-stories i [sprint] ar klara/blockerade. Vad vill du prioritera?"

**Om en story redan ar in_progress av en annan session:**
Hoppa over den. Ta nasta pending story. Rask ALDRIG en story fran en aktiv session.

**Om du ar osaker pa scope eller arkitektur:**
Las sprint-dokumentets detaljerade uppgifter. Om det inte racker -- fraga Johan.
