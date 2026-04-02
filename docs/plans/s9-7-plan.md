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
6. **E2E smoke** -- kör `npm run test:e2e:smoke` mot staging-schema (om möjligt)
7. **Dokumentera resultat** -- `docs/research/schema-isolation-spike.md`

## Risker

- Prisma kanske inte stöder `?schema=` fullt ut (RLS, migrationer, introspection)
- Supabase free-tier kan ha begränsningar kring schemas
- Extensions (uuid-ossp etc) kan behöva installeras per schema

## Leverans

- `docs/research/schema-isolation-spike.md` med resultat och rekommendation
- Go/No-go beslut för S9-3 (staging-databas)
- Tidbox: max 1 session (~1 timme)

## Filer som ändras

- `docs/research/schema-isolation-spike.md` (ny)
- `docs/sprints/status.md` (statusuppdatering)
