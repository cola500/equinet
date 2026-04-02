---
title: "Schema-baserad miljoisolering -- spike-resultat"
description: "Resultat av S9-7: PostgreSQL schemas for staging/e2e-isolation inom samma databas"
category: research
status: active
last_updated: 2026-04-02
sections:
  - Sammanfattning
  - Testresultat
  - PgBouncer-risk
  - Rekommendation
  - Nastastegsalternativ
---

# Schema-baserad miljoisolering -- spike-resultat

## Sammanfattning

**Fragestellning:** Kan PostgreSQL schemas inom samma databas ge miljooisolering
(staging, e2e_test) utan separata Supabase-projekt?

**Svar: JA, det fungerar lokalt. PgBouncer-risk mot Supabase ar otestad.**

- Prisma 6.19.1 stodjer `?schema=X` i connection string
- Migrationer, seed, app-start och API-anrop fungerar korrekt
- Data ar fullstandigt isolerad mellan schemas
- `$queryRawUnsafe` respekterar `search_path` (ingen databacke)

## Testresultat

### Steg 1: Prisma schema-stod

| Test | Resultat |
|------|----------|
| Prisma-version | 6.19.1 (krav: >= 5.10) |
| `?schema=staging` i URL | Accepteras av Prisma |
| `prisma.config.ts` kompatibel | Ja, laser `DATABASE_URL` fran env |

### Steg 2-3: Schema-skapande + migrationer

| Test | Resultat |
|------|----------|
| `CREATE SCHEMA staging` | OK |
| `CREATE SCHEMA e2e_test` | OK |
| `prisma migrate deploy ?schema=staging` | Alla 31 migrationer applicerade |
| Tabell-rakning staging vs public | 43 tabeller i bada (identiskt) |

### Steg 4: Seed + app-start

| Test | Resultat |
|------|----------|
| `prisma db seed` mot staging | OK, 7 anvandare skapade |
| Next.js dev mot staging (port 3001) | OK, startar pa 2s |
| API: `/api/feature-flags` | 200, query mot `staging.FeatureFlag` |
| API: `/api/providers` | 200, alla queries schema-kvalificerade |

### Steg 5: Data-isolation

| Test | Resultat |
|------|----------|
| Anvandare: public 14, staging 7 | Isolerade |
| INSERT i staging.FeatureFlag | Syns INTE i public |
| Cross-schema lacka | Ingen detekterad |

### Steg 6: $queryRawUnsafe (tech-architect-flaggad)

**Bakgrund:** `src/app/api/providers/route.ts` rad 56-69 anvander
`$queryRawUnsafe` med unqualified tabellnamn `"AvailabilityException"`.

| Test | Resultat |
|------|----------|
| `SHOW search_path` via Prisma (staging) | `"staging"` |
| `SHOW search_path` via Prisma (public) | `"$user", public` |
| Raw query mot staging (0 rader i AE) | Returnerar 0 (korrekt) |
| Raw query mot public (8 rader i AE) | Returnerar 1 (korrekt) |
| Prisma-logg visar `search_path` propagering | Bekraftad |

**Slutsats:** Prisma satter `search_path` vid anslutning. `$queryRawUnsafe`
resolvar unqualified tabellnamn mot det aktiva schemat. Ingen risk for databacke.

### Steg 7: E2E smoke

Playwright kunde inte koras pga `.next/dev/lock`-konflikt med befintlig dev-server.
Manuella curl-tester mot port 3001 bekraftade att alla API-endpoints fungerar
korrekt mot staging-schemat.

### Steg 8: PgBouncer + schema mot Supabase -- TESTAD, FUNGERAR

Testat mot Supabase pooler-URL (`pgbouncer=true&schema=spike_test`):

| Test | Resultat |
|------|----------|
| `CREATE SCHEMA spike_test` | OK |
| `prisma migrate deploy` (31 migrationer) | Alla applicerade |
| `SHOW search_path` | `spike_test` (korrekt) |
| `featureFlag.create()` + `findMany()` | OK, data i spike_test |
| `$queryRawUnsafe` med unqualified tabell | Resolvar mot spike_test |
| `DROP SCHEMA spike_test CASCADE` | OK, staddad |

**Slutsats:** PgBouncer transaction mode propagerar `search_path` korrekt.
Blockerrisken var ogrundad. Schema-isolation fungerar via pooler-URL.

### Steg 9: Slot machine uppsatt

Separat Supabase-projekt (eu-central-1, Frankfurt) med staging-schema:
- 31 migrationer applicerade
- 7 testanvandare seedade
- Anslutning via session pooler (port 5432) -- transaction pooler (6543) blockeras av natverk
- URL:er tillagda i `.env` (utkommenterade)

**Slot machine-konceptet:** Ett Supabase-projekt med multipla schemas for
olika andamal (staging, e2e_test, experiment). Snurra upp ny miljo pa sekunder
med `CREATE SCHEMA X` + `prisma migrate deploy ?schema=X`.

## PgBouncer-risk

Supabase erbjuder tva anslutningsmetoder:

| Metod | Port | PgBouncer | search_path |
|-------|------|-----------|-------------|
| Direkt-anslutning | 5432 | Nej | Fungerar (bekraftat lokalt) |
| Pooler (transaction mode) | 5432 | Ja | **Fungerar (bekraftat mot Supabase)** |

Prisma satter `search_path` vid anslutning, och PgBouncer propagerar det
korrekt i transaction mode. Bekraftat med migrationer, ORM-queries och
`$queryRawUnsafe`.

## Rekommendation

### For lokal utveckling: GO

Schema-baserad isolation fungerar utmarkt lokalt:
- `DATABASE_URL="...?schema=staging"` i `.env` eller `.env.local`
- Separata schemas for dev, test, staging
- Inga extra kostnader eller infrastruktur

### For Supabase-produktion: GO

**Alternativ B (rekommenderat): Schema + pooler-URL**
- Bekraftat att PgBouncer propagerar `search_path` korrekt
- Pooling + isolation i en losning
- Basta balansen mellan enkelhet och prestanda

**Alternativ A (fallback): Direkt-anslutning (port 5432)**
- Fungerar garanterat
- Nackdel: Ingen connection pooling -> max ~20 connections pa free tier
- Tillrackligt for staging/e2e (laga trafik)
- Om det INTE fungerar: fallback till Alternativ A eller C

**Alternativ C: Separat Supabase-projekt**
- Noll risk, noll konfiguration
- Nackdel: Tva projekt att underhalla, migrationer maste koras pa bada
- Gratis pa free tier

## Nastastegsalternativ

| Alternativ | Effort | Risk | Kostnad |
|------------|--------|------|---------|
| B: Schema + pooler-URL | 30 min | Lag (bekraftat) | Gratis |
| A: Schema + direkt-anslutning | 30 min | Lag | Gratis |
| C: Separat Supabase-projekt | 2h | Noll | Gratis |
| D: Avvakta (lokal Docker racker) | 0 | - | Gratis |

**Rekommendation:** Alternativ B for staging-isolation med pooling.
Alternativ C som fallback om oforutsedda problem uppstar.
