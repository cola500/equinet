---
title: "Feature Flag Source-of-Truth (löst: Supabase DB)"
description: "Källstyrningen för feature flags var blandad/oklar mellan Supabase DB och Edge Config. Beslut B (2026-06-13): Supabase DB är enda source of truth. Edge Config borttaget ur aktiv resolution."
category: operations
status: active
last_updated: 2026-06-13
tags: [feature-flags, edge-config, supabase, source-of-truth, resolved]
related:
  - .claude/rules/feature-flags.md
  - docs/operations/environment-runbook.md
sections:
  - Beslut
  - Bakgrund (skulden)
  - Vald arkitektur (B)
  - Implementation
  - Prod-migrering (reconcile + deploy)
  - Verifiering
---

# Feature Flag Source-of-Truth

> **Status:** Löst. **Beslut: B — Supabase DB är enda source of truth** (2026-06-13).

## Beslut

`env FEATURE_*` > **Supabase `FeatureFlag` DB** > kod-default. Edge Config är borttaget ur
aktiv feature flag-resolution. Admin-toggle skriver DB och får faktisk effekt i alla miljöer.
Prod och staging har separata Supabase-projekt → separata flaggvärden.

**Motivering (PO):** Flaggor togglas sällan. Prioritet på begriplighet, auditability och att
admin-UI faktiskt styr det som händer. Edge Config skapade oklar source-of-truth och gjorde
prod/staging svårare att förstå.

## Bakgrund (skulden)

Upptäckt 2026-06-13 under Feature Flag Portfolio Audit: källstyrningen var blandad. Prod
styrdes av **Edge Config** (DB bypassades helt när Edge Config var aktiv) medan staging saknade
Edge Config och resolverade via DB. Följder:

- Prod-DB-rader kunde vara döda/missvisande (lästes inte i prod).
- Admin-toggle kunde vara verkningslös i prod (`setFeatureFlagOverride` läste Edge Config först,
  stale, och syncade tillbaka gamla värden).
- Dokumentationen sa `env > DB > default` men verklig kedja var `env > Edge Config > DB > default`.

## Vald arkitektur (B)

| Lager | Roll |
|-------|------|
| `env FEATURE_*` | Högsta prioritet (per-miljö override, t.ex. `FEATURE_STRIPE_PAYMENTS` på staging) |
| Supabase `FeatureFlag` DB | **Source of truth.** Admin-UI skriver hit. 30s server-cache. |
| Kod-default (`defaultEnabled`) | Fallback när ingen DB-rad finns (eller DB-fel) |

Edge Config-lagret (`src/lib/edge-config.ts`, `@vercel/edge-config`) är borttaget.

## Implementation

- `src/lib/feature-flags.ts`: `getFeatureFlags()` läser endast DB (+30s cache); `setFeatureFlagOverride`/
  `removeFeatureFlagOverride` syncar inte längre till Edge Config.
- Raderat: `src/lib/edge-config.ts` + `src/lib/edge-config.test.ts`.
- `package.json`: `@vercel/edge-config` borttaget.
- Tester: Edge Config-prioritetstester ersatta av DB-source-of-truth-tester (env>DB, DB>default,
  admin-override → effektivt värde, reset → default).

## Prod-migrering (reconcile + deploy)

**Kritisk ordning** (annars regression): prod styrdes av Edge Config där `follow_provider` och
`municipality_watch` var `true`, men prod-DB hade dem `false`. Byte till DB-resolution utan
reconcile hade slagit AV båda i prod.

1. **Reconcile prod-DB FÖRE deploy** (medan Edge Config fortfarande styr → ingen direkt effekt):
   `UPDATE "FeatureFlag" SET enabled = true WHERE key IN ('follow_provider','municipality_watch')`.
   Efter reconcile == prod-DB matchar nuvarande effektiva värden för alla aktiva definitioner.
2. Deploy kod → prod byter till DB-resolution → effektiva värden oförändrade.
3. **Post-deploy cleanup (separat):** ta bort `EDGE_CONFIG` + `EDGE_CONFIG_ID` (+ ev.
   `VERCEL_API_TOKEN`) ur prod-env; töm/ta bort Vercel Edge Config-storen. Görs sist.

Staging påverkades inte av kodbytet (saknade redan Edge Config → redan DB-resolverat).

## Verifiering

- `npm run check:all` grön.
- Staging: admin-toggle ändrar effektivt värde (verifierat).
- Prod post-deploy: `/api/feature-flags` identiskt med före reconcile/deploy; admin-toggle får effekt.
