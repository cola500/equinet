---
title: "Done: S32-1 Metrics-rapport-script (baseline)"
description: "Script som genererar markdown-rapport med 6 baseline-metrics"
category: plan
status: archived
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Avvikelser
  - Lärdomar
---

# Done: S32-1 Metrics-rapport-script (baseline)

## Acceptanskriterier

- [x] `npm run metrics:report` genererar markdown-rapport utan fel
- [x] Rapporten innehåller alla 6 baseline-metrics (M1-M6)
- [x] Baseline-rapport för 2026-04-18 committad (`docs/metrics/2026-04-18-report.md`)
- [x] `docs/metrics/README.md` förklarar varje metric med definition, beräkning, intervall
- [x] CLAUDE.md snabbreferens länkar till metrics-katalogen
- [x] `npm run check:all` grön -- 4/4

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (bash script, inga injection-risker -- enbart git log + grep)
- [x] Tester skrivna FÖRST, coverage >= 70% -- ej tillämpligt (shell-script utan testramverk)
- [x] Feature branch, `check:all` grön, mergad via PR
- [x] Content matchar kod: docs/metrics/README.md och CLAUDE.md uppdaterade

## Reviews körda

Kördes: code-reviewer

**Resultat:**
- 0 blockers
- 3 majors funna, alla åtgärdade:
  - M5 täckning (6/127 stories) -- lagt till notering om begränsning i rapport + README
  - M1 DORA-etikett missvisande -- bytt till "Commit Frequency (deploy-proxy)"
  - M4 rad-räknare inkonsekvent -- fixat till stories-granularitet via `-l | wc -l`
- 2 minors åtgärdade:
  - M1 sortordning kronologisk (sort -k2)
  - Frontmatter category: plan -> operations i genererade rapporter
- 1 minor dokumenterad (M2 0h för enbranch-merges)
- 3 suggestions noterade men ej implementerade (inom scope för baseline)

## Docs uppdaterade

- `docs/metrics/README.md` (ny -- förklarar alla 6 metrics)
- `docs/metrics/2026-04-18-report.md` (ny -- baseline-rapport)
- `docs/metrics/latest.md` (ny -- kopia av senaste rapporten)
- `CLAUDE.md` (snabbreferenstabellen, ny rad för metrics)
- `package.json` (nytt npm-script: `metrics:report`)

Ej uppdaterade: README.md, NFR.md -- metrics-katalogen är en ops-intern rutin, inget som är synligt för slutanvändare.

## Avvikelser

- Rapporten heter `2026-04-18-report.md` (inte `2026-04-18-baseline.md` som planen sa). Förbättring -- `report` är mer generiskt för löpande körningar.
- M5 täcker enbart 6 av 127 stories (saknar plan-filer för S3-S28). Strukturell begränsning, dokumenterad i rapporten och README.

## Lärdomar

- macOS `awk` saknar `asorti` (GNU awk). Fallback: `sort -k2` direkt i shell-pipeline.
- `grep -c` räknar rader, inte filer -- alltid `grep -l | wc -l` för stories-granularitet.
- Merge-commits med enstaka commit på feature-branchen: `git log main_parent..branch_parent` returnerar tom -- behöver fallback på branch_parent-timestamp.
- Shell-scripts för git-analys är rätt nivå för baseline metrics: inga Node.js-beroenden, snabb körning, macOS-kompatibelt.

## Verktyg använda

- Läste patterns.md vid planering: nej (infra-story, inga domänpatterns tillämpliga)
- Kollade code-map.md för att hitta filer: nej (visste redan: scripts/ + docs/metrics/ + package.json)
- Hittade matchande pattern: nej
