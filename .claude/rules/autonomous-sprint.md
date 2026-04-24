---
title: "Autonom sprint-körning"
description: "Hur en Claude-session kör en hel sprint autonomt — förenklat 4-stegsflöde"
category: rule
status: active
last_updated: 2026-04-24
tags: [workflow, autonomous, sprint]
sections:
  - Trigger
  - Flöde per story
  - Kvalitetskrav
  - Kommunikation med Johan
  - Stopp-villkor
  - Sprint-avslut
  - Worktree-agent-mönster
---

# Autonom sprint-körning

## Trigger

Sessionen startas med "kör sprint X" eller "kör sprint X autonomt".
Sessionen kör ALLA stories i sprinten sekventiellt utan att stanna.

---

## Flöde per story

För varje story i `status.md` prioritetsordning:

### 1. Plocka story
- Läs `status.md` — vilken är nästa pending?
- Uppdatera status: story → `in_progress`
- Skapa feature branch: `git checkout -b feature/<story-id>-<beskrivning>`

### 2. TDD (RED → GREEN)
- BDD dual-loop för API-routes och domain services
- Enkel TDD för utilities, hooks, iOS ViewModels
- Kör `npx vitest run <path>` efter varje GREEN-steg
- Skriv ALDRIG implementation utan failande test först

### 3. CHECK
```bash
npm run check:all   # MÅSTE vara 4/4 gröna
```
Kör sedan review baserat på vad storyn ändrade:
- Ny API-route → security-reviewer
- Väsentlig ny logik → code-reviewer
- Trivial fix (<15 min, ≤1 fil, ingen ny logik) → ingen review

Om blocker/major hittas: fixa och kör check:all igen. Max 3 försök, sedan STOPP.

### 4. SHIP

```bash
git push -u origin feature/<story-id>-<namn>
gh pr create --base main --head feature/<story-id>-<namn> \
  --title "S<X>-<Y>: kort beskrivning" \
  --body "## Summary\n- ..."
gh pr merge <PR-nummer> --merge --delete-branch
```

Uppdatera `status.md`: story → `done` + commit-hash.

### 5. Nästa story
Gå till steg 1 med nästa pending story.

---

## Kvalitetskrav

Per story (före merge):
- [ ] Tester skrivna FÖRE implementation (TDD)
- [ ] `npm run check:all` 4/4 gröna
- [ ] Review körd om story kvalificerar (API-route eller >1 timme ny logik)
- [ ] Inga blockers eller majors från subagenter

**Ingen plan-fil krävs. Ingen done-fil krävs. Ingen sessionsfil krävs.**

---

## Kommunikation med Johan

**Fråga Johan vid:**
- Produktbeslut (scope, prioritering, "ska vi bygga X?")
- Nya env-variabler eller konton
- Blockerare som kräver arkitekturbeslut utanför sprint-scope

**Fråga INTE Johan vid:**
- Tekniska val inom sprint-scopet
- Code review (subagenter + check:all räcker)
- Merge-beslut om gates är gröna

---

## Stopp-villkor

STOPPA och meddela Johan om:
- `check:all` failar 3 gånger i rad på samma story
- En subagent hittar blocker som kräver arkitekturbeslut utanför sprint-scope
- En story kräver env-variabler eller konton som inte finns
- Alla stories klara (meddela Johan)

---

## Sprint-avslut

När alla stories är klara:
1. `git status` — rent working tree
2. Meddela Johan: "Sprint X klar."
3. Retro är valfri — skriv om sprinten hade viktiga lärdomar, annars inte.

---

## Worktree-agent-mönster (parallellt arbete)

Huvud-sessionen kan spawna en worktree-agent för stories i annan domän.

```
Agent(
  isolation: "worktree",
  model: "sonnet",
  run_in_background: true,
  prompt: "Kör S<X>-<Y> i Equinet-projektet. Följ 4-stegsflödet: BRANCH → TDD → CHECK → SHIP.
    [story-detaljer]
    REGLER:
    - TDD obligatoriskt (RED → GREEN)
    - npm run check:all måste vara grön
    - security-reviewer om ny API-route
    - Pusha INTE."
)
```

Huvud-sessionen mergar agentens branch efter notifiering. Se `parallel-sessions.md` för domängränser.

### Modellval

| Story-typ | Modell |
|-----------|--------|
| Arkitektur, säkerhet, komplexa beroenden | Opus |
| Mekanisk refactoring, docs, config | Sonnet |
