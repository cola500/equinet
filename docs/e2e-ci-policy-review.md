---
title: E2E CI Policy Review
description: Analys av var E2E körs idag och rekommenderad policy
category: operations
status: current
last_updated: 2026-03-29
sections:
  - Nuläge
  - Bedömning
  - Rekommenderad policy
  - Konkreta ändringar
---

# E2E CI Policy Review

## Nuläge

### Var E2E körs idag

| Plats | Vad som körs | Trigger | Tid |
|-------|-------------|---------|-----|
| **Pre-push hook** (.husky/pre-push) | test:run + typecheck + lint + swedish | Varje push | ~50s |
| **GitHub Actions** (quality-gates.yml) | **Full E2E** (`npm run test:e2e`, 35 specs) | PR till main + push till main | Minuter |
| **GitHub Actions** (quality-gates.yml) | Unit tests + typecheck + lint + build + security audit | PR till main + push till main | ~3-5 min |
| **GitHub Actions** (ios-tests.yml) | Full iOS testsvit | PR/push till main (bara vid ios/** ändringar) | ~5 min |
| **Lokalt manuellt** | smoke/critical/full efter behov | Manuellt | 30s-minuter |

### Observation

**Full E2E (35 specs) körs på varje PR och varje push till main.** Det är samma workflow oavsett om PR:n ändrar en docs-fil eller hela bokningsflödet. E2E-jobbet kräver Postgres, Prisma-push, seed, Playwright-browsers och en dev-server -- tung setup för varje körning.

## Bedömning

**Pre-push hook:** Rimlig. Kör unit + typecheck + lint + swedish (~50s). Ingen E2E. Bra balans.

**CI unit/typecheck/lint/build:** Rimlig. Parallella jobb, snabb feedback. Rätt nivå.

**CI E2E:** **För tungt som default.** Full E2E på varje PR innebär:
- Lång feedback-loop (minuter bara för E2E-jobbet)
- Hög flaky-risk (14 av 35 specs har waitForTimeout)
- Onödigt vid docs-ändringar, refaktorering utan beteendeförändring, iOS-only ändringar
- E2E-jobbet är ofta den långsammaste delen av CI-pipelinen

**iOS CI:** Rimlig. Path-filter (`ios/**`) begränsar till relevanta ändringar.

## Rekommenderad policy

| Nivå | Vad | När | Var |
|------|-----|-----|-----|
| **Alltid** | Unit + typecheck + lint + build | Varje PR och push till main | CI (quality-gates.yml) |
| **Smoke** | exploratory-baseline + auth | Varje PR till main | CI (byt `npm run test:e2e` till `npm run test:e2e:smoke`) |
| **Critical** | booking + payment + provider | PR som ändrar boknings-/betalnings-/leverantörsflöden | CI (manuell trigger eller path-filter) |
| **Full E2E** | Alla 35 specs | Inför release, manuellt vid oklara regressioner | CI (manuell workflow dispatch) |

**Principen:** Smoke är billigt (~30s) och fångar de mest kritiska problemen (app startar, login fungerar). Full E2E är dyrt och bör vara opt-in, inte default.

## Konkreta ändringar

### Steg 1 (lägst risk, högst effekt)

Ändra rad 108 i `.github/workflows/quality-gates.yml`:
```yaml
# Nuvarande:
run: npm run test:e2e

# Ny:
run: npm run test:e2e:smoke
```

Detta byter CI E2E från full svit (35 specs) till smoke (2 specs). Minskar E2E-tiden i CI drastiskt. Alla andra quality gates (unit, typecheck, lint, build) körs fortfarande.

### Steg 2 (senare, valfritt)

Lägg till en separat workflow `e2e-full.yml` med `workflow_dispatch` för manuell full E2E-körning vid behov:
```yaml
on:
  workflow_dispatch:
    inputs:
      suite:
        type: choice
        options: [smoke, critical, full]
```

### Steg 3 (senare, valfritt)

Lägg till path-filter på E2E-jobbet i quality-gates.yml så att det bara körs vid relevanta ändringar:
```yaml
paths:
  - 'src/**'
  - 'e2e/**'
  - 'package.json'
```

Docs-only PR:ar och iOS-only PR:ar behöver inte E2E alls.
