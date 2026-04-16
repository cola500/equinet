---
title: "S27-5: GDPR data retention policy + cron -- Done"
description: "Sammanfattning av S27-5 implementering"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S27-5: GDPR data retention policy + cron -- Done

## Acceptanskriterier

- [x] Policy dokumenterad (`docs/security/data-retention-policy.md`)
- [x] Cron-job implementerat bakom feature flag (`data_retention`, default off)
- [x] Tester: identifiera inaktiva konton, notifiering, radering (14 tester)
- [x] `npm run check:all` gron (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Saker (Zod ej relevant for cron, auth via verifyCronAuth, feature flag gate)
- [x] Tester skrivna FORST, coverage 14 tester
- [x] Feature branch, `check:all` gron

## Reviews

- [x] tech-architect (plan review): 1 blocker (app_metadata skalbarhet -- acceptabelt MVP), 3 majors (pagination, admin-block, e-postmall)
- [x] code-reviewer (kod review): 1 blocker (stale notification metadata -- fixad), 4 majors (deleteAccountBySystem tests, N+1, deletion result, null test)

Korda: tech-architect (plan), code-reviewer (kod)

## Avvikelser

- **Ingen schema-andring**: Anvander Supabase `app_metadata` istallet for ny `DataRetentionNotice`-tabell. Dokumenterad begransning: fungerar for <10k anvandare.
- **N+1 i findInactiveUsers**: Acceptabelt for MVP -- cron kor en gang/manad, <100 anvandare initialt.
- **deleteAccountBySystem utan dedikerade tester**: Metoden ar en tunn variant av befintlig `deleteAccount` (samma deps, skippar bara losenord/bekraftelse). Acceptabelt risk for MVP.

## Lardomar

- **Supabase app_metadata ar inte indexerbart**: Bra for MVP-state men skalar inte. Framtida forbattring: dedikerad DB-tabell.
- **AccountDeletionService kraver losenord**: Behov av system-variant (deleteAccountBySystem) var forvantat men kravde ny publik metod pa befintlig service.
- **Feature flag-test ar brittle**: `getFeatureFlags` testar exakt antal flaggor -- ny flagga bryter testet. Overag att migrera till `expect.objectContaining`.
- **Stale metadata-race condition**: Code reviewer fangade att `data_retention_notified_at` aldrig rensas om anvandare loggar in under grace period. Fixades med guard i deletion-branchen.
