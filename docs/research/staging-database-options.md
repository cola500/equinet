---
title: "Staging-databas: alternativ och rekommendation"
description: "Research av tre alternativ för staging-miljö: separat projekt, schema-isolation, Supabase branching"
category: research
status: active
last_updated: 2026-04-02
tags: [supabase, staging, database, infrastructure]
sections:
  - Sammanfattning
  - Alternativ 1 Nytt Free-projekt
  - Alternativ 2 Schema-baserad isolation
  - Alternativ 3 Supabase Branching
  - Prisma-kompatibilitet
  - Rekommendation
---

# Staging-databas: alternativ och rekommendation

> Beslut ej fattat. Plocka upp vid nästa sprint som berör S9-3.

## Sammanfattning

Tre alternativ utredda. Alla fungerar med Prisma + Equinets NextAuth-setup.

| Alternativ | Kostnad | Isolation | Komplexitet | Prisma-stöd |
|-----------|---------|-----------|-------------|-------------|
| Nytt Free-projekt | Gratis (2 projekt på Free) | Full | Låg | Fungerar direkt |
| Schema-isolation | Gratis | Delvis (auth delas) | Medel | `?schema=staging` i URL |
| Supabase Branching | Pro $25/mån | Full | Medel-hög | Kräver CI-steg |

## Alternativ 1: Nytt Free Supabase-projekt

Supabase Free tier tillåter 2 projekt. Equinet har 1 (produktion). Skapa "equinet-staging".

**Fördelar:**
- Full isolation (egen databas, egen auth, eget storage)
- Gratis
- 2 minuter att skapa
- Inga gotchas

**Nackdelar:**
- Två projekt att underhålla
- Migrationer måste köras separat

**Prisma:** `DATABASE_URL` pekar på staging-projektet. `prisma migrate deploy` fungerar direkt.

## Alternativ 2: Schema-baserad isolation

PostgreSQL schemas inom samma databas: `public` = prod, `staging` = staging.

**Hur:**
```
DATABASE_URL="postgresql://user:pass@host:5432/postgres?schema=staging"
```

Prisma skapar `_prisma_migrations` i det angivna schemat. Varje schema har sin egen migrationshistorik.

**Fördelar:**
- Gratis, inget extra projekt
- Snabbt att sätta upp (`CREATE SCHEMA staging`)
- Prisma stödjer det via `?schema=` parameter

**Nackdelar:**
- `auth.users` delas (Supabase Auth) -- INTE relevant för Equinet (vi använder NextAuth)
- `storage.objects` delas
- Supabase Dashboard visar bara `public` som default
- Supabase rekommenderar starkt separata projekt istället

**Prisma:** Fungerar med `?schema=staging` i connection string.

## Alternativ 3: Supabase Branching

Persistent branch i samma projekt skapar isolerad DB-instans.

**Kräver:** Pro-plan ($25/mån)

**Fördelar:**
- Full isolation (egen DB-instans)
- Kan skapas via MCP (`create_branch`)
- Automatiska PR-branches möjliga

**Nackdelar:**
- Pro-plan krävs
- Prisma-migrationer kräver manuellt CI-steg (Supabase använder eget migrationsformat)
- Beta-funktion
- Compute-kostnad per aktiv branch (~$0.01/h)

**Prisma:** Kräver `prisma migrate deploy` mot branch-specifik connection string.

## Prisma-kompatibilitet

Alla tre alternativ fungerar med Prisma:

```bash
# Alt 1: Separat projekt
DATABASE_URL="postgresql://user:pass@staging-host:5432/postgres"

# Alt 2: Schema
DATABASE_URL="postgresql://user:pass@host:5432/postgres?schema=staging"

# Alt 3: Branch
DATABASE_URL="postgresql://user:pass@branch-host:5432/postgres"
```

`prisma migrate deploy` fungerar mot alla tre. Connection pooling (`?pgbouncer=true&connection_limit=1`) krävs för Alt 1 och 3 (Supabase pooler). Alt 2 använder samma pooler som prod.

## Rekommendation

**Alternativ 1 (nytt Free-projekt)** rekommenderas. Full isolation, gratis, enklast, inga gotchas. Schema-isolation fungerar men Supabase avråder. Branching är overkill utan Pro-plan.

**Beslut parkerat** -- tas upp vid nästa tillfälle.

## Källor

- [Prisma: Connection URLs](https://www.prisma.io/docs/orm/reference/connection-urls)
- [Prisma: Multi-schema](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema)
- [Supabase: Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase: Database Branching](https://supabase.com/docs/guides/deployment/branching)
