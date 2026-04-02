---
title: "S9-7: Schema-baserad miljöisolering spike"
description: "Undersök om PostgreSQL schemas kan ge miljöisolering inom samma databas"
category: plan
status: active
last_updated: 2026-04-02
sections:
  - Bakgrund
  - Approach
  - Steg
  - Risker
  - Leverans
---

# S9-7: Schema-baserad miljöisolering spike

## Bakgrund

Idag delar dev och prod potentiellt samma Supabase-instans. Risk: lokal migration
ändrar prod-schema. S9-3 (staging-databas) väntar på resultatet av denna spike.

**Frågeställning:** Kan PostgreSQL schemas inom samma databas ge tillräcklig
miljöisolering (staging, e2e_test) utan separata Supabase-projekt?

## Approach

Testa mot lokal Docker-databas (`postgresql://postgres:postgres@localhost:5432/equinet`).
Prisma stöder `?schema=X` i connection string sedan v5.10+.

## Steg

1. **Verifiera Prisma schema-stöd** -- kolla att `?schema=staging` fungerar med vår Prisma-version
2. **Skapa schemas** -- `CREATE SCHEMA staging; CREATE SCHEMA e2e_test;` i lokal Docker-DB
3. **Kör migrationer** -- `prisma migrate deploy` med `?schema=staging`
4. **Seed + starta app** -- verifiera att appen fungerar mot staging-schema
5. **Data-isolation** -- skapa data i staging, verifiera att det inte syns i public
6. **Testa $queryRawUnsafe mot staging-schema** (10 min) -- Tech-architect flaggade:
   `src/app/api/providers/route.ts` rad 56-69 har `$queryRawUnsafe` med unqualified
   tabellnamn ("AvailabilityException"). Förlitar sig på `search_path`. Verifiera att
   queries resolvar mot staging-schemat, inte public.
7. **E2E smoke** -- kör `npm run test:e2e:smoke` mot staging-schema (om möjligt)
8. **PgBouncer + schema mot Supabase** (15 min, bonus) -- BLOCKER-RISK: PgBouncer
   transaction mode + `?schema=staging` kanske INTE propagerar `search_path` korrekt.
   Kan inte testas lokalt. Om tid finns och Johan godkänner:
   1. `CREATE SCHEMA spike_test` i Supabase SQL Editor
   2. `prisma migrate deploy` mot `?schema=spike_test` via pooler-URL
   3. Enkel query-test
   4. `DROP SCHEMA spike_test CASCADE`
9. **Dokumentera resultat** -- `docs/research/schema-isolation-spike.md`

## Risker

- Prisma kanske inte stöder `?schema=` fullt ut (RLS, migrationer, introspection)
- Supabase free-tier kan ha begränsningar kring schemas
- Extensions (uuid-ossp etc) kan behöva installeras per schema
- **PgBouncer + schema**: `search_path` kanske inte propagerar i transaction mode.
  Fallback: nytt Free Supabase-projekt (2 min, gratis, noll risk)

## Leverans

- `docs/research/schema-isolation-spike.md` med resultat och rekommendation
- Go/No-go beslut för S9-3 (staging-databas)
- Tidbox: max 1 session (~1 timme)

## Filer som ändras

- `docs/research/schema-isolation-spike.md` (ny)
- `docs/sprints/status.md` (statusuppdatering)
