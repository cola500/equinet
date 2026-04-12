---
title: "Sprint 25: Parallell worktree-agent test"
description: "Testa nytt arbetssätt: en session spawnar worktree-agent för parallellt arbete"
category: sprint
status: draft
last_updated: 2026-04-12
tags: [sprint, parallel, worktree-agent, test]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 25: Parallell worktree-agent test

## Sprint Overview

**Mål:** Testa att en enda session kan köra webb-stories själv OCH spawna en worktree-agent för docs-stories parallellt. Liten slice -- vi testar arbetssättet, inte levererar max.

**Nytt arbetssätt som testas:**
1. En terminal, ett kommando
2. Huvudsession (Opus) kör webb-stories
3. Spawnar `Agent(isolation: "worktree", model: "sonnet", run_in_background: true)` för docs
4. Sessionsfiler istället för status.md (ingen merge-konflikt)
5. Huvudsession mergar worktree-agentens branch när den är klar

---

## Sessionstilldelning

### Huvudsession (Opus, i repot)
Kör dessa stories själv:
- **S25-1** CustomerCard.tsx extrahera tabs
- **S25-2** PrismaBookingRepository gemensamma selects

### Worktree-agent (Sonnet, spawnas automatiskt)
Spawna med `Agent(isolation: "worktree", model: "sonnet", run_in_background: true)`.
Agenten kör dessa stories:
- **S25-3** Dokumentera worktree-agent-mönster
- **S25-4** Backlog + roadmap cleanup efter S24

**Worktree-agenten SKA INTE röra:** src/components/*, src/infrastructure/*
**Huvudsessionen SKA INTE röra:** docs/*, .claude/rules/*

---

## Stories

### S25-1: CustomerCard.tsx extrahera tabs

**Domän:** webb
**Effort:** 1h
**Roll:** fullstack

CustomerCard.tsx är 660 rader. Extrahera tabs till egna komponenter.

**Acceptanskriterier:**
- [ ] CustomerCard.tsx under 300 rader
- [ ] Tabs i egna komponenter
- [ ] Visuellt identisk
- [ ] `npm run check:all` grön

---

### S25-2: PrismaBookingRepository gemensamma selects

**Domän:** webb
**Effort:** 1h
**Roll:** fullstack

PrismaBookingRepository.ts har 834 rader med 6 select-block som delvis duplicerar. Extrahera gemensamma selects till konstanter.

**Acceptanskriterier:**
- [ ] Duplicerade select-block extraherade till konstanter
- [ ] Alla befintliga tester passerar
- [ ] `npm run check:all` grön

---

### S25-3: Dokumentera worktree-agent-mönster

**Domän:** docs
**Effort:** 30 min
**Roll:** fullstack

Uppdatera `.claude/rules/autonomous-sprint.md` med worktree-agent-mönstret. Lägg till:
- Hur huvudsessionen spawnar en agent med `isolation: "worktree"`
- Sessionsfil per agent (inte status.md)
- Merge-protokoll (huvudsession mergar agentens branch)
- Modellval: Opus för huvudsession, Sonnet för worktree-agent

Basera på den testade mekaniken från sprint 24/25.

**Acceptanskriterier:**
- [ ] autonomous-sprint.md uppdaterad med worktree-agent-sektion
- [ ] Sessionsfil-mönstret dokumenterat
- [ ] Exempel med Agent()-anrop

---

### S25-4: Backlog + roadmap cleanup efter S24

**Domän:** docs
**Effort:** 30 min
**Roll:** fullstack

- Flytta S24-items till Genomfört i backlog.md
- Uppdatera roadmap.md med S24-leveranser (BookingService refactored, hjälpartiklar markdown)
- Ta bort session-test-docs.md (testfil från sprint 25 worktree-test)

**Acceptanskriterier:**
- [ ] Backlog arkiverat S24
- [ ] Roadmap uppdaterad
- [ ] Testfiler borttagna

---

## Exekveringsplan

```
Huvudsession (Opus):
  1. Spawna worktree-agent för S25-3 + S25-4 (bakgrund)
  2. Kör S25-1 (CustomerCard)
  3. Kör S25-2 (PrismaBookingRepository)
  4. Merga worktree-agentens branch
  5. check:all
```

**Total effort:** ~2-3h (1h webb + 1h docs, parallellt)
