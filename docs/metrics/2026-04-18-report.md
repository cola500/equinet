---
title: "Metrics-rapport 2026-04-18"
description: "Automatgenererad rapport med 8 baseline-metrics"
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
  - Docs-compliance
  - Modellval-avvikelse
---

# Metrics-rapport 2026-04-18

> Genererad av `npm run metrics:report` — 2026-04-18 21:50:22

---

## M1: Commit Frequency (deploy-proxy)

_Commits till `main` per vecka, senaste 4 veckor. Proxy för deploy-frekvens -- Vercel deployer automatiskt vid push._

- 2026-W13: 29 commits
- 2026-W14: 442 commits
- 2026-W15: 154 commits
- 2026-W16: 252 commits

---

## M2: Lead Time for Changes

_Tid från första commit på feature-branch till merge-commit. Median + p90. Senaste 8 veckor._

- Antal merges analyserade: 223
- Median lead time: 0h
- p90 lead time: 2h

---

## M3: "Redan fixat"-rate

_Andel stories där verifiering visade att problemet redan var löst._

- Totalt done-filer: 150
- "Redan fixat"-filer: 7
- Rate: 4,7% (mål: <5%)

---

## M4: Subagent Hit-rate

_Hur ofta hittar review-agenter faktiska problem (blockers/majors)?_

- Stories med agent-review: 69
- Stories med minst ett fynd (blocker/major): 58
- Hit-rate: 84,1% (hur ofta agenter hittar reella problem)
- Stories med blocker: 36
- Stories med major: 34
- Stories med minor: 28

---

## M5: Cykeltid per Story

_Tid från plan-commit till done-commit. Proxy för "hur lång tar en story?"_

- Antal stories analyserade: 22 av 150 (kräver matchande plan-fil i docs/plans/)
- Median cykeltid: 0h (från plan-commit till done-commit)
- _Notering: 0h = plan och done committade i samma session (korrekt beteende)_

---

## M6: Test-count Trend

_Antal unit-tester idag._

- Vitest (src/): 4173 tester
- XCTest (ios/): 312 tester
- Totalt: 4485 tester

---

## M7: Docs-compliance

_Stories där förväntade docs enligt Docs-matrisen inte uppdaterats. Retroaktiv check via `scripts/check-docs-compliance.sh`._

- Totalt kontrollerade (med Docs-sektion): 56
- Äldre stories utan Docs-sektion (skippad): 94
- Gap identifierade: 12
  - s11-1: typ=schema, förväntat=docs/architecture/database.md, faktisk='Ingen docs-uppdatering'
  - s11-2: typ=schema, förväntat=docs/architecture/database.md, faktisk='Ingen docs-uppdatering'
  - s17-7: typ=schema, förväntat=docs/architecture/database.md, faktisk='Ingen docs-uppdatering'
  - s22-1: typ=ui-feature, förväntat=hjälpartikel+testing-guide, faktisk='Ingen docs-uppdatering'
  - s31-1: typ=security, förväntat=NFR.md eller docs/security/, faktisk='Uppdaterade:' (ingen säkerhetsdoc)
  - s31-3: typ=security, förväntat=NFR.md eller docs/security/, faktisk='Uppdaterade:' (ingen säkerhetsdoc)
  - s32-2: typ=audit, förväntat=docs/retrospectives/, faktisk='Ingen docs-uppdatering'
  - s32-3: typ=audit, förväntat=docs/retrospectives/, faktisk='Ingen docs-uppdatering'
  - s34-3: typ=security, förväntat=NFR.md+docs/security/, faktisk='Ingen docs-uppdatering'
  - s35-1-5: typ=security, förväntat=NFR.md+docs/security/, faktisk='Ingen docs-uppdatering'
  - s35-3: typ=ui-feature, förväntat=hjälpartikel+testing-guide, faktisk='Ingen docs-uppdatering'
  - s37-1: typ=audit, förväntat=docs/retrospectives/, faktisk='Ingen docs-uppdatering'

---

## M8: Modellval-avvikelse

_Stories där modellval avviker från regeln: Opus för arkitekturdesign och säkerhetskritisk cross-cutting implementation, Sonnet/Haiku för övriga._

- Totalt kontrollerade (stories med Modell-fält): 20
- Avvikelser: 2
  - s35-1-5: typ=arkitektur/säkerhetskritisk, förväntat=opus, faktisk=sonnet
  - s35-1: typ=arkitektur/säkerhetskritisk, förväntat=opus, faktisk=sonnet

---

_Se `docs/metrics/README.md` för definition av varje metric._
