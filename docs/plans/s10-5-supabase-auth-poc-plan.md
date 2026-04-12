---
title: "S10-5: Supabase Auth PoC -- Plan"
description: "Proof-of-concept for Supabase Auth som ersattning for NextAuth v5"
category: plan
status: active
last_updated: 2026-04-03
sections:
  - Mal
  - Scope
  - Approach
  - Filer som skapas
  - Filer som andras
  - Risker och oklarheter
  - Acceptanskriterier
  - Verifiering
---

# S10-5: Supabase Auth PoC -- Plan

## Mal

Bevisa att Supabase Auth kan ersatta NextAuth v5 i Equinet. PoC:n testar hela kedjan:
Supabase Auth login -> custom JWT claims -> RLS-filtrering -> iOS Swift SDK.
Ingenting av befintlig funktionalitet roras.

## Scope

**I scope:**
1. Supabase Auth-klient setup (`@supabase/ssr`, browser + server + middleware helpers)
2. Custom Access Token Hook (PL/pgSQL) som laggar `userType`, `providerId`, `isAdmin` i JWT
3. EN test-route (`/api/v2/test-auth`) som autenticerar via Supabase Auth
4. RLS-test: Supabase-klient med user JWT mot Booking-tabell
5. iOS: testa `supabase-swift` login i simulator
6. Research-dokument med Go/No-go

**Utanfor scope:**
- Migrering av befintliga routes
- Migrering av befintliga anvandare
- Anpassning av middleware (NextAuth behalls intakt)
- UI-ändringar (login-formularet roras inte)

## Approach

### Steg 1: Miljo-setup
- Hamta `NEXT_PUBLIC_SUPABASE_ANON_KEY` fran Supabase Dashboard
- Lagg till i `.env.local` och `.env.example`
- Installera `@supabase/ssr` och `@supabase/supabase-js`

### Steg 2: Supabase-klient utilities
- `src/lib/supabase/browser.ts` -- `createBrowserClient()`
- `src/lib/supabase/server.ts` -- `createServerClient()` med cookie-hantering
- Dessa ar isolerade -- inga ändringar i befintlig kod

### Steg 3: Custom Access Token Hook (Prisma-migration)
- SQL-funktion `custom_access_token_hook` som laser fran `public.User` + `public.Provider`
- Laggar `userType`, `isAdmin`, `providerId` i `app_metadata`
- **Levereras som Prisma-migration** (`prisma migrate dev --name supabase_auth_hook`)
  - `CREATE OR REPLACE FUNCTION` i migrerings-SQL
  - Ger versionskontroll och reproducerbarhet
  - Manuellt steg kvarstar: aktivera hooken i Supabase Dashboard -> Auth -> Hooks
    (Dashboard-kopplingen kan inte automatiseras via SQL)
- **Krav:** Johan aktiverar hooken manuellt i Dashboard efter migration

### Steg 3b: Testanvandare med matchande UUID
- Skapa en testanvandare i Supabase Auth (via Dashboard eller `supabase.auth.admin.createUser()`)
- Notera UUID:t som Supabase Auth genererar
- Skapa/uppdatera matchande rad i `public.User` med SAMMA UUID som `id`
  - Satt `userType: "provider"`, koppla till en `Provider`-rad
- Detta simulerar den sync-trigger som Fas 1 av full migrering använder
- **Alternativ:** Om det redan finns en testanvandare i Supabase Auth (fran RLS-spike),
  ateranvand den och skapa matchande `public.User`-rad
- Testanvandarens credentials dokumenteras i research-doc (INTE i kod)

### Steg 4: Test-route (feature-flaggad)
- `src/app/api/v2/test-auth/route.ts`
- **Feature flag**: `supabase_auth_poc` (ny flagga, default: false)
  - Definiera i `src/lib/feature-flag-definitions.ts`
  - Server-gate: `isFeatureEnabled('supabase_auth_poc')` -> 404 om av
  - Inga klient-gates behovs (ingen UI)
- Autenticerar via `supabase.auth.getUser()`
- Returnerar decoded claims (userType, providerId, etc.)
- Test: "returns 404 when flag disabled"

### Steg 5: RLS-test
- Manuellt test-script eller integrationstest
- Skapa Supabase-klient med user JWT (inte service role)
- Query `Booking` via Supabase-klient
- Verifiera att RLS filtrerar baserat pa `providerId` i JWT claims
- **Forutsattning:** RLS-policy pa Booking -- levereras som Prisma-migration
  (separat migration fran hook-funktionen)

### Steg 6: iOS-test (om tid finns)
- Installera `supabase-swift` i iOS-projektet
- Enkel login-test med email+lösenord i simulator
- Verifiera att JWT innehaller custom claims
- **Tidbox:** Max 2h, kan skippas om webb-PoC bevisar konceptet

### Steg 7: Dokumentera
- `docs/research/supabase-auth-poc.md` med resultat, Go/No-go, naasta steg

## Filer som skapas

| Fil | Syfte |
|-----|-------|
| `src/lib/supabase/browser.ts` | Supabase browser-klient |
| `src/lib/supabase/server.ts` | Supabase server-klient med cookies |
| `src/app/api/v2/test-auth/route.ts` | Test-route for Supabase Auth |
| `docs/research/supabase-auth-poc.md` | PoC-resultat och Go/No-go |
| `prisma/migrations/xxx_supabase_auth_hook/migration.sql` | Custom Access Token Hook |
| `prisma/migrations/xxx_booking_rls_policy/migration.sql` | RLS-policy pa Booking |

## Filer som andras

| Fil | Ändring |
|-----|---------|
| `.env.local` | Lagg till `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `.env.example` | Lagg till `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `package.json` | Lagg till `@supabase/ssr`, `@supabase/supabase-js` |
| `src/lib/feature-flag-definitions.ts` | Ny flagga `supabase_auth_poc` |

## Risker och oklarheter

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Saknar anon key | Blocker | Hamta fran Supabase Dashboard |
| Custom Hook kravs manuell aktivering i Dashboard | Medel | Hook-SQL i Prisma-migration, bara Dashboard-kopplingen ar manuell |
| Testanvandare UUID-matchning | Lag | Skapa via admin API, verifiera UUID i bada tabeller |
| `@supabase/ssr` API kan ha andrats sedan research | Lag | Verifiera mot aktuell docs |
| iOS Swift SDK-integration kan ta lang tid | Lag | Tidboxad 2h, kan skippas |

## Acceptanskriterier

- [ ] Supabase Auth login fungerar (webb)
- [ ] Custom claims (providerId) finns i JWT
- [ ] RLS filtrerar Booking via user JWT (ingen set_config)
- [ ] iOS login fungerar med Swift SDK (eller tidboxad och dokumenterad)
- [ ] Research-dokument med Go/No-go

## Verifiering

- `npm run typecheck` -- inga nya TypeScript-fel
- Manuell test av `/api/v2/test-auth` med inloggad Supabase-anvandare
- Befintlig `npm run check:all` ska fortfarande passera (ingen befintlig kod rord)
