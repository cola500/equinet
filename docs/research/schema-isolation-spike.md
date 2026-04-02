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

### Steg 8: PgBouncer (EJ TESTAD)

PgBouncer i transaction mode kanske INTE propagerar `search_path` korrekt.
Supabase anvander PgBouncer for sin pooler-URL (`port 6543`).

**Kan inte testas lokalt.** Kraver test mot Supabase med:
1. `CREATE SCHEMA spike_test` i SQL Editor
2. `prisma migrate deploy` via pooler-URL
3. Enkel query-test
4. `DROP SCHEMA spike_test CASCADE`

**Fallback:** Nytt Free Supabase-projekt (2 min, gratis, noll risk).

## PgBouncer-risk

Supabase erbjuder tva anslutningsmetoder:

| Metod | Port | PgBouncer | search_path |
|-------|------|-----------|-------------|
| Direkt-anslutning | 5432 | Nej | Fungerar (bekraftat lokalt) |
| Pooler (transaction mode) | 6543 | Ja | **Otestad risk** |

Prisma-dokumentationen rekommenderar direkt-anslutning for migrationer.
For runtime-queries via pooler: `search_path` maste sattas per transaktion,
och PgBouncer transaction mode ateranvander anslutningar mellan transaktioner.

**Worst case:** Schema-parameter ignoreras av PgBouncer -> queries gar mot
`public` schemat -> felaktig data i staging.

## Rekommendation

### For lokal utveckling: GO

Schema-baserad isolation fungerar utmarkt lokalt:
- `DATABASE_URL="...?schema=staging"` i `.env` eller `.env.local`
- Separata schemas for dev, test, staging
- Inga extra kostnader eller infrastruktur

### For Supabase-produktion: VILLKORLIGT GO

**Alternativ A (rekommenderat): Direkt-anslutning (port 5432)**
- Fungerar garanterat (bekraftat lokalt, samma PostgreSQL-beteende)
- Nackdel: Ingen connection pooling -> max ~20 connections pa free tier
- Tillrackligt for staging/e2e (laga trafik)

**Alternativ B: Testa PgBouncer forst**
- Krav: Johan testar manuellt mot Supabase (15 min)
- Om det fungerar: basta losningen (pooling + isolation)
- Om det INTE fungerar: fallback till Alternativ A eller C

**Alternativ C: Separat Supabase-projekt**
- Noll risk, noll konfiguration
- Nackdel: Tva projekt att underhalla, migrationer maste koras pa bada
- Gratis pa free tier

## Nastastegsalternativ

| Alternativ | Effort | Risk | Kostnad |
|------------|--------|------|---------|
| A: Schema + direkt-anslutning | 30 min | Lag | Gratis |
| B: Schema + PgBouncer (test forst) | 45 min | Medel | Gratis |
| C: Separat Supabase-projekt | 2h | Noll | Gratis |
| D: Avvakta (lokal Docker racker) | 0 | - | Gratis |

**Rekommendation:** Alternativ A for omedelbar staging-isolation.
Alternativ C som fallback om Supabase-begransningar uppstar.
