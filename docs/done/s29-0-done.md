---
title: "S29-0 Done: Review-gating"
description: "Tydliga kriterier för när subagent-review kan skippas (triviala stories)"
category: retro
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Docs uppdaterade
  - Lärdomar
---

# S29-0 Done: Review-gating

## Acceptanskriterier

- [x] Review-gating-sektion i `team-workflow.md` Station 4 med 6 kriterier för "trivial"
- [x] `auto-assign.md` done-fil-checklista uppdaterad -- "Kördes: ingen (trivial)" tillåten
- [x] Dokumenterat i `patterns.md` under Processer
- [x] Tydliga kriterier så sessioner inte behöver gissa

## Definition of Done

- [x] Inga TypeScript-fel (rule-docs, ingen kod)
- [x] Säker (ingen kodändring)
- [x] Feature branch + PR enligt commit-strategin (rör `.claude/rules/**`)
- [x] `check:all` grön

## Reviews

Kördes: ingen (trivial -- rule-dokumentation, ingen kodändring, ingen ny logik, tydliga kriterier meta-dokumenterade).

## Docs uppdaterade

- `.claude/rules/team-workflow.md` (Station 4 ny Review-gating-sektion)
- `.claude/rules/auto-assign.md` (done-fil-checklistan)
- `docs/architecture/patterns.md` (Processer-sektionen)
- `docs/sprints/sprint-29-ios-polish.md` (S29-0 tillagd först)

## Lärdomar

- **Dogfooding funkar**: första tillämpningen av review-gating var denna story själv -- och den kvalificerade som trivial. Metakonsistens.
- **Kriteriet "effort <15 min" ÄR subjektivt**. Alternativet (diff-rader, filantal) är objektivare men mindre praktiskt eftersom 5 raders säkerhetsändring fortfarande kräver review. "Effort" tvingar sessionen att tänka igenom vad ändringen faktiskt gör.
- **Trivial-listan kommer växa**. När nya mönster upptäcks (t.ex. "byt paketversion patch") lägg till exempel i team-workflow.md så sessioner lär sig över tid.
