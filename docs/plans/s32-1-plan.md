---
title: "S32-1: Metrics-rapport-script (baseline)"
description: "Plan för att bygga ett script som genererar en markdown-rapport med 6 baseline-metrics"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - User Story
  - Verifiering av aktualitet
  - Filer som skapas/ändras
  - Approach
  - Risker
---

# S32-1: Metrics-rapport-script (baseline)

## User Story

Som tech lead vill jag köra `npm run metrics:report` för att få en markdown-rapport med 6 key metrics, så att jag kan utvärdera processfölbättringar datadrivet.

## Aktualitet verifierad

**Kommandon körda:**
- `ls scripts/generate-metrics.sh` -> File not found
- `ls docs/metrics/` -> No such file or directory

**Resultat:** `docs/metrics/`-katalogen och `scripts/generate-metrics.sh` existerar inte. Inget är implementerat.

**Beslut:** Fortsätt

## Filer som skapas/ändras

| Fil | Åtgärd | Kommentar |
|-----|--------|-----------|
| `scripts/generate-metrics.sh` | Skapas | Huvud-scriptet |
| `docs/metrics/README.md` | Skapas | Förklarar varje metric |
| `docs/metrics/2026-04-18-baseline.md` | Skapas (vid körning) | Baseline-rapport, genereras av scriptet |
| `package.json` | Ändras | Lägg till `metrics:report`-script |
| `CLAUDE.md` | Ändras | Lägg till rad i snabbreferenstabellen |

## Approach

### Steg 1: Bygg `scripts/generate-metrics.sh`

Shell-script (bash) -- motivering: all data finns tillgänglig via git log + grep + wc, ingen Node.js-modul behövs. Scriptet:

1. Kontrollerar att det körs från repots rot
2. Skapar `docs/metrics/`-katalogen om den inte finns
3. Beräknar 6 metrics (se nedan)
4. Skriver output till `docs/metrics/<YYYY-MM-DD>-report.md`
5. Skriver också till `docs/metrics/latest.md` (symlink eller kopia -- kopia är enklare för git)

### De 6 metrics

**M1: Deployment frequency**
```bash
git log main --since='4 weeks ago' --pretty=format:"%ci" \
  | awk '{print substr($1,1,7)}' | sort | uniq -c  # per vecka
```
Visar: commits/vecka de senaste 4 veckorna (ISO-veckoformat).

**M2: Lead time for changes (median + p90)**
```bash
git log --merges --first-parent main --since='8 weeks ago' \
  --pretty=format:"%H %ci"
```
Per merge-commit: hitta den äldsta commiten på den mergade branchen (`git log --no-walk --parents <merge-sha>`), beräkna timediff i timmar. Rapportera median + p90 via `sort -n | awk`.

**M3: "Redan fixat"-rate**
```bash
grep -ril "redan fixat\|redan åtgärdat\|redan implementerat\|Skipped\|no-op" \
  docs/done/*.md | wc -l
```
Division med totalt antal done-filer. Mål: <5%.

**M4: Subagent hit-rate**
```bash
grep -i "blocker\|major\|minor" docs/done/*.md | grep -i "reviews körda\|review"
```
Per kategori (blocker/major/minor): count. Svar på: "är reviews ceremoniella?"

**M5: Cykeltid per story (median)**
```bash
# Hitta plan-commit och done-commit per story
git log --all --pretty=format:"%H %ci %s" | grep -E "plan|done" docs/done/
```
Praktisk approach: för varje done-fil, hitta commit-timestamp för plan-filen och done-filen, beräkna diff.

**M6: Test-count trend**
```bash
grep -r "^\s*\(test\|it\)(" src/ | wc -l
# + awk-alternativ för TypeScript-tester
```

### Steg 2: `docs/metrics/README.md`

Beskriver varje metric: definition, beräkningsmetod, bra/dåligt-intervall, DORA-referens.

### Steg 3: `package.json`

```json
"metrics:report": "bash scripts/generate-metrics.sh"
```

### Steg 4: Kör och committa baseline

```bash
npm run metrics:report
# -> docs/metrics/2026-04-18-baseline.md
# -> docs/metrics/latest.md
```

### Steg 5: Uppdatera CLAUDE.md

Lägg till rad i snabbreferenstabellen:
```
| Metrics | docs/metrics/ | aktuell rapport: latest.md |
```

## Review-plan

Story är `infra` (scripts + docs). Enligt review-matris: `code-reviewer` (alltid). Inga andra subagenter (ingen API-yta, inget UI).

Station 4 review: code-reviewer agent efter implementation.

## Risker

| Risk | Sannolikhet | Mitigation |
|------|-------------|------------|
| Lead time-beräkning komplex med merge-commits | Medel | Börja enkelt: enbart merges de senaste 8v, skippa p90 om det inte funkar |
| `git log`-format varierar | Låg | Testa varje kommando manuellt och verifiera output |
| Cykeltid-script kräver korsreferens git <-> filsystem | Medel | Fallback: skippa M5 om för komplex, notera i README |
| Baseline-rapport genereras men är tom/felaktig | Låg | Verifiera output manuellt innan commit |
