---
title: "S28-3: Fix offline E2E rotorsaker"
description: "Ersatt networkidle med domcontentloaded + explicit element-waits i alla offline E2E-tester"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Approach
  - Filer
  - Verifiering
---

# S28-3: Fix offline E2E rotorsaker

## Approach

Baserat pa S28-1 spike: alla 5 failande tester har samma rotorsak -- `waitForLoadState('networkidle')` som aldrig resolverar pga SWR-polling.

**Fix:** Ersatt varje `networkidle` med `domcontentloaded` + explicit element-wait.

## Filer

### e2e/offline-pwa.spec.ts (3 networkidle)

- Rad 71: Bokningssida -- vanta pa body/heading
- Rad 75: Bokningssida -- vanta pa body/heading
- Rad 91: Dashboard -- vanta pa body/heading

### e2e/offline-mutations.spec.ts (3 networkidle)

- Rad 213: Bokningssida -- vanta pa filterknapp eller booking-item
- Rad 294: Ruttsida -- vanta pa ruttnamn
- Rad 352: Bokningssida -- vanta pa filterknapp

## Verifiering

1. `npm run build:pwa`
2. `npm run start:pwa` (port 3001)
3. `OFFLINE_E2E=true npx playwright test --project=offline-chromium` -- 5 korningar, alla grona
4. `npm run check:all`
