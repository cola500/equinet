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
- **Vercel-setup fixat via API**: Edge Config store + env vars skapades via Vercel REST API (inte manuellt i Dashboard).
- **30s cache behalls for DB-fallback**: Edge Config behover ingen cache (<1ms), men DB-pathen bevarar 30s cache som forut.

## Vercel-setup (2026-04-05)

Allt konfigurerat via Vercel REST API + CLI:

| Resurs | Varde |
|--------|-------|
| Edge Config store | `ecfg_s5crikolpdnbfub3oeqnm0yeltea` (slug: equinet-app-store) |
| `EDGE_CONFIG` | Connection string (encrypted, alla miljoer) |
| `EDGE_CONFIG_ID` | `ecfg_s5crikolpdnbfub3oeqnm0yeltea` (plain, alla miljoer) |
| `VERCEL_API_TOKEN` | Scoped token `equinet-edge-config` (encrypted, alla miljoer, no expiration) |
| Initial data | 20 feature flags skrivna till storen |
| Lokal `.env.local` | Pullad via `vercel env pull` |
| Verifierat | `get("feature_flags")` returnerar 20 flaggor lokalt |

**Token-historik:** Forsta tokenen skapades med expiration (misstag), ersatt med token utan expiration. Den utgangna tokenen ar borttagen fran Dashboard.

## Lardomar

- `@vercel/edge-config` ar enkelt: `get<T>(key)` for read, REST API for write. Ingen SDK for writes.
- Edge Config Free tier: 1 store, 8 KB max. 20 boolean-flaggor = ~500 bytes. Gott om marginal.
- `vi.mock()` MASTE vara fore imports i Vitest (hoisting). Galler aven nar man lagger till mock i befintlig testfil.
- Fire-and-forget med `.catch(() => {})` ar ratt monster for icke-kritiska sync-operationer.
- Vercel Hobby har inga granulara token-scopes -- "Full Account" ar enda alternativet. Skapa separat token per anvandning for roterings skull.
- Vercel CLI (OAuth-login) kan INTE skapa tokens via `vercel tokens create`. Kravs Dashboard eller classic personal access token.
- `vercel env pull .env.local` laddar INTE EDGE_CONFIG automatiskt -- `npx tsx` kraver `source .env.local` for att lasa dem.
