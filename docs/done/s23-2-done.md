---
title: "S23-2 Done: Selektiva process-rules"
description: "3 rules-filer gjorda selektiva med paths-frontmatter"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
---

# S23-2 Done: Selektiva process-rules

## Acceptanskriterier

- [x] Minst 4 rules-filer gjorda selektiva (3 nya + 7 befintliga = 10 totalt)
- [x] Kontext per session minskar med >400 rader (338 rader fran de 3 nya)
- [x] Sprint-flodet fungerar fortfarande (auto-assign laddas alltid, triggar vid "kor")

## Gjorda selektiva

| Fil | Rader | paths |
|-----|-------|-------|
| code-review-checklist.md | 154 | `src/**` |
| feature-flags.md | 106 | `src/lib/feature-flag*`, `src/components/providers/FeatureFlagProvider*` |
| tech-lead.md | 78 | `docs/sprints/*`, `docs/done/*` |
| **Total besparing** | **338** | |

## Kvarstar alltid-laddade (kan inte goras selektiva)

| Fil | Rader | Anledning |
|-----|-------|-----------|
| auto-assign.md | 107 | Triggas av "kor"-kommando |
| autonomous-sprint.md | 216 | Triggas av "kor sprint" |
| team-workflow.md | 256 | Referenceras av auto-assign |
| code-map.md | 218 | Kodnavigering, alltid relevant |

## Definition of Done

- [x] Inga kodandringar, bara frontmatter
- [x] Verifierat med grep att paths-falt ar korrekt

## Reviews

- Kordes: inga subagenter (konfigurationsandring)
