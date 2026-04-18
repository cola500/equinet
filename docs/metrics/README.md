---
title: "Metrics-katalog"
description: "Förklaring av de 6 baseline-metrics som genereras av npm run metrics:report"
category: operations
status: active
last_updated: 2026-04-18
sections:
  - Översikt
  - M1 Deployment Frequency
  - M2 Lead Time for Changes
  - M3 Redan fixat-rate
  - M4 Subagent Hit-rate
  - M5 Cykeltid per Story
  - M6 Test-count Trend
  - Hur du kör rapporten
  - Referens
---

# Metrics-katalog

## Översikt

Equinet mäter 6 metrics vid varje sprint-avslut för att utvärdera processhälsa objektivt. Rapporten genereras manuellt och committas som historik.

```bash
npm run metrics:report
# -> docs/metrics/<YYYY-MM-DD>-report.md
# -> docs/metrics/latest.md
```

---

## M1: Commit Frequency (deploy-proxy)

**Definition:** Antal commits till `main` per ISO-vecka, senaste 4 veckor.

**Varför:** Proxy för DORA Deployment Frequency. Vercel deployer automatiskt vid push till main, så commit-frekvens ≈ deploy-frekvens. Mer exakta deploy-metrics via Vercel API planeras i S32-4.

**Beräkning:**
```bash
git log main --since='4 weeks ago' --pretty=format:"%ci"
# Grupperas per ISO-vecka (YYYY-WNN)
```

**Bra interval:** 5–15 commits/vecka (aktiv utveckling). <3 kan tyda på blockerare eller stor batch-kadens.

---

## M2: Lead Time for Changes

**Definition:** Tid (timmar) från första commit på feature-branch till merge-commit. Median + p90. Senaste 8 veckor.

**Varför:** DORA-metric. Mäter hur snabbt en idé når main. Lång lead time = stor batchstorlek eller review-bottleneck.

**Beräkning:**
```bash
git log --merges --first-parent main --since='8 weeks ago'
# Per merge: äldsta commit på branchen -> merge-timestamp = lead time
```

**Bra interval:** Median <24h för enklare stories. p90 <72h.

**Obs:** 0h median = majoriteten av branches hade en enstaka commit (plan och implementation i samma push). Det är normalt beteende för Equinets korta branches -- inte ett dataproblem.

---

## M3: "Redan fixat"-rate

**Definition:** Andel done-filer där verifieringen visade att problemet redan var löst (ingen kodändring behövdes).

**Varför:** Hög rate = vi plockar stale stories från backloggen. Kostar planerings-overhead utan värde. Mål: <5%.

**Beräkning:**
```bash
grep -rli "redan fixat|redan åtgärdat|Ingen kodändring" docs/done/
# / totalt antal done-filer
```

**Nuläge vid baseline (S29):** ~25% (2 av 8 stories var no-ops i S27+S29).

---

## M4: Subagent Hit-rate

**Definition:** Andel reviews-körda-stories där agenten hittade minst ett blocker eller major.

**Varför:** Mäter om review-agenter ger värde. Låg hit-rate (<20%) = agenter är ceremoniella. Hög rate = agenter fångar reella problem.

**Beräkning:**
```bash
# Stories med minst en agent nämnd i Reviews-sektionen
grep -rli "code-reviewer|security-reviewer|tech-architect" docs/done/
# Jämförs mot stories med "blocker" eller "major" i done-filen
```

**Bra interval:** >40% hit-rate (agenter är verktyg, inte ceremoni).

---

## M5: Cykeltid per Story

**Definition:** Tid (timmar) från plan-commit till done-commit, per story. Median.

**Varför:** Proxy för "hur lång tar en story end-to-end?". Lång cykeltid kan tyda på stora batchar eller blockerare.

**Beräkning:**
```bash
# För varje docs/done/sNN-M-done.md: hitta docs/plans/sNN-M-plan.md
# Plan-commit-timestamp -> done-commit-timestamp = cykeltid
git log --diff-filter=A --follow --pretty=format:"%ct" -- docs/plans/sNN-M-plan.md
```

**Bra interval:** Median <12h för triviala, <24h för normala, <48h för komplexa stories.

**Täckning:** Kräver matchande `docs/plans/sNN-M-plan.md` för varje done-fil. Mäter bara stories från S29+ tills äldre plan-filer läggs till retroaktivt.

---

## M6: Test-count Trend

**Definition:** Antal unit-tester idag (Vitest + XCTest).

**Varför:** Absoluta siffran ger lite, men trenden (sprint-över-sprint) visar om vi bygger upp testskuld eller ökar coverage.

**Beräkning:**
```bash
grep -rE "^\s*(test|it)\(" src/ | wc -l  # Vitest
grep -rE "func test" ios/ | wc -l         # XCTest
```

**Nuläge vid baseline:** ~4090 Vitest + 223 XCTest = ~4313 totalt (2026-04-18).

---

## Hur du kör rapporten

```bash
# Vid sprint-avslut:
npm run metrics:report

# Committa rapporten till main:
git add docs/metrics/
git commit -m "metrics: sprint NN avslut $(date +%Y-%m-%d)"
git push origin main
```

---

## Referens

- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/) -- Deployment Frequency, Lead Time, Change Failure Rate, MTTR
- Framtida metrics: Change Failure Rate (S32-5), MTTR (S32-6), Vercel deploy-metrics (S32-4)
