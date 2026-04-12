---
title: "S23-1 Done: Spike tokenforbrukning"
description: "Kontext-audit med rekommendationer for att minska tokens per session"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
---

# S23-1 Done: Spike tokenforbrukning

## Acceptanskriterier

- [x] Rapport: varje fil med "behal / gor selektiv / komprimera / ta bort" (se s23-1-token-spike-rapport.md)
- [x] Beraknat: 538 rader sparas konservativt, 718 med konsolidering (1913 -> 1375 eller 1195)
- [x] Plan for S23-2 baserad pa fynden: 5 atgarder i prioritetsordning

## Definition of Done

- [x] Rapport skriven och committad
- [x] Ingen kodandring (spike)

## Reviews

- Kordes: inga subagenter (research/analys, inte implementation)

## Nyckelfynd

1. **5 process-rules kan inte goras selektiva** (auto-assign, autonomous-sprint, team-workflow) -- de triggas av chat-kommandon, inte paths
2. **3 process-rules KAN goras selektiva** (code-review-checklist, feature-flags, tech-lead) -- 338 rader
3. **iOS-learnings i CLAUDE.md** ar storsta enskilda besparingen (120 rader)
4. **MEMORY.md sessionshistorik** ar stale och kan tas bort (50 rader)
5. **Testing-sektion i CLAUDE.md** duplicerar testing.md (30 rader)
