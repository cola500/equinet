---
title: "S23-8 Done: CLAUDE.md under 260 + CC-optimeringar"
description: "Komprimerade CLAUDE.md fran 571 till 257, brot ut offline/RLS-learnings"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
---

# S23-8 Done: CLAUDE.md komprimering

## Acceptanskriterier

- [x] CLAUDE.md under 260 rader (257, fran 571 = -55%)
- [x] Alla utbrutna learnings i scoped rules med paths:
  - `ios-learnings.md` (paths: ios/**)
  - `offline-learnings.md` (paths: src/lib/offline/*)
  - `rls-learnings.md` (paths: src/__tests__/rls/*, src/lib/supabase/*)
- [x] `CLAUDE.local.md` i `.gitignore`
- [x] Inga learnings forlorade (alla flyttade till scoped rules)

## Vad som gjordes

1. Offline & Sync-learnings (16 bullets) -> offline-learnings.md
2. RLS & Supabase-learnings (6 bullets) -> rls-learnings.md
3. Webb-testflode komprimerat (63 rader -> 4 rader + referens till testing.md)
4. Testing BDD-sektion komprimerad (40 rader -> 6 rader + referens)
5. Duplicate DoD-sektion borttagen
6. Snabbreferens halverad (22 -> 10 rader)
7. Arkitektur-sektion komprimerad (30 -> 5 rader)
8. Playbook komprimerad (60 -> 8 rader + referens)
9. Quality Gates komprimerad (20 -> 5 rader)

## Definition of Done

- [x] Inga kodandringar
- [x] .gitignore uppdaterad

## Reviews

- Kordes: inga subagenter (dokumentationsrefaktorering)
