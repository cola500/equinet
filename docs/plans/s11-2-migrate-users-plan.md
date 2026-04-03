---
title: "S11-2: Migrera befintliga användare till Supabase auth.users"
description: "Plan för att kopiera alla riktiga användare från public.User till auth.users med matchande UUID och bcrypt-hash"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Approach
  - Filer som ändras/skapas
  - Steg
  - Risker och oklarheter
  - Acceptanskriterier
---

# S11-2: Migrera befintliga användare till Supabase auth.users

## Bakgrund

S10-5 bekräftade att Supabase Auth fungerar (login, claims, RLS). PoC:n skapade
en testanvändare manuellt i auth.users. Nu behöver alla befintliga användare
kopieras dit så de kan logga in via Supabase Auth med samma lösenord.

**Supabase-projekt:** `zzdamokfeenencuggjjp` (eu-central-1)
**Custom Access Token Hook:** Aktiv -- injicerar userType, providerId, isAdmin i JWT.

## Approach

Ett TypeScript-script som läser alla användare från public.User via Prisma och
insertar dem i auth.users via Supabase Admin API (`supabase.auth.admin.createUser()`).

**Varför Admin API istället för direkt SQL?**
- auth.users hanteras av GoTrue -- direkt SQL kan missa triggers/validering
- Admin API sätter korrekta metadata, bekräftar email, och respekterar constraints
- Idempotent: `createUser()` returnerar fel om email redan finns, vi skippar

**Exkluderas:**
- Ghost users (`isManualCustomer = true`) -- har sentineladresser och slumpmässiga hashar
- Blockerade användare (`isBlocked = true`) -- ska inte kunna logga in

## Filer som ändras/skapas

| Fil | Åtgärd |
|-----|--------|
| `scripts/migrate-users-to-supabase-auth.ts` | **Ny** -- migreringsscript |
| `docs/sprints/status.md` | Uppdatera story-status |

## Steg

### 0. Verifiera password_hash manuellt (FÖRST)

- Skapa EN testanvändare via Admin API med `encrypted_password` satt till en bcrypt-hash
- Försök logga in med det kända lösenordet via `signInWithPassword`
- Om det INTE fungerar: utred alternativ (t.ex. direkt SQL insert i auth.users)
- Gå INTE vidare förrän login med kopierad hash är bekräftad

### 1. Skriv migreringsscriptet

- Läs alla `User` med `isManualCustomer = false` och `isBlocked = false`
- För varje användare: `supabase.auth.admin.createUser()`
  - `id`: samma UUID som i public.User
  - `email`: från User.email
  - `password` ELLER `encrypted_password`: bcrypt-hash (beroende på vad steg 0 bekräftar)
  - `email_confirm: true`
  - `user_metadata`: `{ firstName, lastName }` (presentationsdata)
  - `app_metadata`: `{ userType, isAdmin }` (rolldata som styr claims)
- Hantera redan existerande (skip med log av `error.code`, ALDRIG `error.message`)
- Sammanfattning i slutet: X migrerade, Y skippade (existerande), Z fel (med error.code)

### 2. Testa mot lokal databas (dry-run)

- Kör scriptet med `--dry-run` flagga (loggar vad det SKULLE göra)
- Verifiera att rätt användare inkluderas/exkluderas

### 3. Kör mot Supabase-projektet

- Kör scriptet mot `zzdamokfeenencuggjjp`
- Verifiera i Supabase Dashboard: Authentication -> Users

### 4. Verifiera login

- Logga in med en befintlig användare via Supabase Auth
- Bekräfta att JWT innehåller korrekta claims (userType, providerId, isAdmin)

## Risker och oklarheter

| Risk | Mitigering |
|------|-----------|
| bcrypt-hash format skiljer sig | Verifieras manuellt i steg 0 INNAN scriptskrivning |
| UUID-kollision i auth.users | Vi sätter samma UUID som i public.User -- bör inte finnas |
| Rate limiting på Admin API | Batch i grupper om 10 med kort delay |
| PoC-testanvändare redan i auth.users | Scriptet skippar existerande |
| isBlocked-användare | Exkluderas helt -- om de ska avblockeras kan de migreras senare |

## Acceptanskriterier

- [ ] Alla icke-ghost, icke-blockerade användare migrerade
- [ ] UUID matchar mellan auth.users och public.User
- [ ] Login fungerar med befintligt lösenord (via Supabase Auth)
- [ ] Custom claims (userType, providerId, isAdmin) korrekt i JWT
- [ ] Scriptet är idempotent (kan köras igen utan problem)
