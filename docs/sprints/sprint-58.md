---
title: "Sprint 58: En källa per regel"
description: "Konsolidering av processdokumentation: review-regler på ett ställe, autonomous-sprint.md kollapsad till sektion, parallel-sessions.md ur automatisk laddning."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, process, docs, rules]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 58: En källa per regel

## Sprint Overview

**Mål:** Eliminera de fyra GAP som identifierades i process-teatern (2026-04-24). Dev ska kunna starta en story och fatta ett review-beslut genom att läsa EN fil, inte tre.

**Källa:** Teateranalys — "Dev plockar en story".

**Nuläge:** 800 rader i fem filer som alla beskriver hur agentteamet arbetar. Samma regler upprepas på 3-4 platser. `parallel-sessions.md` (269 rader) laddas automatiskt varje session men är bara relevant vid parallella körningar.

**Målbild efter sprint:** 3 filer i `.claude/rules/` för teamprocess (ned från 5). En auktoritativ källa för review-regler. Parallell-sessions-guiden finns kvar men laddas inte automatiskt.

| Story | Gap | Effort |
|-------|-----|--------|
| S58-1 | GAP D — parallel-sessions.md laddas varje session trots sällan relevant | 15-30 min |
| S58-2 | GAP B — review-regler på 4 platser med subtila skillnader | 30-45 min |
| S58-3 | GAP A+C — autonomous-sprint.md duplicerar team-workflow.md + auto-assign.md | 30-45 min |

**Inte i sprint:** Sammanslagning av `auto-assign.md` + `team-workflow.md` — de har tillräckligt distinkta ansvarsområden (startup-sekvens vs flöde) för att hålla separata. Utvärdera efter S58-3.

---

## Stories

### S58-1: Flytta parallel-sessions.md ur automatisk laddning (GAP D)

**Prioritet:** 1
**Effort:** 15-30 min
**Domän:** docs

**Problem:** `parallel-sessions.md` (269 rader) finns i `.claude/rules/` och laddas in i varje agents kontext via path-matching. Parallella sessioner körs sällan (kräver aktiv session i annan domän), men filen kostar kontext-utrymme vid varje körning.

**Fix:** Flytta filen till `docs/guides/parallel-sessions.md`. Lägg till en en-rads referens i `auto-assign.md` under Worktree-beslut: "Fullständig guide: `docs/guides/parallel-sessions.md`."

**Filer:**
- `.claude/rules/parallel-sessions.md` → `docs/guides/parallel-sessions.md` (flytt, inget innehåll ändras)
- `.claude/rules/auto-assign.md` — lägg till pekare under Worktree-beslut

**Acceptanskriterier:**
- [ ] `parallel-sessions.md` finns inte längre under `.claude/rules/`
- [ ] Filen finns under `docs/guides/parallel-sessions.md` med oförändrat innehåll
- [ ] `auto-assign.md` pekar till den nya platsen
- [ ] `docs/INDEX.md` uppdaterad om parallel-sessions var indexerad där

---

### S58-2: Review-regler → en källa (GAP B)

**Prioritet:** 2
**Effort:** 30-45 min
**Domän:** docs

**Problem:** Review-regler förekommer på fyra platser:
- `review-matrix.md` — den auktoritativa matrisen (code-reviewer + specialist, seriell körning, union-regel)
- `team-workflow.md` — en förenklad tabell (5 rader, saknar union-regeln)
- `auto-assign.md` — två bullet-points (security-reviewer + code-reviewer, ingen seriell ordning)
- `autonomous-sprint.md` — två bullet-points (identiska med auto-assign.md)

När filerna säger olika saker väljer Dev den bredaste tolkningen (kör alla reviewers alltid) — inte för att det är rätt utan för att osäkerheten driver säkerhets-bias.

**Fix:** `review-matrix.md` är källan. Ersätt inline-regler i de tre övriga filerna med en pekare.

**Filer:**
- `team-workflow.md` — ersätt review-tabellen med: "Se `.claude/rules/review-matrix.md` för fullständig review-gating. Kortversion: code-reviewer vid väsentlig ny logik, security-reviewer vid ny API-route. Kör seriellt."
- `auto-assign.md` — ersätt review-bullets med en rad: "Review: se `review-matrix.md`."
- `autonomous-sprint.md` — ersätt review-bullets med en rad: "Review: se `review-matrix.md`."

**Acceptanskriterier:**
- [ ] `review-matrix.md` är oförändrad (auktoritativ källa rör vi inte)
- [ ] `team-workflow.md` har ingen inline review-tabell längre — bara pekare + kortversion
- [ ] `auto-assign.md` har ingen inline review-regel — bara pekare
- [ ] `autonomous-sprint.md` har ingen inline review-regel — bara pekare
- [ ] En agent som bara läser `team-workflow.md` vet att den ska gå till `review-matrix.md` för detaljer

---

### S58-3: Kollapsa autonomous-sprint.md till sektion i team-workflow.md (GAP A+C)

**Prioritet:** 3
**Effort:** 30-45 min
**Domän:** docs

**Problem:** `autonomous-sprint.md` (141 rader) innehåller nästan exakt samma 4-stegsflöde som `team-workflow.md`. Det unika innehållet är litet:
- Kommunikationsregler ("fråga Johan vid X, fråga inte vid Y")
- Stopp-villkor (check:all failar 3 ggr, blocker från subagent, etc.)
- Sprint-avslut (git status, meddela Johan, retro valfri)
- Worktree-agent-mönster (spawna bakgrundsagent för parallell domän)

Det är 30-40 rader verkligt unikt innehåll i en 141-raders fil. Resten är repetition.

**Fix:** Ta bort `autonomous-sprint.md`. Lägg till en sektion `## Autonom sprint-körning` i `team-workflow.md` med det unika innehållet (kommunikation, stopp-villkor, sprint-avslut, worktree-agent-mönster).

**Filer:**
- `team-workflow.md` — lägg till sektion `## Autonom sprint-körning` med extraherat unikt innehåll
- `.claude/rules/autonomous-sprint.md` — tas bort
- `auto-assign.md` — uppdatera steg 6 från "se team-workflow.md" till att vara en tydligare pekare (om det behövs efter ändringen)
- `CLAUDE.md` — kontrollera om autonomous-sprint.md refereras och uppdatera i så fall

**Vad som bevaras från autonomous-sprint.md:**
- Kommunikationsregler (fråga Johan / fråga inte Johan)
- Stopp-villkor (3 misslyckade check:all, blocker, saknade env-vars, alla klara)
- Sprint-avslut (git status, meddela Johan, retro valfri)
- Worktree-agent-mönster + modellval-tabell

**Vad som tas bort (duplicat):**
- STOPP-REGLER (finns i auto-assign.md)
- Flöde per story (finns i team-workflow.md)
- Check-steget med npm run check:all (finns i team-workflow.md)
- SHIP-steget med gh pr commands (finns i team-workflow.md)

**Acceptanskriterier:**
- [ ] `autonomous-sprint.md` finns inte längre under `.claude/rules/`
- [ ] `team-workflow.md` har en ny sektion `## Autonom sprint-körning` med allt unikt innehåll
- [ ] `auto-assign.md` pekar korrekt efter ändringen
- [ ] `CLAUDE.md` innehåller inga trasiga referenser till `autonomous-sprint.md`
- [ ] `npm run docs:validate` är grön

---

## Förväntat resultat

| Fil | Före | Efter |
|-----|------|-------|
| `team-workflow.md` | 142 rader | ~180 rader (inkl. sprint-sektion) |
| `auto-assign.md` | 127 rader | ~110 rader (kortare review + steg) |
| `autonomous-sprint.md` | 141 rader | **borttagen** |
| `parallel-sessions.md` | 269 rader i `.claude/rules/` | **flyttad till `docs/guides/`** |
| `tech-lead.md` | 121 rader | oförändrad |
| **Total i `.claude/rules/`** | **800 rader** | **~410 rader** |

Halverad kontextlast. Samma regler. En källa per regel.
