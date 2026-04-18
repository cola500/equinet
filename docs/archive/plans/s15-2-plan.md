---
title: "S15-2 Plan: Migrera prod-användare till auth.users"
description: "Kopiera användare + lösenordshashar från PoC auth.users till prod auth.users"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Bakgrund
  - Approach
  - Steg
  - Risker
---

# S15-2 Plan: Migrera prod-användare till auth.users

## Bakgrund

S15-1 applicerade `remove_password_hash`-migrationen pa prod, sa `passwordHash`-kolumnen
i `public.User` ar borttagen. Losenordshashar finns kvar i PoC:s `auth.users.encrypted_password`
(migrerade i S11-2).

## Approach

Uppdatera `scripts/migrate-users-to-supabase-auth.ts` att:

1. Lasa `id, encrypted_password` fran PoC:s `auth.users` via `pg` (node-postgres)
2. Lasa eligible users fran prod:s `public.User` via Prisma (prod DATABASE_URL)
3. Matcha pa `id` -- hitta losenordshash fran PoC for varje prod-anvandare
4. Skapa i prod:s `auth.users` via Supabase Admin API med `password_hash`-parameter

**Env-filer:**
- `.env.local`: PoC Supabase URL + service role (for att lasa PoC auth.users-data)
- `.env.supabase`: Prod DATABASE_URL + Supabase URL + service role (maldatabas)

## Steg

1. Installera `pg` (node-postgres) som dev dependency
2. Uppdatera scriptet med dual-databas-logik
3. Dry-run: `npx tsx scripts/migrate-users-to-supabase-auth.ts --dry-run`
4. Live: kor mot prod
5. Verifiera: kontrollera att anvandare finns i prod auth.users

## Risker

- **PoC-data ur synk**: Om anvandare lagts till/andrats i prod sedan S11-2.
  Mitigation: scriptet matchar pa id, skapar bara de som finns i prod public.User.
- **Idempotent**: `email_exists`/`user_already_exists` hanteras som skip.
- **Rate limiting**: Batchar med 500ms delay.
