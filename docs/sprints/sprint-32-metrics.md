---
title: "Sprint 32: Data & Metrics"
description: "Bygg objektiva mätetal för utvecklingsprocess, agent-effektivitet och kvalitet"
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, metrics, data, dora, agents]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 32: Data & Metrics

## Sprint Overview

**Mål:** Etablera objektiva mätetal så vi kan utvärdera effekten av processförbättringar datadrivet istället för anekdotiskt. Johan är agilist -- mätning är en förstaklassig aktivitet, inte ett appendix.

**Bakgrund:** Vi har infört många effektiviseringar (pattern-katalog, review-gating, worktree-parallellisering, token-reduktion, verifiera-aktualitet-regel) men mäter inte systematiskt om de ger värde. Utvärderingen i S31 baserades på ad-hoc grep:ar i done-filer -- det fungerade som startpunkt men är inte repeterbart.

**Princip:** Mät få saker konsekvent, inte många saker sporadiskt. Goodhart's law: när ett mått blir ett mål slutar det vara ett bra mått. Börja minimalt.

---

## Sessionstilldelning

En session räcker. Story är infra-domän (rör `scripts/`, `package.json`, `docs/metrics/`) -- sekventiell.

---

## Stories

### S32-1: Metrics-rapport-script (baseline)

**Prioritet:** 1
**Effort:** 0.5-1 dag
**Domän:** infra (`scripts/`, `package.json`, `docs/metrics/`)

Bygg ett script som genererar en markdown-rapport med utvecklings- och process-metrics. Rapporten körs manuellt vid sprint-avslut och committas som historik.

**Implementation:**

**Steg 1: Skapa `scripts/generate-metrics.sh`** (eller TypeScript om komplexiteten motiverar det)

Scriptet ska:
- Läsa `git log` för commits, tidstämplar, branch-historik
- Läsa `docs/done/*.md` för story-metadata, subagent-resultat, "redan fixat"-flaggor
- Läsa `docs/retrospectives/*.md` för sprint-perioder
- Output till `docs/metrics/<YYYY-MM-DD>-report.md`

**Steg 2: Implementera 6 baseline-metrics** (minsta uppsättning som ger insikt)

1. **Deployment frequency** -- commits till `main` per vecka senaste 4 veckor
   - Kommando: `git log main --since='4 weeks ago' --pretty=format:"%ci"`
   - Gruppera per ISO-vecka, räkna

2. **Lead time for changes** (median, p90) -- tid från första commit på feature-branch till merge
   - Kommando: `git log --merges --first-parent main --since='8 weeks ago'`
   - Per merge: hitta första commit på den mergede branchen, beräkna tidsdiff
   - Rapportera median + p90 i timmar

3. **"Redan fixat"-rate** -- andel stories där planering visade att problemet redan var löst
   - Grep i `docs/done/*.md` efter "redan fixat|redan åtgärdat|redan implementerat|Skipped"
   - Division med total count done-filer per sprint
   - Mål: <5% (nuvarande ~25%)

4. **Subagent hit-rate** -- hur ofta hittar review-agenter faktiska problem
   - Grep i `docs/done/*.md` efter `blocker|major|minor` i Reviews-sektion
   - Per kategori: count + vilken subagent hittade
   - Svar på: "fångar subagenter verkliga problem eller är de ceremoniella?"

5. **Cykeltid per story** (median) -- första plan-commit till done-commit
   - För varje `s<N>-<M>-plan.md` och `s<N>-<M>-done.md`: hitta commits, beräkna diff
   - Rapportera median per sprint

6. **Test-count trend** -- antal unit-tester per sprint-avslut
   - Kör `grep -r "^\s*\(test\|it\)(" src/ | wc -l` vid sprint-avslut
   - Spara i rapport, trend över tid

**Steg 3: Lägg till npm-script**

```json
"metrics:report": "bash scripts/generate-metrics.sh"
```

**Steg 4: Skapa `docs/metrics/README.md`** med förklaring av varje metric, hur den beräknas, och vad som är "bra/dåligt"-intervall.

**Steg 5: Kör första gången -- etablera baseline**
- `npm run metrics:report`
- Committa `docs/metrics/2026-04-18-baseline.md`
- Detta är nolläget vi mäter framtida förbättringar mot

**Steg 6: Länka från CLAUDE.md snabbreferens**
- Lägg till rad: "Metrics | `docs/metrics/` | aktuell rapport: `latest.md`"

**Acceptanskriterier:**
- [ ] `npm run metrics:report` genererar markdown-rapport utan fel
- [ ] Rapporten innehåller alla 6 baseline-metrics
- [ ] Baseline-rapport för 2026-04-18 committad
- [ ] `docs/metrics/README.md` förklarar varje metric
- [ ] CLAUDE.md länkar till metrics-katalogen
- [ ] `npm run check:all` grön

**Avgränsning / ej i scope:**
- Ingen automatisering via CI (scriptet körs manuellt vid sprint-avslut)
- Ingen dashboard eller visualisering (markdown räcker som start)
- Ingen Vercel/GitHub API-integration (git log + docs räcker för baseline)
- Ingen historik-migrering (vi mäter framåt, inte bakåt -- retros finns för historik)

---

## Framtida stories (skiss, inte scope för S32)

Dessa är kandidater för S33+ om S32-1 ger värde:

- **S32-2:** Vercel deploy-metrics (via Vercel API) -- deployment frequency på deploys istället för merges
- **S32-3:** Change failure rate -- markera commits som "hotfix" eller "revert", beräkna CFR
- **S32-4:** MTTR -- tid mellan "broken"-commit och fix
- **S32-5:** Pattern-katalog-användning (kopplar ihop med S31-6-data efter 10 stories)
- **S32-6:** Metrics-dashboard i `/admin/system` eller separat Vercel-sida

---

## Exekveringsplan

```
S32-1 (0.5-1 dag, metrics-script + baseline)
```

**Total effort:** ~0.5-1 dag.

## Definition of Done (sprintnivå)

- [ ] `npm run metrics:report` fungerar och genererar läsbar rapport
- [ ] Baseline etablerad (2026-04-18-rapport)
- [ ] Dokumentation förklarar varje metric
- [ ] Nästa sprint-avslut kan jämföra mot baseline
