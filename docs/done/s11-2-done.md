---
title: "S11-2 Done: Migrera användare till Supabase auth.users"
description: "Migreringsscript som kopierar alla riktiga användare till Supabase Auth med bevarade bcrypt-hashar"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lärdomar
---

# S11-2 Done: Migrera användare till Supabase auth.users

## Acceptanskriterier

- [x] Alla icke-ghost, icke-blockerade användare migrerade (14/14)
- [x] UUID matchar mellan auth.users och public.User (Admin API sätter samma ID)
- [x] Login fungerar med befintligt lösenord (3 användare verifierade: provider, kund, admin)
- [x] Custom claims (userType, isAdmin) korrekt i JWT
- [x] Scriptet är idempotent (andra körningen: 14 skippade, 0 fel)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (error.code loggas, aldrig error.message; inga secrets i output)
- [x] Tester: manuell verifiering (dry-run + live + login + idempotens)
- [x] Docs uppdaterade (status.md)

## Avvikelser

- **Inga unit-tester**: Scriptet är ett engångs-migreringsverktyg, inte produktionskod. Verifierat manuellt i 4 steg (dry-run, live, login, idempotens).
- **providerId saknas i JWT för seed-providers**: Custom Access Token Hook letar upp providerId från public.Provider-tabellen på Supabase. Seed-datan finns bara i lokal DB, inte på Supabase. Fungerar korrekt med riktiga användare (bekräftat i S10-5 PoC).

## Lärdomar

1. **Admin API har `password_hash`-parameter**: Supabase `createUser()` accepterar bcrypt-hashar direkt -- ingen SQL mot auth-schema behövs. Dokumenterat i [Auth0-migreringsguiden](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0). Sparade mycket komplexitet jämfört med direkt SQL-approach.

2. **app_metadata vs user_metadata**: Rolldata (userType, isAdmin) MÅSTE ligga i `app_metadata` -- kan bara ändras av service_role. `user_metadata` (firstName, lastName) kan ändras av användaren själv. Hade vi lagt rolldata i user_metadata = privilege escalation-risk.

3. **Steg 0 (manuell verifiering) var värt det**: Första försöket testade fel approach (direkt SQL mot auth.users via Prisma -- blockerat av schema-behörigheter). password_hash-parametern hittades genom att söka Supabase-docs efter migrering. Utan steg 0 hade scriptet blivit onödigt komplext.

4. **Idempotens via error.code**: `email_exists` / `user_already_exists` från Admin API gör det enkelt att göra scriptet idempotent utan extra lookups.
