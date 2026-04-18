---
title: "S21-2: Auth pa routing + blockera test-endpoints"
description: "Lagg till auth pa OSRM-proxy, blockera /api/test i prod"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Approach
  - Filer
  - TDD-plan
---

# S21-2: Auth pa /api/routing + blockera test-endpoints

## Approach

### 1. Auth pa /api/routing
- Lagg till `getAuthUser(request)` + 401-guard i routing/route.ts
- Placering: FORE rate limiting (auth ar billigare an rate limit-check)
- Lagg till test for unauthenticated request -> 401

### 2. Blockera /api/test/* i produktion
- Nuvarande guard: `NODE_ENV === 'production'` -- problem: Vercel satter `production` aven pa preview-deploys
- Ny guard: kontrollera `ALLOW_TEST_ENDPOINTS` env-variabel (bara satt i `.env` + CI)
- E2E-tester som anvander reset-rate-limit fortsatter fungera lokalt
- Lagg till test for blocked/allowed scenarios

## Filer

| Fil | Andring |
|-----|---------|
| `src/app/api/routing/route.ts` | Lagg till getAuthUser + 401 |
| `src/app/api/routing/route.test.ts` | Test for 401 |
| `src/app/api/test/reset-rate-limit/route.ts` | Byt NODE_ENV till ALLOW_TEST_ENDPOINTS |
| `src/app/api/test/reset-rate-limit/route.test.ts` | NY: tester for blocked/allowed |

## TDD-plan

1. RED: routing 401-test -> FAIL
2. GREEN: lagg till auth
3. RED: test-endpoint blocked/allowed tester -> FAIL
4. GREEN: byt guard
5. check:all
