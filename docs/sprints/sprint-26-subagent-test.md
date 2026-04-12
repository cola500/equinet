---
title: "Sprint 26: Subagent-mönster A/B-test"
description: "Testa tre nivåer av subagent-parallellism med riktiga stories som testbädd"
category: sprint
status: draft
last_updated: 2026-04-12
tags: [sprint, subagent, parallel, experiment]
sections:
  - Sprint Overview
  - Experiment-design
  - Stories
  - Mätning
  - Exekveringsplan
---

# Sprint 26: Subagent-mönster A/B-test

## Sprint Overview

**Mål:** Testa tre nivåer av subagent-parallellism med riktiga backlog-stories. Mät tid, tokens och kvalitet. Avgör vilka mönster som är värda att behålla.

**Bakgrund:** S25 testade worktree-agenter men de blockerades av rättigheter. Nu testar vi enklare mönster som inte kräver worktree -- parallella reviews och research-agenter.

---

## Experiment-design

Varje story testas med en specifik subagent-approach. Vi jämför mot baseline (direkt arbete).

| Nivå | Approach | Risk | Vad vi testar |
|------|----------|------|---------------|
| **Baseline** | Allt direkt, inga subagenter | Ingen | Referenstid |
| **Nivå 1** | Parallella review-agenter | Låg | Snabbare feedback-loop |
| **Nivå 2** | Research-agent före implementation | Låg | Bättre planering |
| **Nivå 3** | Parallell implementation (worktree) | Hög | Kräver rättighetslösning |

**Nivå 3 körs BARA om nivå 1-2 ger värde och rättigheterna kan lösas.** Annars skippar vi den.

---

## Stories

### S26-1: useProviderCustomers.ts refactoring (BASELINE)

**Domän:** webb
**Effort:** 1h
**Approach:** Direkt, inga subagenter. Normal TDD.

useProviderCustomers.ts är 624 rader. Dela till hook + utility-funktioner.

**Acceptanskriterier:**
- [ ] useProviderCustomers.ts under 400 rader
- [ ] Utility-funktioner i separat fil
- [ ] Alla befintliga tester passerar
- [ ] `npm run check:all` grön

**Mätpunkter:** Total tid, antal tool calls.

---

### S26-2: accept-invite affärslogik till AuthService (RESEARCH-AGENT)

**Domän:** webb (auth)
**Effort:** 1h
**Approach:** Nivå 2 -- spawna research-agent först, implementera sedan.

accept-invite route har komplex logik (token-validering, Supabase user creation, atomisk upgrade) direkt i route-filen. Bör ligga i domain service.

**Experiment:**
1. Spawna `Agent(run_in_background: true)` som:
   - Läser accept-invite/route.ts
   - Identifierar all affärslogik som ska flyttas
   - Mappar beroenden (Supabase, Prisma, typer)
   - Föreslår interface för ny AuthService-metod
   - Listar edge cases och testscenarier
2. Medan agenten forskar: börja skriva tester för S26-1 (om S26-1 inte klar) eller planera implementation
3. När agenten rapporterar: använd analysen för TDD-implementation

**Acceptanskriterier:**
- [ ] Affärslogik flyttad till AuthService
- [ ] Route delegerar till service
- [ ] BDD dual-loop tester
- [ ] `npm run check:all` grön

**Mätpunkter:** Total tid, tokens (huvud + agent), kvalitet på agentens analys (använde vi den?).

---

### S26-3: Parallella reviews efter implementation (REVIEW-AGENTER)

**Domän:** webb
**Effort:** 30 min (bara reviews)
**Approach:** Nivå 1 -- efter S26-1 och S26-2, kör alla reviews parallellt.

**Experiment:**
Istället för sekventiella review-anrop, spawna alla relevanta i samma meddelande:

```
Agent("code-reviewer", run_in_background: true, prompt: "Review S26-1 + S26-2...")
Agent("security-reviewer", run_in_background: true, prompt: "Granska auth-ändringarna i S26-2...")
```

Jämför med S24/S25 där reviews kördes sekventiellt.

**Acceptanskriterier:**
- [ ] Minst 2 review-agenter körda parallellt
- [ ] Alla findings addresserade
- [ ] Dokumentera: tid för parallella vs uppskattad sekventiell tid

**Mätpunkter:** Total review-tid, antal findings, tokens per agent.

---

### S26-4: Sprint-retro med experiment-resultat

**Domän:** docs
**Effort:** 15 min
**Roll:** fullstack

Skriv retro med mätdata från S26-1/2/3. Besluta vilka mönster som ska in i standardflödet.

**Acceptanskriterier:**
- [ ] Retro med mätdata per story
- [ ] Beslut: vilka mönster behåller vi?
- [ ] autonomous-sprint.md uppdaterad (om mönster bevisade)

---

## Mätning

### Per story, dokumentera i done-filen:

```markdown
## Experiment-mätning

| Mått | Värde |
|------|-------|
| Total tid (start -> check:all grön) | X min |
| Tokens huvudsession | X |
| Tokens subagenter (totalt) | X |
| Antal subagent-spawns | X |
| Subagent-blockerings-incidenter | X |
| Använde vi subagentens output? | Ja/Nej/Delvis |
| Uppskattad tid UTAN subagent | X min |
```

### Sprint-nivå jämförelse:

| Story | Approach | Tid | Tokens | Subagent-värde |
|-------|----------|-----|--------|----------------|
| S26-1 | Baseline | ? | ? | N/A |
| S26-2 | Research-agent | ? | ? | ? |
| S26-3 | Parallella reviews | ? | ? | ? |

---

## Exekveringsplan

### Steg 1: S26-1 (baseline)
Kör direkt, normal TDD. Mät tid och tokens. Detta är referenspunkten.

### Steg 2: S26-2 (research-agent)
1. Spawna research-agent i bakgrunden
2. Medan den forskar: planera implementation (eller fortsätt S26-1 om inte klar)
3. Använd agentens analys för TDD
4. Mät: var analysen användbar? Sparade den tid?

### Steg 3: S26-3 (parallella reviews)
Efter S26-1 + S26-2 är implementerade:
1. Spawna code-reviewer + security-reviewer parallellt
2. Vänta på båda
3. Åtgärda findings
4. Mät: total review-tid

### Steg 4: S26-4 (retro)
Sammanställ mätdata, skriv retro, besluta.

**Total effort:** ~3h
