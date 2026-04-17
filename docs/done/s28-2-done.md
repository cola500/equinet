---
title: "S28-2 Done: Offline E2E i standard CI-smoke"
description: "Lade till offline-smoke jobb i CI som kör offline E2E-tester vid varje PR"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Implementation
  - Avvikelser
  - Laerdomar
---

# S28-2 Done: Offline E2E i standard CI-smoke

## Acceptanskriterier

- [x] Offline-smoke kör i CI vid varje PR
- [x] Minst 5 kritiska offline-flöden testas (10 tester: login, dashboard-cache, mutation queue, sync, reconnect, offline banner, pending count, install prompt, route stop, booking)
- [x] CI-tid ökar med max 5 minuter (offline-smoke kör parallellt med andra jobb)
- [x] Branch protection uppdaterad att kräva offline-smoke (inkluderad i quality-gate-passed)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen ny exponering)
- [x] Feature branch, `check:all` grön
- [x] Tester: offline E2E-sviten kör i CI

## Reviews

Kördes: code-reviewer (enda relevante -- CI/infra-ändring, inga API/UI-förändringar)

## Implementation

### Nytt CI-jobb: `offline-smoke`

**Fil:** `.github/workflows/quality-gates.yml`

Lade till `offline-smoke` jobb som:
1. Startar Supabase lokal dev (samma mönster som `e2e-tests`)
2. Exporterar Supabase-nycklar till env
3. Skapar `.env.local` med alla env-variabler + `FEATURE_OFFLINE_MODE=true`
4. Kör Prisma generate + migrate deploy + auth triggers
5. Cachar Playwright browsers (samma cache-nyckel som `e2e-tests`)
6. Bygger PWA: `npm run build:pwa` (production build med webpack + Serwist SW)
7. Kör: `OFFLINE_E2E=true npx playwright test --project=setup --project=offline-chromium`
8. Uploadar Playwright report vid failure
9. Stoppar Supabase

### Uppdatering av quality-gate-passed

`offline-smoke` tillagd i `needs` och resultat-check. Offline-failure blockerar merge.

### Playwright config optimering

**Fil:** `playwright.config.ts`

I CI (`process.env.CI`) skippar webServer-kommandot `npm run build:pwa` (redan byggt i CI-steg) och kör bara `npm run start:pwa`. Lokalt kör den fortfarande `npm run build:pwa && npm run start:pwa`.

## Avvikelser

Inga avvikelser fran planen.

## Laerdomar

1. **Separera build fran serve i CI**: Att bygga PWA:n som ett explicit CI-steg (istallet for inuti Playwright webServer) ger battre felmeddelanden och tydligare build-tider.

2. **FEATURE_OFFLINE_MODE i .env.local**: Maste sattas INNAN `npm run build:pwa` körs, annars inkluderas inte offline-kod i builden. `build:pwa` scriptet satter det via env-prefix, men `.env.local` behovs for start:pwa.
