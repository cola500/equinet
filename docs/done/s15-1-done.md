---
title: "S15-1 Done: Hook + trigger + RLS pa prod"
description: "7 migrationer applicerade pa prod-Supabase, hook aktiverad i dashboard"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lardomar
---

# S15-1 Done: Hook + trigger + RLS pa prod

## Acceptanskriterier

- [x] `prisma migrate deploy` mot prod (7 migrationer applicerade)
- [x] Custom Access Token Hook aktiverad i Supabase Dashboard
- [x] Hook-funktion verifierad i databasen

## Migrationer applicerade

1. `20260403120000_supabase_auth_hook` -- custom_access_token_hook funktion
2. `20260403120100_booking_rls_policy` -- RLS pa Booking
3. `20260403120200_sync_trigger_auth_users` -- handle_new_user trigger
4. `20260404120000_remove_password_hash` -- ta bort passwordHash-kolumn
5. `20260404120000_rls_read_policies` -- 13 SELECT-policies
6. `20260404130000_rls_write_policies` -- 15 WRITE-policies
7. `20260404140000_auth_hook_rls_policies` -- supabase_auth_admin policies

## Definition of Done

- [x] Fungerar som forvantat
- [x] Saker (RLS aktiverat, hook med separata queries)
- [x] Docs uppdaterade

## Reviews

- Kodandringar: inga (bara migrationer som redan granskats i S14 + S15-0)
- Hook-funktionen uppdaterad i S15-0 med separata queries (RLS-kompatibel)

## Lardomar

- Inga overraskningar -- migrationerna var redan testade mot PoC + lokal Supabase
- Hook maste aktiveras manuellt i Supabase Dashboard (kan inte goras via SQL/migrationer)
