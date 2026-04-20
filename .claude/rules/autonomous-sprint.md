---
title: "Autonom sprint-körning"
description: "Hur en Claude-session kör en hel sprint utan mänsklig inblandning"
category: rule
status: active
last_updated: 2026-04-20
tags: [workflow, autonomous, sprint]
sections:
  - Trigger
  - Flöde per story
  - Kvalitetsgates
  - Review-matris
  - Kommunikation med Johan
  - Stopp-villkor
---

# Autonom sprint-körning

## Trigger

Sessionen startas med "kör sprint X" eller "kör sprint X autonomt".
Sessionen kör ALLA stories i sprinten sekventiellt utan att stanna.

## Flöde per story

För VARJE story i sprint-dokumentets prioritetsordning:

### 1. Plocka story
- Läs `docs/sprints/status.md` -- vilken är nästa pending?
- Uppdatera status: story -> `in_progress`
- Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`

### 2. Planera (station 1)
- Skriv plan i `docs/plans/<story-id>-plan.md`
- Committa planen

### 3. Self-review av plan
- Kör ALLA relevanta subagenter (se Review-matris nedan)
- Om blocker hittas: uppdatera planen och kör review igen
- Om godkänd: fortsätt till implementation

### 4. Implementera (station 2-3: RED -> GREEN)
- TDD: tester FÖRST (RED), sedan implementation (GREEN)
- BDD dual-loop för API routes och domain services
- Kör `npx vitest run <path>` efter varje GREEN-steg

### 5. Self-review av kod (station 4)
- Kör code-reviewer subagent
- Kör relevanta specialistsubagenter (se Review-matris)
- Om blocker/major hittas: fixa och kör review igen
- Dokumentera vilka reviews som kördes

### 6. Verifiera (station 5)
- `npm run check:all` (typecheck + test + lint + swedish)
- ALLA 4 gates MÅSTE vara gröna innan vidare
- Om fail: fixa och kör igen. Max 3 försök, sedan STOPP.
- **Vid infrastruktur/auth-ändringar:** Kör även `npm run test:e2e:smoke` lokalt

### 7. Done-fil + status-uppdatering (SAMMA commit)
- Skriv `docs/done/<story-id>-done.md` med:
  - Acceptanskriterier bockade
  - Definition of Done bockade
  - **Reviews körda** (vilka subagenter)
  - Avvikelser
  - Lärdomar
- **SAMTIDIGT:** Uppdatera `docs/sprints/status.md`: story -> `done` + commit-hash
- **Committa BÅDA filerna i samma commit** (förhindrar drift)

### 8. Merga (Dev äger hela flödet)

```bash
# 1. Pusha feature branch
git push -u origin feature/<story-id>-<namn>

# 2. Byt till main och merga
git checkout main
git pull origin main
git merge feature/<story-id>-<namn> --no-ff -m "Merge feature/<story-id>: kort beskrivning"

# 3. Pusha main
git push origin main

# 4. Rensa branch (OMEDELBART)
git branch -d feature/<story-id>-<namn>
git push origin --delete feature/<story-id>-<namn>
```

**REGLER:**
- Dev mergar SJÄLV -- ingen Lead-merge behövs
- `LEAD_MERGE=1` behövs INTE (branch protection av)
- Feature branch MÅSTE raderas efter merge (lokalt + remote)
- `git pull origin main` FÖRE merge (undvik divergent branches)
- Pusha ALDRIG direkt till main utan feature branch

### 9. Nästa story
- Gå till steg 1 med nästa pending story
- Om alla stories klara: kör sprint-avslut (se nedan)

---

## Kvalitetsgates (OBLIGATORISKA)

### Per story (före merge)

- [ ] Plan skriven och committad
- [ ] Self-review av plan med relevanta subagenter
- [ ] Tester skrivna FÖRE implementation (TDD)
- [ ] `npm run check:all` 4/4 gröna
- [ ] Done-fil med reviews-sektion
- [ ] Inga blockers eller majors från subagenter
- [ ] Vid schema-ändring: `npm run migrate:status` visar inga pending

### Per sprint (vid avslut, före retro)

- [ ] E2E smoke grön: `npm run test:e2e:smoke`
- [ ] Migrationer applicerade på staging: `npm run migrate:status`
- [ ] Metrics-rapport genererad: `npm run metrics:report` (jämför mot föregående för trender, referera i retro)
- [ ] Docs uppdaterade: kör `/update-docs` (README, NFR, CLAUDE.md, gotchas)
- [ ] Inga uncommittade ändringar: `git status` visar rent

---

## Review-matris (vilka subagenter per story-typ)

> Se [review-matrix.md](review-matrix.md) för fullständig glob-baserad matris (maskinläsbar av S47-1 hook).

Kör ALLTID code-reviewer. Övriga subagents bestäms av matristabellen i `review-matrix.md`.

**Täckning + Gap (obligatoriskt för alla reviewers):** Lägg alltid till följande i prompt-texten till code-reviewer och security-reviewer (projekt-agenterna rapporterar detta automatiskt):
> "Avsluta med: **Täckning** (vad du konkret granskade, filnamn/aspekter) och **Gap** (vad du INTE granskade och varför)."

---

## Kommunikation med Johan

### Fråga Johan vid:
- Produktbeslut (scope, prioritering, "ska vi bygga X?")
- Nya env-variabler eller konton (Supabase, Stripe, Apple)
- Arkitekturbeslut som INTE täcks av sprint-planen
- Blockerare från externa system

### Fråga INTE Johan vid:
- Plan-godkännande (self-review med subagenter räcker)
- Code review (subagenter + check:all)
- Merge-beslut (om gates är gröna)
- Tekniska val inom sprint-scopet

---

## Stopp-villkor

STOPPA sprinten och meddela Johan om:
- `check:all` failar 3 gånger i rad på samma story
- En subagent hittar en blocker som kräver arkitekturbeslut utanför sprint-scope
- En story kräver env-variabler eller konton som inte finns
- Något oväntat som påverkar produktionsmiljön
- Alla stories klara (skriv retro, meddela Johan)

---

## Sprint-avslut (OBLIGATORISKT)

När alla stories är klara, kör dessa steg I ORDNING:

### 1. Sprint-gates (kvalitetskontroll)
```bash
npm run test:e2e:smoke          # E2E smoke grön
npm run migrate:status          # Inga pending migrationer
npm run metrics:report          # Uppdatera baseline-rapport, referera i retro
git status                      # Rent working tree
```

### 2. Docs-uppdatering
Kör `/update-docs` med sprint-numret. Kontrollera:
- README.md (testantal, nya features, ändrad stack)
- NFR.md (nya säkerhetskapabiliteter, testantal)
- CLAUDE.md (nya key learnings, ändrade resurslänkar)
- docs/guides/gotchas.md (nya gotchas upptäckta under sprinten)

### 3. Sprint-retro
Skriv `docs/retrospectives/<datum>-sprint-<N>.md` med:
- Levererat (stories, tester, LOC)
- Vad gick bra
- Vad som inte fungerade
- Processändring till nästa sprint

### 4. Meddela Johan
"Sprint X klar. Retro i docs/retrospectives/."

---

## Worktree-agent-mönster (parallellt arbete)

En session kan spawna en worktree-agent för stories i en annan domän. Agenten kör i bakgrunden medan huvudsessionen arbetar.

### Hur det funkar

```
Huvudsession (Opus):
  1. Läser sprint-dokumentet
  2. Spawnar Agent(isolation: "worktree", model: "sonnet", run_in_background: true)
     med de stories som tillhör en annan domän
  3. Kör sina egna stories (stationsflödet som vanligt)
  4. Får notifiering när worktree-agenten är klar
  5. Mergar agentens branch
```

### KRITISKT: Kvalitetsprocessen gäller ALLA stories

Worktree-agenten MÅSTE följa exakt samma stationsflöde som huvudsessionen:

1. **PLAN** -- skriv plan, committa
2. **RED** -- tester först (TDD/BDD)
3. **GREEN** -- minimum implementation
4. **REVIEW** -- kör code-reviewer subagent + relevanta specialistsubagenter (se Review-matris)
5. **VERIFY** -- `npm run check:all` (4/4 gröna)
6. **Committa** done-fil + sessionsfil

**Att köra i en worktree ändrar INGENTING i kvalitetskraven.** Samma TDD, samma reviews, samma quality gates. Skalning utan kvalitet är inte skalning -- det är kaos.

### Worktree-agent prompt-mall

```
Agent(
  description: "S<X>-<Y> + S<X>-<Z> <domän>",
  isolation: "worktree",
  model: "sonnet",
  run_in_background: true,
  prompt: "Du kör i en isolerad worktree i Equinet-projektet.

    Kör dessa stories sekventiellt, VARJE story med full stationsflöde:
    - Plan -> Self-review -> RED -> GREEN -> Code review -> check:all -> done-fil

    **S<X>-<Y>: Beskrivning**
    [story-detaljer]

    **S<X>-<Z>: Beskrivning**
    [story-detaljer]

    REGLER:
    - Följ .claude/rules/team-workflow.md stationsflöde per story
    - Kör code-reviewer subagent efter implementation (station 4)
    - Kör npm run check:all före varje done-fil (station 5)
    - Skriv sessionsfil: docs/sprints/session-<sprint>-<domän>.md
    - Committa allt. Pusha INTE.
    - Rör ALDRIG filer utanför din domän."
)
```

### Sessionsfil (istället för status.md)

Varje session/agent skriver till sin EGEN fil: `docs/sprints/session-<sprint>-<domän>.md`

```markdown
---
sprint: 25
domain: docs
model: sonnet
started: 2026-04-12
---
| Story | Status | Branch | Commit |
|-------|--------|--------|--------|
| S25-3 | done | - | abc123 |
| S25-4 | done | - | def456 |
```

**Skriv ALDRIG till status.md** -- tech lead konsoliderar vid merge/avslut.

### Merge-protokoll

Huvudsessionen mergar agentens branch efter notifiering:

```bash
git merge <agentens-branch> --no-ff -m "Merge worktree-agent: S<X>-<Y> + S<X>-<Z>"
git worktree remove <worktree-path>
git branch -d <agentens-branch>
```

### Domängränser

Se `.claude/rules/parallel-sessions.md` för fullständig guide om vilka domäner som kan parallelliseras och vilka som inte kan.

### Modellval

| Story-typ | Modell | Motivering |
|-----------|--------|------------|
| Arkitektur, säkerhet, komplexa beroenden | Opus | Kräver djup förståelse |
| Mekanisk refactoring, docs, config | Sonnet | Snabbare, billigare, tillräckligt |
| Triviala ändringar | Haiku | Minsta möjliga kostnad |

### Gotchas (S25 erfarenhet)

- **Worktree-agenter kan blockeras av rättigheter.** Write/Edit/Bash kan nekas i worktree-kontext. Om agenten rapporterar rättighetsproblem: gör arbetet själv i huvudsessionen istället.
- **Docs-stories i worktree är tveksamt värde.** Overhead (spawn + merge + cleanup) överstiger ofta tidsvinsten för 30-min docs-stories. Överväg att köra docs-stories direkt i huvudsessionen.
- **Rensa alltid worktree efter avslutat arbete:** `git worktree remove <path>`, `git branch -d <branch>`, `git worktree prune`.
