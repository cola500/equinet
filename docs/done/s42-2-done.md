---
title: "S42-2 Done: Webb E2E external-tier"
description: "External-tier körningsförsök -- blockerande setup-problem identifierat"
category: sprint
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Fynd (blockerare)
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Lärdomar
---

# S42-2 Done: Webb E2E external-tier

## Acceptanskriterier

- [x] `test:e2e:external` körd (resulterade i "No tests found" -- se Fynd)
- [x] `OFFLINE_E2E=true npm run test:e2e:offline` försökt
- [ ] HTML-rapport i `docs/metrics/e2e-visual/2026-04-19/external/` -- INTE producerad (tests körde ej)
- [x] Offline-specs körda mot prod-build -- BLOCKERAT (se Fynd)

## Fynd (blockerare)

### Blocker 1: `test:e2e:external` returnerar "No tests found"

**Symptom:** `npm run test:e2e:external` ("playwright test e2e/customer-insights.spec.ts e2e/offline-mutations.spec.ts e2e/offline-pwa.spec.ts") ger "No tests found".

**Rotorsak:** playwright.config.ts har `testIgnore: [/offline-.*\.spec\.ts/, /customer-insights\.spec\.ts/]` i BÅDA chromium- och mobile-projekten. Det finns inget projekt som inkluderar dessa specs utan OFFLINE_E2E=true.

**Konsekvens:** Commando `test:e2e:external` fungerar ALDRIG utan OFFLINE_E2E=true. `customer-insights.spec.ts` är inte inkluderad i NÅGOT projekt (inte ens offline-chromium som matchär `/offline-.*\.spec\.ts/`). Denna spec körs ALDRIG automatiskt.

**Åtgärd (S43):** Lägg till ett `external-chromium`-projekt i playwright.config.ts som inkluderar customer-insights.spec.ts. Eller fixe `test:e2e:external`-scriptet.

### Blocker 2: Supabase DB-reset bryter E2E-seed-pipeline

**Symptom:** Efter `supabase db reset` + `prisma migrate deploy` + auth-triggers failar `handle_new_user`-triggern att skapa `public.User`-poster vid E2E-seed.

**Rotorsak:** Trigger-function `public.handle_new_user()` finns och `on_auth_user_created`-triggern finns på `auth.users`. Auth-users (count=3) skapas av seed. Men `public.User` (count=0) skapas inte. Trolig orsak: triggern kör i SECURITY DEFINER-kontext som inte har tillräckliga rättigheter på `public."User"` efter reset, eller timing-issue i Supabase local dev.

**Konsekvens:** Enda säkra E2E-approach efter reset är att starta OM Supabase från scratch (`supabase stop && supabase start`) istället för `supabase db reset`.

**Åtgärd (S43):** Dokumentera i gotchas.md: "Använd `supabase stop && supabase start` istället för `supabase db reset` för E2E-state. Kör sedan `prisma migrate deploy` + auth-triggers.sql manuellt." Alternativt: fixe E2E-cleanup att raderas auth-användare via admin API.

### Blocker 3: offline-E2E seed fungerar inte pga ovan

Eftersom Blocker 2 bryter seeden kan offline-specs (offline-mutations.spec.ts, offline-pwa.spec.ts) inte köras.

## Definition of Done

- [x] Körningsförsök gjordes
- [x] Blockerare identifierade och dokumenterade
- [x] Inga kodändringar gjorda (audit-sprint)
- [ ] HTML-rapport producerad -- EJ MÖJLIGT

## Reviews körda

Kördes: ingen (exekverings-story, inga kodändringar)

## Docs uppdaterade

Ingen rapport producerad. Blockerare listade som backlog-items i retro-fil (S42-3).

## Verktyg använda

- Läste patterns.md: N/A
- Kollade code-map.md: N/A

## Arkitekturcoverage

N/A.

## Modell

sonnet

## Lärdomar

- `test:e2e:external` är ett "broken script" -- fungerar aldrig lokalt utan config-ändring. Customer-insights.spec.ts har inget projekt att köras i.
- `supabase db reset` är INTE ekvivalent med `supabase stop && supabase start` för E2E-syfte. Reset skapar inkonsistent trigger-state.
- Korrekt återstart-sekvens efter reset: `supabase stop` -> `supabase start` -> `prisma migrate deploy` -> `node -e "..." auth-triggers.sql`
