---
title: "Metrics-rapport 2026-04-18"
description: "Automatgenererad rapport med 6 baseline-metrics"
category: operations
status: active
last_updated: 2026-04-18
sections:
  - Deployment Frequency
  - Lead Time for Changes
  - Redan fixat-rate
  - Subagent Hit-rate
  - Cykeltid per Story
  - Test-count Trend
---

# Metrics-rapport 2026-04-18

> Genererad av `npm run metrics:report` — 2026-04-18 11:57:16

---

## M1: Commit Frequency (deploy-proxy)

_Commits till `main` per vecka, senaste 4 veckor. Proxy för deploy-frekvens -- Vercel deployer automatiskt vid push._

- 2026-W13: 29 commits
- 2026-W14: 442 commits
- 2026-W15: 154 commits
- 2026-W16: 173 commits

---

## M2: Lead Time for Changes

_Tid från första commit på feature-branch till merge-commit. Median + p90. Senaste 8 veckor._

- Antal merges analyserade: 206
- Median lead time: 0h
- p90 lead time: 3h

---

## M3: "Redan fixat"-rate

_Andel stories där verifiering visade att problemet redan var löst._

- Totalt done-filer: 132
- "Redan fixat"-filer: 7
- Rate: 5,3% (mål: <5%)

---

## M4: Subagent Hit-rate

_Hur ofta hittar review-agenter faktiska problem (blockers/majors)?_

- Stories med agent-review: 58
- Stories med minst ett fynd (blocker/major): 46
- Hit-rate: 79,3% (hur ofta agenter hittar reella problem)
- Stories med blocker: 28
- Stories med major: 24
- Stories med minor: 22

---

## M5: Cykeltid per Story

_Tid från plan-commit till done-commit. Proxy för "hur lång tar en story?"_

- Antal stories analyserade: 11 av 132 (kräver matchande plan-fil i docs/plans/)
- Median cykeltid: 0h (från plan-commit till done-commit)
- _Notering: 0h = plan och done committade i samma session (korrekt beteende)_

---

## M6: Test-count Trend

_Antal unit-tester idag._

- Vitest (src/): 4098 tester
- XCTest (ios/): 308 tester
- Totalt: 4406 tester

---

_Se `docs/metrics/README.md` för definition av varje metric._
