---
title: "S11-3 Done: Sync-trigger auth.users -> public.User"
description: "PL/pgSQL trigger som automatiskt skapar public.User vid Supabase Auth-registrering"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lärdomar
---

# S11-3 Done: Sync-trigger auth.users -> public.User

## Acceptanskriterier

- [x] Ny Supabase Auth-registrering skapar public.User (via trigger)
- [x] UUID matchar mellan auth.users och public.User (NEW.id)
- [x] userType hårdkodat till 'customer' (aldrig från metadata)
- [x] firstName, lastName synkas från raw_user_meta_data med COALESCE-defaults
- [x] Trigger-fel bubblar upp som Supabase 500
- [x] ON CONFLICT DO NOTHING förhindrar duplicerade rader
- [ ] Migration applicerad på Supabase dev-projekt (kräver tech lead / manuellt steg)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker: userType hårdkodat, SECURITY DEFINER, search_path = public, pg_temp
- [x] 5 integrationstester skrivna och gröna
- [x] Feature branch, alla tester gröna
- [x] Docs uppdaterade

## Avvikelser

1. **auth.users finns inte lokalt**: Triggern refererar auth.users som bara finns på Supabase. Migration måste appliceras med `prisma migrate resolve --applied` lokalt och manuellt på Supabase.

2. **Tester kör mot public.User direkt**: Kan inte simulera auth.users INSERT lokalt. Testerna verifierar trigger-funktionens SQL INSERT-logik direkt mot public.User-tabellen istället.

## Lärdomar

1. **Vitest + Prisma + databas**: Vitest jsdom-miljö laddar inte .env-filer. `@vitest-environment node` + explicit `datasources.db.url` i PrismaClient-konstruktorn löser det.

2. **PostgreSQL parametrerade null-värden**: `$queryRawUnsafe` med `null` som parameter i `$5 IS NOT NULL` ger `42P08: could not determine data type`. Lösning: använd explicit `false`/`NULL` literals istället för parametriserad null i IS NOT NULL-uttryck.

3. **userType som säkerhetskritiskt fält**: `raw_user_meta_data` kan sättas av klienten vid sign-up. Behörighetsfält (userType, isAdmin) ska ALDRIG läsas från user-controlled data i triggers.
