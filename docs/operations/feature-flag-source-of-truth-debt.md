---
title: "Feature Flag Source-of-Truth Separation (arkitektur/ops-skuld)"
description: "Källstyrningen för feature flags är blandad/oklar mellan Supabase DB och Edge Config. Prod styrs av Edge Config (DB bypassas), staging saknar Edge Config. Kräver ett A/B-beslut innan ytterligare flagg-cleanup."
category: operations
status: active
last_updated: 2026-06-13
tags: [feature-flags, edge-config, supabase, source-of-truth, tech-debt, architecture]
related:
  - .claude/rules/feature-flags.md
  - docs/operations/environment-runbook.md
  - docs/feature-flags-review.md
sections:
  - Problem
  - Vad är faktiskt aktivt idag
  - Gemensamt mellan miljöer
  - Miljöspecifikt
  - Risker
  - Framtida målbild (beslut behövs)
  - Rekommendation
  - Verifieringsunderlag
---

# Feature Flag Source-of-Truth Separation

> **Klassning:** Architecture / Operations debt.
> **Status:** Oklar/blandad källstyrning — kräver beslut (A eller B) innan ytterligare flagg-cleanup.
> **Upptäckt:** 2026-06-13, under Feature Flag Portfolio Audit (efter retirement-sprinten + orphan cleanup).

## Problem

Feature flag **source-of-truth är blandad/oklar** mellan Supabase `FeatureFlag`-tabellen och Vercel Edge Config. När prod- och staging-miljöerna delades upp separerades flagg-styrningen aldrig fullt ut. Resultatet är att samma kod ger **olika aktiv styrkälla per miljö**, utan medveten design.

Detta gör att:
- Prod-DB:s `FeatureFlag`-rader kan vara **döda/missvisande** (de läses inte i prod).
- Admin-toggle i `/admin/system` kan vara **verkningslös eller missvisande i prod**.
- Jämförelser av flaggvärden mellan staging och prod för "drift-cleanup" är **ogiltiga** tills källan är enhetlig.

## Vad är faktiskt aktivt idag

### Koden (verifierad call chain)

`getFeatureFlags()` i `src/lib/feature-flags.ts`:

1. `readFlagsFromEdgeConfig()` (`src/lib/edge-config.ts`) — returnerar `null` om `EDGE_CONFIG`-env saknas; annars Edge Config-storens `feature_flags`-objekt.
2. **Om Edge Config returnerar non-null hoppas DB-hämtningen över helt** (`if (edgeConfigFlags === null)`-guard) — `dbOverrides` förblir `{}`.
3. Per nyckel: `FEATURE_<KEY>` env → Edge Config (om nyckeln finns) → DB-override → kod-default (`defaultEnabled`).

Anropas av `layout.tsx` (SSR) och `/api/feature-flags`. Admin skriver via `setFeatureFlagOverride` (DB upsert + `syncFlagsToEdgeConfig`).

### Prod (verifierat 2026-06-13)

- `EDGE_CONFIG` + `EDGE_CONFIG_ID` är **SET**. Inga `FEATURE_*`-env.
- Edge Config-storens `feature_flags`-nyckel innehåller 15 poster (14 kod-definitioner + en kvarvarande `demo_mode=false`-orphan).
- **→ Prod styrs av Edge Config. `FeatureFlag`-tabellen läses aldrig i prod.**
- Exempel på divergens: DB hade `follow_provider`, `help_center`, `municipality_watch` = `false`, men Edge Config har dem = `true` → effektivt `true`. DB-raderna är döda.

### Staging (delvis verifierat — spår avbrutet medvetet)

- `EDGE_CONFIG` / `EDGE_CONFIG_ID` **MISSING**. Minst en `FEATURE_STRIPE_PAYMENTS`-env satt. `NEXT_PUBLIC_DEMO_MODE=true`.
- Ingen Edge Config → effektiva värden kommer från env + DB-override och/eller kod-default.
- **Vilken DB staging faktiskt läser, och om den är skild från prod, är INTE verifierat och ska inte antas.** Uppdelningen mellan miljöerna var ofullständig — anta inga separata DB-sanningar.

## Gemensamt mellan miljöer

- Samma kod och samma `getFeatureFlags`-logik.
- Samma 14 kod-definitioner (`feature-flag-definitions.ts`) med samma `defaultEnabled`.
- Samma deklarerade prioritetskedja i koden: **env > Edge Config > DB > kod-default**.
- `demo_mode`-orphan finns kvar i **prod Edge Config** (`false`) trots att den rensats ur definitioner + prod-DB.

## Miljöspecifikt

| Aspekt | Prod | Staging |
|--------|------|---------|
| Edge Config | **Aktiv** (styrkälla) | Frånvarande |
| `FeatureFlag`-DB | Bypassas (död) | Möjlig fallback (ej verifierad) |
| `FEATURE_*`-env | Inga | Minst `FEATURE_STRIPE_PAYMENTS` |
| `NEXT_PUBLIC_DEMO_MODE` | false | true |

Samma kod → olika aktiv styrmekanism per miljö. Det är kärnan i skulden.

## Risker

1. **Blandad/oklar sanning** — ingen entydig "var ändrar jag en flagga".
2. **Admin-toggle kan vara verkningslös i prod** — `setFeatureFlagOverride` skriver DB och anropar sedan `getFeatureFlags()`, som i prod läser Edge Config först (stale) och syncar tillbaka gamla värden. DB-raden uppdateras men den aktiva Edge Config-nyckeln ändras inte. Sannolik orsak till DB=false vs effektiv=true. *(Inferens från kod — bör verifieras innan åtgärd.)*
3. **Vilseledande DB** — prod-DB-rader ser ut som sanning men är döda. Orphan-städningen 2026-06-13 i prod-DB var ofarlig men rörde inte den aktiva Edge Config (där `demo_mode`-orphan lever kvar).
4. **Ogiltiga drift-jämförelser** — staging vs prod flaggvärden får inte ligga till grund för cleanup tills källan är enhetlig.
5. **Felaktig dokumentation** — `.claude/rules/feature-flags.md` och MEMORY listar prioritet som "env > DB > default" och **utelämnar Edge Config helt**.

## Framtida målbild (beslut behövs)

Välj **EN** source-of-truth, samma i alla miljöer:

- **A) Edge Config överallt** — behåll perf (<1ms-läsningar, redan i prod). DB blir ren admin-skrivbuffert som ALLTID synkas korrekt. Kräver: fixa stale-läsningen i `setFeatureFlagOverride`, aktivera Edge Config i staging.
- **B) Supabase DB överallt** — ta bort Edge Config-lagret. Enklast mentala modell, matchar ursprunglig intention ("Supabase `FeatureFlag` = styrande"). Offrar Edge Configs läshastighet.

Oavsett val: `demo_mode` rensas ur **alla** lager (Edge Config med), och den faktiska kedjan dokumenteras.

## Rekommendation

**Ingen ytterligare feature flag-cleanup baserad på prod/staging-skillnader förrän A/B-beslutet är taget.** Skulden hanteras som egen architecture/ops-post, inte som en cleanup-slice.

## Verifieringsunderlag

- Kod: `src/lib/feature-flags.ts` (`getFeatureFlags`), `src/lib/edge-config.ts` (`readFlagsFromEdgeConfig` / `syncFlagsToEdgeConfig`).
- Prod env: `EDGE_CONFIG`/`EDGE_CONFIG_ID` SET, inga `FEATURE_*` (read-only `vercel env pull`, maskerat).
- Prod Edge Config: `feature_flags` = 15 nycklar inkl. `demo_mode`-orphan (read-only item-läsning).
- Staging env: `EDGE_CONFIG` MISSING, `FEATURE_STRIPE_PAYMENTS` satt (read-only, temp-länkad pull).
