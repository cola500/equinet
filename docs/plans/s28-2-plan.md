---
title: "S28-2 Plan: Offline E2E i standard CI-smoke"
description: "Lägg till offline-smoke CI-jobb som kör offline E2E-tester vid varje PR"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Bakgrund
  - Approach
  - Implementation
  - Risker
---

# S28-2 Plan: Offline E2E i standard CI-smoke

## Bakgrund

Offline E2E kräver idag `OFFLINE_E2E=true` + prod build (`npm run build:pwa`) på port 3001. Det betyder att Serwist-uppgraderingar och offline-regressioner inte fångas automatiskt i CI.

## Approach

Lägg till ett nytt `offline-smoke` jobb i `.github/workflows/quality-gates.yml` som:
1. Startar Supabase lokal dev (samma som `e2e-tests`)
2. Bygger prod-build med `npm run build:pwa` (webpack + Serwist SW)
3. Kör `npm run test:e2e:offline` (10 offline-tester mot port 3001)
4. Inkluderas i `quality-gate-passed` som obligatoriskt jobb

## Implementation

### Fil: `.github/workflows/quality-gates.yml`

Nytt jobb `offline-smoke` som liknar `e2e-tests` men med skillnader:
- Använder `npm run build:pwa` (prod build med webpack) istället för `npm run dev`
- Sätter `OFFLINE_E2E=true` så playwright.config.ts aktiverar `offline-chromium` projekt
- Startar prod-servern med `npm run start:pwa` (port 3001)
- Dev-servern (port 3000) behövs också för setup-projektet (seed data)
- Cachar Playwright browsers (delar cache med `e2e-tests`)

### Steg i jobbet

1. Checkout + Node.js + npm ci
2. Supabase start + exportera nycklar + .env.local
3. Prisma generate + migrate deploy + auth triggers
4. Cache + install Playwright browsers
5. Build PWA: `npm run build:pwa`
6. Starta dev-server (port 3000, för setup/seed)
7. Starta PWA-server (port 3001, för offline-tester)
8. Kör: `OFFLINE_E2E=true npx playwright test --project=setup --project=offline-chromium`
9. Upload artifacts vid failure
10. Stoppa Supabase

### Uppdatera quality-gate-passed

Lägg till `offline-smoke` i `needs` och en ny resultat-check.

## Risker

- **CI-tid**: Prod build tar ~2-3 min, offline-tester ~1-2 min. Totalt max 5 min extra. Jobbet kör parallellt med andra jobb.
- **Supabase start**: Tar ~30s i CI. Redan beprövat i `e2e-tests` och `migration-from-scratch`.
- **Port-konflikt**: Dev-server (3000) + PWA-server (3001). Playwright config hanterar redan detta med `reuseExistingServer`.
