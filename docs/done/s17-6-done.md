---
title: "S17-6 Done: Edge Config for feature flags"
description: "Feature flag-lasning via Vercel Edge Config (<1ms) med DB-fallback"
category: retro
status: active
last_updated: 2026-04-05
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S17-6 Done: Edge Config for feature flags

## Acceptanskriterier

- [x] `@vercel/edge-config` installerat (v1.4.3)
- [x] `src/lib/edge-config.ts`: readFlagsFromEdgeConfig + syncFlagsToEdgeConfig
- [x] `getFeatureFlags()` laser Edge Config forst, DB-fallback vid null
- [x] `setFeatureFlagOverride()` synkar till Edge Config efter DB-write
- [x] `removeFeatureFlagOverride()` synkar till Edge Config efter DB-write
- [x] Prioritet: env var > Edge Config > DB > kod-default (oforandrad)
- [x] `useFeatureFlag()` hook oforandrad (transparent byte)
- [x] Graceful fallback: fungerar utan EDGE_CONFIG env var (lokal dev)
- [x] 7 nya tester (2 edge-config + 5 integration), alla grona

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (scoped API-token, fire-and-forget sync, ingen data-exponering)
- [x] Tester skrivna FORST (TDD), 3975 totalt, 4/4 quality gates grona
- [x] Docs uppdaterade (spec, plan)

## Reviews

- Kordes: tech-architect (spec-review), spec-reviewer (task 2+3), code-reviewer (task 2+3)
- tech-architect: 3 findings fixade (try/catch i sync, removeOverride sync, scoped token)
- spec-reviewer: alla krav uppfyllda, inga saknade/extra features
- code-reviewer: godkant

## Avvikelser

- **Lokal dev utan Edge Config**: Ingen EDGE_CONFIG env var lokalt -- faller tillbaka till DB. Exakt samma beteende som fore andringen.
- **Vercel-setup kravs**: Edge Config store + scoped API-token maste skapas manuellt i Vercel Dashboard (se Task 5 i planen).
- **30s cache behalls for DB-fallback**: Edge Config behover ingen cache (<1ms), men DB-pathen bevarar 30s cache som forut.

## Lardomar

- `@vercel/edge-config` ar enkelt: `get<T>(key)` for read, REST API for write. Ingen SDK for writes.
- Edge Config Free tier: 1 store, 8 KB max. 19 boolean-flaggor = ~500 bytes. Gott om marginal.
- `vi.mock()` MASTE vara fore imports i Vitest (hoisting). Galler aven nar man lagger till mock i befintlig testfil.
- Fire-and-forget med `.catch(() => {})` ar ratt monster for icke-kritiska sync-operationer.
- VERCEL_API_TOKEN ska vara scoped (edge-config scope), inte admin-token.
