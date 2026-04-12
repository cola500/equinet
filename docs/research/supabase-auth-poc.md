---
title: "Supabase Auth PoC -- Resultat"
description: "Resultat fran S10-5 proof-of-concept: Supabase Auth bevisat -- login, custom claims, RLS fungerar"
category: research
status: active
last_updated: 2026-04-03
tags: [auth, supabase, nextauth, migration, poc]
sections:
  - Sammanfattning
  - Testresultat
  - Vad som byggdes
  - Supabase-projekt
  - Testanvandare
  - Gotchas
  - Go/No-go
  - Nasta steg
---

# Supabase Auth PoC -- Resultat

## Sammanfattning

**Status: GO -- hela kedjan bevisad.**

PoC:n testade Supabase Auth login -> custom JWT claims -> RLS-filtrering.
Allt fungerar. Provider ser bara sina egna bokningar via RLS, anon-anvandare ser ingenting.

## Testresultat

| Test | Resultat |
|------|----------|
| Supabase Auth login (email+lösenord) | **OK** |
| Custom claims i JWT (userType, providerId, isAdmin) | **OK** |
| RLS: provider ser bara sina bokningar | **OK** -- 1 bokning returnerad (av 2 i tabellen) |
| RLS: anon ser ingenting | **OK** -- tom lista |
| Unit-tester (test-route) | **OK** -- 4/4 grona |
| Typecheck + lint + svenska | **OK** -- 3939 tester, 0 fel |

### Detaljerat RLS-test

Tva providers skapades med varsin bokning:
- `poc-test@equinet.se` (providerId: `049274a0-...`) -- bokning `book-poc-1`
- `other@test.se` (providerId: `other-prov-1`) -- bokning `book-other-1`

Query via Supabase REST API med poc-test:s JWT:
```json
[{"id": "book-poc-1", "providerId": "049274a0-...", "status": "confirmed"}]
```
Bara den egna bokningen. Den andra providerns bokning ar osynlig.

Query utan JWT (anon): `[]` -- helt blockerad.

## Vad som byggdes

| Komponent | Fil | Status |
|-----------|-----|--------|
| Browser-klient | `src/lib/supabase/browser.ts` | Klar |
| Server-klient | `src/lib/supabase/server.ts` | Klar |
| Custom Access Token Hook | `prisma/migrations/20260403120000_supabase_auth_hook/migration.sql` | Klar + deployad |
| Booking RLS-policy | `prisma/migrations/20260403120100_booking_rls_policy/migration.sql` | Klar + deployad |
| Feature flag | `supabase_auth_poc` i `feature-flag-definitions.ts` | Klar (default: false) |
| Test-route | `src/app/api/v2/test-auth/route.ts` | Klar (4 tester) |
| Paket | `@supabase/ssr` 0.9.0, `@supabase/supabase-js` 2.101.1 | Installerade |

## Supabase-projekt

| Vad | Varde |
|-----|-------|
| Projekt-ref | `zzdamokfeenencuggjjp` |
| Region | `eu-central-1` |
| Pooler (session mode) | `aws-1-eu-central-1.pooler.supabase.com:5432` |
| Schema | Alla 33 Prisma-migrationer deployade |
| Custom Hook | `public.custom_access_token_hook` -- aktiverad i Dashboard |
| RLS | `booking_provider_read` pa `Booking` -- aktiv, utan FORCE (service_role kringgår) |

**OBS:** Detta ar ett SEPARAT projekt fran det gamla (`xybyzflfxnqqyxnvjklv`).
`.env.local` uppdaterad med nya URL, anon key och service role key.
Kommenterade DATABASE_URL:er (rad 3-4 i `.env.local`) pekar fortfarande pa det gamla projektet.

## Testanvandare

| Vad | Varde |
|-----|-------|
| Email | `poc-test@equinet.se` |
| UUID | `310f2f02-6b8a-404b-b405-d6fe43e64abf` |
| userType | `provider` |
| providerId | `049274a0-ab92-453b-92c7-44c192fa57d5` |
| businessName | `PoC Teststall` |

Anvandaren finns i bade `auth.users` och `public.User` + `public.Provider` med matchande UUID.

## Gotchas

1. **`stableId` saknas i DB**: Hook-funktionen refererade till `u."stableId"` men kolumnen
   fanns inte pa `User`-tabellen i Supabase (schema-drift). Fixat genom att ta bort
   referensen. Nar `stableId` laggs till pa User i framtiden, uppdatera hooken.

2. **Pooler-format**: `aws-1-eu-central-1.pooler.supabase.com:5432` (session mode) fungerar
   for Prisma migrate. Port 6543 (transaction mode) hangar. Direct connection (`db.*.supabase.co`)
   ar inte nåbar.

3. **RLS utan FORCE**: Vi använder `ENABLE ROW LEVEL SECURITY` men INTE `FORCE`.
   Det betyder att service_role (Prisma) kringgar RLS -- befintliga routes paverkas inte.
   Bara queries via Supabase-klienten med user JWT filtreras.

4. **Nytt Supabase-projekt**: PoC:n kor mot `zzdamokfeenencuggjjp`, inte det gamla
   `xybyzflfxnqqyxnvjklv`. Vid full migrering maste vi bestamma vilket projekt som
   ar produktionsprojektet.

## Go/No-go

**GO.**

| Kriterium | Bedömning |
|-----------|-----------|
| Login fungerar | Ja -- email+lösenord via Supabase Auth |
| Custom claims | Ja -- userType, providerId, isAdmin i JWT |
| RLS filtrerar | Ja -- provider ser bara sina bokningar |
| RLS blockerar | Ja -- anon ser ingenting |
| Prisma-kompatibilitet | Ja -- service_role kringgar RLS, inga ändringar behovs |
| Performance | Acceptabelt -- hook ar en enkel SELECT med JOIN |

**Risker att hantera i full migrering:**
- Alla anvandare maste logga in pa nytt
- ~40+ filer beros (auth routes, middleware, iOS)
- Parallell drift under overgangsperioden
- iOS-app kraver uppdatering samtidigt

## Nasta steg

1. **Besluta: nytt eller gammalt Supabase-projekt for produktion?**
2. **Planera Fas 1: Parallell drift** (nya routes med Supabase Auth, gamla med NextAuth)
   - Helper-funktion som stodjer bada auth-system
   - Databasmigrering: kopiera befintliga anvandare till `auth.users`
3. **iOS-test med Supabase Swift SDK** (kan goras som del av Fas 1)
4. **Ta bort PoC-testdata** nar beslut ar fattat

Se `docs/research/supabase-auth-spike.md` for full migreringsplan (4 faser).
