---
title: "S13-5: Registrering via Supabase Auth"
description: "Byt registreringssidan från custom endpoint till supabase.auth.signUp()"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Bakgrund
  - Approach
  - Filer som ändras
  - Filer som INTE ändras
  - Ghost user-hantering
  - Provider-registrering
  - Risker
  - Testplan
---

# S13-5: Registrering via Supabase Auth

## Bakgrund

Registreringen använder idag en helt custom kedja:
1. Klient -> `POST /api/auth/register` -> AuthService.register()
2. AuthService hashar lösenord med bcrypt, skapar User i Prisma
3. Genererar verifieringstoken (24h), skickar email via Resend
4. Redirect till `/check-email`

Sprint 11 skapade en sync-trigger (`handle_new_user`) som automatiskt skapar
`public.User` vid Supabase Auth signUp, med `raw_user_meta_data` för namn.

**Mål:** Registrering sker via `supabase.auth.signUp()`. Supabase hanterar
lösenord och email-verifiering. Sync-triggern skapar public.User.

## Approach

### Fas 1: Byt klient-sidan (register page)

Byt `fetch("/api/auth/register")` till `supabase.auth.signUp()`:

```typescript
const supabase = createSupabaseBrowserClient()
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { firstName, lastName, phone, userType }
  }
})
```

- Behåll Zod-validering (klient-side) för lösenordsstyrka
- Behåll PasswordStrengthIndicator
- Behåll userType-väljare och provider-fält
- Redirect till `/check-email` vid success
- Hantera "User already registered" och "not confirmed" från Supabase

### Fas 2: Utöka sync-trigger för provider

Nuvarande trigger sätter alltid `userType: 'customer'`. Behöver läsa
`raw_user_meta_data->>'userType'` och skapa Provider-profil om 'provider'.

Uppdatera `handle_new_user()`:
- Läs userType från metadata (default 'customer' om saknas)
- Om 'provider': skapa även Provider + Stable med businessName från metadata
- Phone från metadata

### Fas 3: Uppdatera API route (behåll som fallback)

`/api/auth/register` behålls tills vidare men refaktoreras:
- Tar emot samma data
- Anropar `supabase.auth.admin.createUser()` server-side istället för bcrypt
- Behåller rate limiting och sanitering
- Används av: ghost user upgrade, accept-invite

Alternativt: ta bort routen helt och låt allt gå via klient-side signUp.
**Beslut:** Behåll routen för ghost user upgrade. Ny registrering går via klient.

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/app/(auth)/register/page.tsx` | Byt till supabase.auth.signUp() |
| `prisma/migrations/<ts>_extend_sync_trigger/migration.sql` | Provider-skapande + phone + userType |
| `src/app/(auth)/check-email/page.tsx` | Ev. uppdatera text (Supabase skickar email) |
| `src/app/api/auth/register/route.ts` | Behåll för ghost user, markera som legacy |
| `src/app/api/auth/register/route.test.ts` | Uppdatera tester |
| `src/app/api/auth/register/route.integration.test.ts` | Uppdatera tester |

## Filer som INTE ändras

- `src/domain/auth/AuthService.ts` -- behålls för ghost user upgrade och accept-invite
- `src/lib/validations/auth.ts` -- Zod-schema behålls (klient-validering)
- `src/lib/supabase/browser.ts` -- redan korrekt
- `src/app/(auth)/supabase-login/` -- tas bort i S13-2 (inte vår scope)
- `middleware.ts` -- ingen ändring

## Ghost user-hantering

Ghost users (`isManualCustomer: true`) har redan en User-rad i Prisma.
Supabase signUp skapar ny rad i `auth.users`, sync-triggern kör
`ON CONFLICT (id) DO NOTHING` -- men ID:t matchar inte (UUID vs befintligt).

**Lösning:** Behåll `/api/auth/register` för ghost user upgrade-flödet.
Klient-sidan kollar först om email tillhör ghost user via servern,
och faller tillbaka till custom register-routen om så.

Enklare alternativ: låt Supabase signUp skapa ny auth.user,
sync-triggern matchar på email istället för id (ON CONFLICT (email)).
**Risk:** Dubbla User-rader. Avvakta -- ghost user upgrade är edge case.

**Beslut:** Fas 1 hanterar bara nya användare. Ghost user upgrade
behålls via befintlig route tills S13-2 (cleanup).

## Provider-registrering

Sync-triggern behöver utökas:

```sql
-- Läs userType (default 'customer')
v_user_type := COALESCE(NEW.raw_user_meta_data->>'userType', 'customer');

-- Skapa User med rätt userType
INSERT INTO public."User" (..., "userType") VALUES (..., v_user_type);

-- Om provider: skapa Provider + Stable
IF v_user_type = 'provider' THEN
  INSERT INTO public."Provider" (id, "userId", "businessName", ...)
  VALUES (gen_random_uuid(), NEW.id, COALESCE(NEW.raw_user_meta_data->>'businessName', ''), ...);
END IF;
```

**Säkerhetsnotering:** userType från metadata är user-controlled. Men detta är
registrering -- användaren VÄLJER sin roll. Inte samma risk som att eskalera
en befintlig user. Sprint 11:s trigger hardkodade 'customer' som försiktighetsåtgärd
men det var för migrerade användare, inte nya signups.

## Risker

| Risk | Mitigation |
|------|-----------|
| Supabase email-templates inte på svenska | Konfigurera i Supabase Dashboard FÖRE merge |
| Ghost user upgrade bryts | Behåll befintlig route för ghost users |
| Provider-skapande i trigger kan faila | Wrappa i BEGIN/EXCEPTION |
| Dubbla lösenordskrav (Supabase + Zod) | Behåll Zod klient-side, Supabase server-side |
| Email-verifiering via Supabase vs custom | Check-email-sidan funkar oavsett |

## Testplan

### Unit-tester (nya/uppdaterade)
- Register page: mock supabase.auth.signUp(), testa success/error/not-confirmed
- Register route: behåll befintliga tester (ghost user path)

### Manuell verifiering
- Registrera ny customer via Supabase signUp
- Registrera ny provider -- Provider+Stable skapas via trigger
- Verifiera att check-email visas
- Verifiera att email-verifieringslänk fungerar
- Verifiera att ghost user upgrade fortfarande fungerar via legacy route
