---
title: "S42-1 Done: Webb E2E critical-tier"
description: "Critical-tier körning med Playwright trace + HTML-rapport"
category: sprint
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Fynd
  - Reviews körda
  - Docs uppdaterade
  - Lärdomar
---

# S42-1 Done: Webb E2E critical-tier

## Acceptanskriterier

- [x] `test:e2e:critical` körd, resultat dokumenterat
- [x] HTML-rapport i `docs/metrics/e2e-visual/2026-04-19/critical/`
- [x] Traces sparade
- [x] Flakes listade (se Fynd)

## Definition of Done

- [x] Inga kodändringar gjorda (audit-sprint)
- [x] Rapport producerad
- [x] Fynd dokumenterade

## Resultat

| Metric | Värde |
|--------|-------|
| Specs | booking.spec.ts + payment.spec.ts + provider.spec.ts |
| Total tests | 48 (inkl. setup/cleanup) |
| Pass | 31 |
| Skip | 3 |
| Fail | **14** |
| Tid | ~5.8 min |

### Baseline jämförelse

Senaste kända baseline: 373 pass / 77 skip / 0 fail (full svit, inte bara critical). Direkt jämförelse ej möjlig, men 14 fail i critical-tiern är **regression mot baseline**.

## Fynd (failure-analys)

### payment.spec.ts -- 10 fail (5 chromium + 5 mobile)

**Symptom:** `TimeoutError: locator.click: Timeout 15000ms exceeded` -- "betala.*kr"-knappen hittas inte.

**Trolig orsak:** Stripe-mocken renderar inte betalningsknappen korrekt. Payment-spec är känslig för mock-setup. Senaste CI-körning (baseline) hade 0 fail -- detta är en regression i lokal körmiljö (möjligen Stripe mock-version eller konfigurationsavvikelse).

**Påverkan:** Boknings- och betalningsflöden kan INTE verifieras lokalt i denna miljö.

**Åtgärd:** Notera som backlog-item. Fixa inte i S42 (scope-creep-risk).

### booking.spec.ts -- 4 fail (chromium only, mobile OK)

**Symptom:** `TimeoutError: page.waitForSelector('[data-testid="service-card"]')` -- service-cards laddas inte inom 10s.

**Trolig orsak:** DB-reset + seed-sekvens gav inkonsekvent datamiljö för chromium. Mobile-projektet körde EFTER chromium och fick rätt state. Alternativt: Turbopack cold-start gav chromium för lite tid.

**Påverkan:** Bokningsflödet via chromium kan inte verifieras.

**Åtgärd:** Notera som backlog-item. Kan fixas med ökad timeout eller explicit wait för service data.

### Mönster

Alla provider.spec.ts-tester passerade (both chromium + mobile). Boknings-UI fungerar men boknings-FLÖDET är skörheter.

## Reviews körda

Kördes: ingen (exekverings-story, inga kodändringar)

## Docs uppdaterade

- `docs/metrics/e2e-visual/2026-04-19/critical/report/` -- HTML-rapport
- `docs/metrics/e2e-visual/2026-04-19/critical/traces/` -- Playwright traces

## Verktyg använda

- Läste patterns.md: N/A
- Kollade code-map.md: N/A

## Arkitekturcoverage

N/A.

## Modell

sonnet

## Lärdomar

- **DB-state transfer**: Smoke-körning lämnar auth-användare i Supabase efter cleanup. Nästa tier kan inte seeda på nytt -- behöver `supabase db reset` mellan körningar. Dokumentera som gotcha.
- **Payment-mock är skör lokalt**: Fungerar i CI men inte alltid lokalt. Behöver undersökas.
- **Booking chromium-timeout**: `[data-testid="service-card"]` timeoutar på chromium, fungerar på mobile. Cold-start-relaterat eller race condition.
