---
title: "S36-1 Done: Metacognition-rapportering i review-subagenter"
description: "Täckning + Gap-sektioner tillagda i alla review-agenter"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Avvikelser
  - Lärdomar
---

# S36-1 Done: "Vad jag INTE kollade"-rapportering i review-subagenter

## Acceptanskriterier

- [x] Alla 4 subagent-definitioner uppdaterade med Täckning + Gap-sektioner i output
  - `tech-architect.md`: Täckning + Gap tillagda som egna Output-sektioner
  - `cx-ux-reviewer.md`: Täckning + Gap tillagda efter Accessibility Notes
  - `ios-expert.md`: Täckning + Gap tillagda i Output-sektionen
  - `code-reviewer` + `security-reviewer`: plugin-hanterade (se Avvikelser) -- täcks via anropsinstruktion i `autonomous-sprint.md`
- [x] Prompt-texten nämner explicit "rapportera även vad du INTE kollade och varför"
- [x] `npm run check:all` grön (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker -- N/A (docs-only)
- [x] Tester -- N/A (docs-only)
- [x] Feature branch, `check:all` grön

## Reviews körda

Kördes: ingen (trivial story -- mekanisk textändring i .claude/agents/, <30 min, check:all grön)

## Docs uppdaterade

Uppdaterade:
- `.claude/agents/tech-architect.md` (Täckning + Gap i Output Format)
- `.claude/agents/cx-ux-reviewer.md` (Täckning + Gap efter Accessibility Notes)
- `.claude/agents/ios-expert.md` (Täckning + Gap i Output-sektionen)
- `.claude/rules/autonomous-sprint.md` (anropsinstruktion för code-reviewer/security-reviewer)

## Verktyg använda

- Läste patterns.md vid planering: N/A (trivial)
- Kollade code-map.md för att hitta filer: nej (hittade via `ls .claude/agents/`)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A -- ingen tidigare arkitekturdesign för denna story.

## Modell

`sonnet`

## Avvikelser

`code-reviewer` och `security-reviewer` är plugin-hanterade (från superpowers-plugin i `~/.claude/plugins/cache/`). Enligt feedback-minne ska projektfiler aldrig skapas med samma namn som inbyggda agenter. Täckning + Gap säkerställs istället via ett tilllägg i `autonomous-sprint.md` Review-matris som instruerar anroparen att alltid lägga till Täckning + Gap-instruktionen i prompten.

Effekten är densamma: alla 4 reviewers producerar Täckning + Gap-sektioner -- men mekanismen skiljer sig (inbyggd i prompt vs. anroparinstruktion).

## Lärdomar

Plugin-agenter kan inte modifieras på projektnivå utan att krocka med plugin-systemet. Lösningen -- lägga instruktionen i anropssteget istället -- är faktiskt mer robust: den funkar även om plugin-agenternas definition ändras av plugin-uppdatering. Bra pattern att minnas för framtida subagent-modifieringar.
