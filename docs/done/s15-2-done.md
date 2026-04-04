---
title: "S15-2 Done: Migrera prod-användare till auth.users"
description: "17 användare migrerade till prod Supabase auth.users med lösenordshashar från PoC"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S15-2 Done: Migrera prod-användare till auth.users

## Acceptanskriterier

- [x] Dry-run: 18 användare identifierade (14 med hash, 4 utan)
- [x] Live: 17 migrerade, 1 skippad (admin@equinet.se redan i auth.users), 0 fel
- [x] Verifierat: 17 användare i prod auth.users med korrekt userType och isAdmin

## Definition of Done

- [x] Fungerar som förväntat, inga fel
- [x] Säker (explicit env-parsing, inga credentials i loggar)
- [x] Idempotent (email_exists/user_already_exists hanteras som skip)
- [x] Docs uppdaterade

## Reviews

- Kördes: code-reviewer (enda relevanta -- operations-script, ingen ny kod i appen)

## Avvikelser

- **4 användare utan lösenordshash**: `johan@jaernfoten.se`, `gabriella.back@gmail.com`,
  `spike-test-s95@testmail.se`, `test-migration-probe@example.com` (probe raderades).
  De 3 kvarvarande skapades utan lösenord -- behöver "Glömt lösenord" för att sätta ett.
  `spike-test-s95` är en testanvändare från spike-testning.
- **admin@equinet.se redan i auth.users**: Skapades under första (misslyckade) körningen
  som använde lokala databasen istället för prod.

## Lärdomar

1. **`.env.local` trumfar allt i Next.js-kontext**: `dotenv` överskrider inte existerande
   process.env. `.env.local` laddas av tsx-runtimen. Lösning: explicit `parseEnvFile()`
   som läser filen direkt utan att gå via process.env.

2. **PoC och prod har olika UUID:n**: Samma emails men olika id:n. Matcha ALLTID på email
   vid cross-miljö-migrering. Aldrig anta att ID:n är identiska.

3. **on_auth_user_created trigger + RLS**: Triggern (SECURITY DEFINER, owner=postgres)
   blockerades inte av RLS -- problemet var att den försökte INSERT med fel ID (lokalt DB-id
   istället för prod-id), vilket inte matchade ON CONFLICT (id). Med rätt ID:n fungerar
   ON CONFLICT korrekt.

4. **Supabase pooler (port 5432) ger auth-schema access**: Session mode pooler
   kan läsa/skriva auth.users. Direkt-URL:er kan ha IPv6-problem.

5. **Supabase pooler-user kan INTE ändra triggers**: `ALTER TABLE auth.users DISABLE TRIGGER`
   kräver table owner (supabase_auth_admin), inte pooler-user.
