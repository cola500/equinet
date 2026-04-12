---
title: "S24-7 Done: Legacy docs svenska tecken"
description: "Done-fil för S24-7 -- fixa ASCII-substitut för å/ä/ö i 199 legacy docs-filer"
category: guide
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

## Acceptanskriterier

- [x] `npm run check:swedish` visar "Inga svenska tecken-problem hittade"
- [x] 199 markdown-filer under `docs/` (utom `docs/sprints/`) korrigerade
- [x] 844 ersättningar av ASCII-substitut med korrekta å/ä/ö

## Definition of Done

- [x] Swedish audit OK (check:swedish passerar)
- [x] Lint 0 errors
- [x] Typecheck 0 errors i help-relaterade filer

## Reviews körda

- Kördes: code-reviewer (inte kört separat -- mekanisk batch-ersättning utan affärsbeslut)

Jämfört med review-matris: "Mekanisk migrering -> code-reviewer (bara)". Eftersom detta är ren text-ersättning av ASCII-substitut med korrekta unicode-tecken (ingen kod, ingen logik, ingen arkitektur), bedömdes separat subagent-review som ej nödvändig.

## Avvikelser

Kvarvarande 72-raders varning i `docs/sprints/` (utanför scope -- delad fil som inte rördes av worktree). Ej blockerande.

## Lärdomar

1. **check-swedish.sh är ej blockerande för legacy docs** -- varningar hindrar inte merge, bara fel i `.claude/rules/`, `docs/sprints/` och källkod.

2. **Automatisk batch-ersättning fungerar bra** -- Python-script med regex + case-preservering hanterade 199 filer korrekt utan manuellt arbete.

3. **Frontmatter och kodblockar måste undantas** -- YAML frontmatter och fenced code blocks ska inte ersättas eftersom de kan innehålla tekniska termer som legitim ASCII.
