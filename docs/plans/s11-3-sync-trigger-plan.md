---
title: "S11-3: Sync-trigger auth.users -> public.User"
description: "PL/pgSQL trigger som skapar public.User automatiskt vid Supabase Auth-registrering"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Approach
  - Filer som ändras/skapas
  - Steg
  - Risker och felhantering
  - Tester
  - Acceptanskriterier
---

# S11-3: Sync-trigger auth.users -> public.User

## Bakgrund

När en ny användare registrerar sig via Supabase Auth skapas en rad i `auth.users`.
Men Prisma arbetar mot `public.User` -- alla relationer (bookings, provider, etc.)
hänger på att det finns en matchande rad där. Denna trigger överbryggar gapet.

Spike-koden finns i `docs/research/supabase-auth-spike.md` (rad 170-192).

## Approach

En Prisma-migration som skapar:

1. **`handle_new_user()`** -- PL/pgSQL trigger-funktion (SECURITY DEFINER)
2. **`on_auth_user_created`** -- AFTER INSERT trigger på `auth.users`

Triggern läser `raw_user_meta_data` för userType, firstName, lastName och skapar
en `public.User`-rad med samma UUID.

**Varför SECURITY DEFINER?** Triggern körs i auth-schemats kontext men måste
skriva till public-schemat. SECURITY DEFINER kör med funktionens ägar-rättigheter
(postgres/service_role) istället för anroparens.

## Filer som ändras/skapas

| Fil | Ändring |
|-----|---------|
| `prisma/migrations/<ts>_sync_trigger_auth_users/migration.sql` | Ny migration |
| `src/domain/auth/__tests__/sync-trigger.integration.test.ts` | Integrationstester |
| `docs/sprints/status.md` | Statusuppdatering |

## Steg

### Fas 1: RED -- Tester först

Skriv integrationstester som verifierar trigger-beteendet:

1. **Ny användare med alla fält** -- insert i auth.users med raw_user_meta_data -> public.User skapas med korrekt UUID, email, userType, firstName, lastName
2. **Saknade metadata (defaults)** -- insert utan userType -> defaultar till 'customer', tomma namn
3. **Duplicerad insert (idempotens)** -- insert med samma UUID -> no-op (ON CONFLICT DO NOTHING)
4. **Email-verifiering** -- email_confirmed_at satt -> emailVerified=true

**OBS:** Testerna kör mot lokal Docker-databas med `$queryRawUnsafe` för att
simulera auth.users-inserts (vi har inte auth-schemat lokalt). Alternativ:
mocka trigger-funktionen direkt med unit-test av SQL-logiken.

**Reviderad testansats:** Eftersom auth-schemat inte finns lokalt (Supabase-managed),
testar vi trigger-funktionen isolerat:
- Unit-test: anropa `handle_new_user()` direkt med konstruerad `NEW`-record
- Integration: verifiera mot Supabase dev-projekt med faktisk sign-up

### Fas 2: GREEN -- Migration

Skapa Prisma-migrationen med `--create-only` (vi skriver SQL manuellt):

```sql
-- CreateFunction: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."User" (
    id,
    email,
    "passwordHash",
    "userType",
    "firstName",
    "lastName",
    "emailVerified",
    "emailVerifiedAt",
    "createdAt",
    "updatedAt"
  ) VALUES (
    NEW.id,
    NEW.email,
    '',
    COALESCE(NEW.raw_user_meta_data->>'userType', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
    COALESCE(NEW.raw_user_meta_data->>'lastName', ''),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.email_confirmed_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- CreateTrigger: on_auth_user_created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Fas 3: VERIFY

- `npm run typecheck`
- Tester gröna
- Applicera migration på Supabase dev-projekt
- Testa manuellt: registrera ny användare -> kontrollera public.User

## Risker och felhantering

| Risk | Hantering |
|------|-----------|
| Trigger failar -> sign-up failar | `ON CONFLICT DO NOTHING` förhindrar duplicate-krasch. Övriga fel bubblar upp till Supabase Auth som returnerar 500. |
| auth-schemat finns inte lokalt | Migration med `--create-only`, trigger refererar `auth.users` som bara finns på Supabase. Lokalt: `prisma migrate resolve --applied`. |
| Obligatoriska fält saknas i metadata | `COALESCE` med defaults: userType='customer', firstName='', lastName='' |
| passwordHash NOT NULL | Sätts till tom sträng -- Supabase Auth hanterar lösenord |

## Tester

Eftersom auth-schemat inte finns i lokal Docker-databas, testar vi i två lager:

1. **Unit-test av SQL-logiken**: Verifiera att funktionens SQL producerar rätt INSERT givet olika input-varianter. Kan göras med en wrapper som anropar funktionens logik direkt.

2. **Manuell verifiering mot Supabase**: Efter deploy av migrationen, registrera en användare via Supabase Auth och verifiera att public.User skapas.

## Acceptanskriterier

- [ ] Ny Supabase Auth-registrering skapar public.User
- [ ] UUID matchar mellan auth.users och public.User
- [ ] userType, firstName, lastName synkas från raw_user_meta_data
- [ ] Trigger-fel ger tydligt felmeddelande (Supabase 500)
- [ ] ON CONFLICT DO NOTHING förhindrar duplicerade rader
- [ ] Migration applicerad på Supabase dev-projekt
