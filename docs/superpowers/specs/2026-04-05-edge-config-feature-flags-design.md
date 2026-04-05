---
title: "S17-6: Edge Config for feature flags"
description: "Byt feature flag-lasning fran PostgreSQL till Vercel Edge Config (<1ms)"
category: architecture
status: wip
last_updated: 2026-04-05
sections:
  - Oversikt
  - Arkitektur
  - Dataflode
  - Andringar per fil
  - Testning
  - Rollback
---

# S17-6: Edge Config for feature flags

## Oversikt

Byt read-path for feature flags fran PostgreSQL (30s cache, ~50ms) till Vercel Edge Config (<1ms global). DB kvar som source of truth for writes och som fallback.

**Prioritetsordningen andras INTE:** env var > Edge Config > DB override > kod-default.

## Arkitektur

```
Admin toggle (PATCH /api/admin/settings)
  |
  v
setFeatureFlagOverride()
  |
  +---> 1. PostgreSQL upsert (source of truth)
  +---> 2. Edge Config update (via Vercel REST API)
  |
  v
invalidateCache()

getFeatureFlags() [read path]
  |
  +---> 1. Env vars (hogst prioritet, synkron)
  +---> 2. Edge Config via @vercel/edge-config (< 1ms)
  +---> 3. Fallback: PostgreSQL via Prisma (om Edge Config saknas/failar)
  +---> 4. Kod-defaults (lagst prioritet)
```

## Dataflode

### Write (admin toggle)

1. Admin klickar toggle i `/admin/system`
2. `PATCH /api/admin/settings` -> `setFeatureFlagOverride(key, value)`
3. Upsert i PostgreSQL (befintligt)
4. **NYTT:** Synka ALLA flaggor till Edge Config via Vercel REST API
5. Invalidera in-memory cache (befintligt)

Synk skickar hela flag-state (inte bara andrad flagga) for att Edge Config alltid ar konsistent.

### Read (server-side)

1. `getFeatureFlags()` anropas
2. For varje flagga: kolla env var forst (synkront)
3. **NYTT:** Lasa alla flaggor fran Edge Config (`getAll()`)
4. Om Edge Config returerar data: anvand den
5. Om Edge Config failar/saknas: fall tillbaka till PostgreSQL (befintligt beteende)
6. Fyll i saknade flaggor med kod-defaults

### Read (client-side)

Oforandrat. Klienten pollar `/api/feature-flags` var 60:e sekund. API-routen anropar `getFeatureFlags()` som nu laser fran Edge Config istallet for DB.

## Andringar per fil

### Nya filer

| Fil | Innehall |
|-----|----------|
| `src/lib/edge-config.ts` | Edge Config read/write wrapper. Exporterar `readFlagsFromEdgeConfig()` och `syncFlagsToEdgeConfig()`. Hanterar graceful fallback om env vars saknas. |

### Andrade filer

| Fil | Andring |
|-----|---------|
| `src/lib/feature-flags.ts` | `getFeatureFlags()`: lasa Edge Config forst, DB som fallback. `setFeatureFlagOverride()`: efter DB-upsert, anropa `syncFlagsToEdgeConfig()`. |
| `src/lib/feature-flags.test.ts` | Nya tester for Edge Config-lasning och fallback. |
| `src/lib/edge-config.test.ts` | Unit-tester for edge-config wrapper (ny fil). |

### Oforandra filer

- `feature-flag-definitions.ts` -- ingen andring
- `FeatureFlagProvider.tsx` -- ingen andring
- `/api/feature-flags/route.ts` -- ingen andring (anropar getFeatureFlags() som vanligt)
- `/api/admin/settings/route.ts` -- ingen andring (anropar setFeatureFlagOverride() som vanligt)
- `IFeatureFlagRepository.ts` -- ingen andring (DB-skrivning kvar)

## Edge Config setup

### Env vars som kravs

| Var | Beskrivning | Var |
|-----|-------------|-----|
| `EDGE_CONFIG` | Edge Config connection string | Vercel auto-injectar vid Marketplace-install |
| `EDGE_CONFIG_ID` | Edge Config store ID | For REST API writes |
| `VERCEL_API_TOKEN` | Vercel API-token for writes | Vercel Dashboard -> Settings -> Tokens |

### Edge Config store-struktur

```json
{
  "feature_flags": {
    "voice_logging": true,
    "route_planning": true,
    "provider_subscription": false,
    ...
  }
}
```

En enda nyckel `feature_flags` med alla flaggor som objekt. Enklare an en nyckel per flagga.

### Write via Vercel REST API

```typescript
async function syncFlagsToEdgeConfig(flags: Record<string, boolean>): Promise<void> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID
  const token = process.env.VERCEL_API_TOKEN
  if (!edgeConfigId || !token) return // Graceful skip i dev

  await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        { operation: 'upsert', key: 'feature_flags', value: flags },
      ],
    }),
  })
}
```

## Testning

### Unit-tester (TDD)

1. `edge-config.test.ts`:
   - `readFlagsFromEdgeConfig()` returnerar flaggor nar Edge Config fungerar
   - `readFlagsFromEdgeConfig()` returnerar null nar EDGE_CONFIG saknas
   - `readFlagsFromEdgeConfig()` returnerar null vid Edge Config-fel
   - `syncFlagsToEdgeConfig()` anropar Vercel REST API korrekt
   - `syncFlagsToEdgeConfig()` ar tyst vid saknade env vars (graceful skip)

2. `feature-flags.test.ts` (utoka befintliga):
   - `getFeatureFlags()` laser fran Edge Config nar tillgangligt
   - `getFeatureFlags()` faller tillbaka till DB nar Edge Config failar
   - `setFeatureFlagOverride()` synkar till Edge Config efter DB-write

### Befintliga tester

Alla befintliga feature flag-tester MASTE forbi vara grona. Edge Config ar mockad i tester -- befintligt beteende (DB + kod-defaults) bibehalls.

## Rollback

Om Edge Config orsakar problem:

1. **Snabb:** Ta bort `EDGE_CONFIG` env var pa Vercel -> systemet faller tillbaka till DB automatiskt
2. **Permanent:** Revertera andringarna i `feature-flags.ts` (2 rader)

Fallback-logiken gor att systemet ALLTID fungerar utan Edge Config.

## Begransningar

- **Edge Config Free tier:** 1 store, 8 KB max. 19 flaggor (boolean) = ~500 bytes. Gott om marginal.
- **Write-latens:** REST API-write tar ~200ms. Acceptabelt for admin-toggle (inte hot path).
- **Lokal dev:** Ingen Edge Config lokalt. Systemet faller tillbaka till DB. Inga andringar i dev-workflow.
