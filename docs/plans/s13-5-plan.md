---
title: "S13-5: Registrering via Supabase Auth"
description: "Byt registreringssidan från custom endpoint till supabase.auth.signUp()"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Bakgrund
  - Review-findings och beslut
  - Approach
  - Filer som ändras
  - Filer som INTE ändras
  - Ghost user-hantering
  - Provider-registrering
  - Risker
  - Pre-deployment gates
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

## Review-findings och beslut

Self-review av tech-architect och security-reviewer (2026-04-04):

### Blocker: userType i trigger (FIXAD)

**Finding:** Triggern får ALDRIG läsa `userType` från `raw_user_meta_data`.
Det är user-controlled -- en angripare kan sätta `userType: 'admin'` via
direkt API-anrop. Sprint 11:s trigger hade explicit kommentar:
"NEVER read from user-controlled metadata".

**Beslut:** Triggern behålls hardkodad till `'customer'`. Provider-skapande
sker via server-side API route `/api/auth/complete-registration` EFTER
email-verifiering, med aktiv session. Se "Provider-registrering" nedan.

### Major: Ghost user-kollision (HANTERAD)

**Finding:** Om ghost user registrerar via signUp() skapas ny auth.users-rad
med nytt UUID. Sync-triggern kör ON CONFLICT (id) DO NOTHING -- men ID:t
matchar inte. Resultat: dubbla User-rader eller trigger-fail beroende på
email unique constraint.

**Beslut:** Registreringsformuläret gör server-side ghost-check FÖRE signUp().
`POST /api/auth/check-email` returnerar `{ isGhost: true }` om email tillhör
ghost user. Klienten faller tillbaka till befintlig `/api/auth/register`
för ghost user upgrade. Ny användare -> signUp().

### Major: Rate limiting (HANTERAD)

**Finding:** IP-baserad rate limiting försvinner vid klient-side signUp().

**Beslut:** Behåll server-side registration route som proxy: klient postar
till `/api/auth/register` som har rate limiting, sanitering och Zod-validering,
sedan anropar `supabase.auth.admin.createUser()` server-side.

**Alternativ:** Gå via klient-side signUp() och lita på Supabase Auth Rate
Limits. Enklare men degraderar säkerhetsnivån.

**Slutligt beslut:** Server-side proxy. Behåller all befintlig säkerhet.

### Major: Sanitering (HANTERAD med server-side proxy)

**Finding:** Med klient-side signUp() sparas osanerade strängar i metadata.

**Beslut:** Server-side proxy hanterar sanitering innan data skickas till
Supabase. Befintlig sanitering behålls.

### Major: Lösenordsstyrka (HANTERAD)

**Finding:** Zod-validering (uppercase, lowercase, number, special char) är
bara klient-side. Supabase minimum är 6 tecken.

**Beslut:** Server-side proxy validerar med Zod FÖRE `admin.createUser()`.
Dessutom: konfigurera "Strong" password strength i Supabase Dashboard.

## Approach

### Ny approach: Server-side proxy (ej klient-side signUp)

Baserat på review-findings väljer vi att behålla server-side registration
med en viktig ändring: byt bcrypt+Prisma mot `supabase.auth.admin.createUser()`.

**Flödet:**
1. Klient -> `POST /api/auth/register` (befintlig route, uppdaterad)
2. Route: rate limit -> sanitering -> Zod-validering -> ghost-check
3. Om ghost user: befintlig upgrade-path (AuthService.upgradeGhostUser)
4. Om ny user: `supabase.auth.admin.createUser()` med metadata
5. Sync-trigger skapar public.User (hardkodad customer)
6. Om userType='provider': `POST /api/auth/complete-registration` (ny route)
7. Redirect till `/check-email`

### Fas 1: Uppdatera register route

Byt `AuthService.register()` mot Supabase admin API:

```typescript
// I route.ts -- efter rate limit, sanitering, Zod
const supabase = createSupabaseAdminClient()
const { data, error } = await supabase.auth.admin.createUser({
  email: sanitizedEmail,
  password: validatedData.password,
  email_confirm: false, // Supabase skickar verifieringsmail
  user_metadata: { firstName, lastName, phone }
})
```

Behåller: rate limiting, Zod .strict(), sanitering, ghost user upgrade.
Tar bort: bcrypt, custom verifieringstokens, custom email-sending.

### Fas 2: Ny route /api/auth/complete-registration

Skapar Provider + Stable för provider-registrering:

```typescript
// POST /api/auth/complete-registration
// Kräver: aktiv Supabase-session (email verifierad)
// Body: { businessName, description, city }
```

Anropas från register-sidan EFTER signUp (som en andra stegs-submit),
eller från en onboarding-sida efter email-verifiering.

**Enklare alternativ:** Låt befintlig route hantera provider-skapande
direkt (som den gör idag via AuthService), eftersom bcrypt-bytet inte
påverkar Provider/Stable-skapandet. AuthService.register() skapar redan
Provider via repo.createProvider(). Vi behöver bara byta password-hashning
mot Supabase admin.createUser().

**Slutligt beslut:** Enklare alternativet. Behåll AuthService.register()
men byt ut steg 2 (hash password) och steg 3 (create user) mot Supabase
admin.createUser(). Steg 4 (create provider) och steg 5-6 (verification
token + email) tas bort (Supabase hanterar det).

### Fas 3: Uppdatera register page

Minimal ändring av UI:
- Ta bort ErrorState retry-logik (route hanterar allt)
- Hantera "User already registered" som success (redirect check-email)

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/domain/auth/AuthService.ts` | register() byter bcrypt mot supabase admin.createUser() |
| `src/app/api/auth/register/route.ts` | Minimal: AuthService gör jobbet |
| `src/app/(auth)/register/page.tsx` | Hantera "already registered" |
| `src/app/(auth)/check-email/page.tsx` | Uppdatera text (Supabase skickar email) |
| `src/domain/auth/AuthService.test.ts` | Uppdatera tester |
| `src/app/api/auth/register/route.test.ts` | Uppdatera tester |
| `src/app/api/auth/register/route.integration.test.ts` | Uppdatera tester |
| `src/lib/supabase/admin.ts` | Ny: createSupabaseAdminClient() |

## Filer som INTE ändras

- `prisma/migrations/` -- sync-trigger behålls som den är (hardkodad customer)
- `src/lib/validations/auth.ts` -- Zod-schema behålls
- `src/lib/supabase/browser.ts` -- redan korrekt
- `middleware.ts` -- ingen ändring
- `src/infrastructure/persistence/auth/` -- repository behålls

## Ghost user-hantering

Ghost users (`isManualCustomer: true`) har redan en User-rad i Prisma men
INTE i `auth.users`. AuthService.register() kollar `findUserByEmail()` och
kör `upgradeGhostUser()` om match.

**Med Supabase:** Ghost user upgrade fortsätter att använda bcrypt-path
(befintlig AuthService.upgradeGhostUser). Vi byter INTE till Supabase
admin.createUser() för ghost users -- de har redan en public.User-rad
och sync-triggern skulle krocka.

Flöde vid ghost user:
1. Route kollar email -> hittar ghost user
2. AuthService.upgradeGhostUser() hashar password med bcrypt, uppdaterar User
3. Skickar verifieringsmail via Resend (befintlig)
4. Ghost user loggar in via befintlig login (som redan stödjer Supabase)

**Framtida:** I S13-2 (cleanup) migrerar vi ghost users till auth.users.

## Provider-registrering

Sker i AuthService.register() steg 4 (befintlig), EFTER att Supabase-user
skapats. Ingen trigger-ändring behövs.

```
1. admin.createUser() -> auth.users rad skapas
2. sync-trigger -> public.User rad skapas (userType='customer')
3. AuthService: repo.createProvider() -> Provider + Stable skapas
4. AuthService: repo.updateUserType(userId, 'provider')
```

Steg 3-4 körs server-side med rate limiting och validering.
Trigger behålls konservativ (alltid 'customer').

## Risker

| Risk | Mitigation |
|------|-----------|
| Supabase email-templates inte på svenska | Pre-deployment gate: konfigurera FÖRE deploy |
| Ghost user upgrade krockar med sync-trigger | Ghost users använder befintlig bcrypt-path |
| Supabase admin API kräver service_role key | Redan konfigurerad som SUPABASE_SERVICE_ROLE_KEY |
| Race condition: trigger skapar User innan Provider-steg | Trigger kör synkront vid INSERT, Provider-skapande sker efter |
| userType uppdateras efter trigger | UPDATE sätter 'provider' efter INSERT satte 'customer' |

## Pre-deployment gates

- [ ] Supabase Auth Rate Limits konfigurerade (Auth > Rate Limits i dashboard)
- [ ] "Strong" password strength aktiverat i Supabase Auth Settings
- [ ] "Prevent email enumeration" aktiverat (ON by default)
- [ ] Email templates på svenska konfigurerade
- [ ] SUPABASE_SERVICE_ROLE_KEY konfigurerad i Vercel env

## Testplan

### Unit-tester (nya/uppdaterade)
- AuthService.register(): mock supabase admin.createUser(), testa success/error
- AuthService.register(): ghost user path (bcrypt, oförändrad)
- Register route: rate limiting, Zod-validering, sanitering (behålls)
- Register route: "already registered" -> generiskt svar (behålls)

### Integrationstester
- Register route: full flow med mock Supabase admin client
- Provider-registrering: User skapas + Provider skapas + userType uppdateras

### Manuell verifiering
- Registrera ny customer -> check-email visas
- Registrera ny provider -> Provider+Stable skapas
- Ghost user registrerar -> bcrypt upgrade path
- Email-verifiering via Supabase fungerar
- Supabase Dashboard: ny user synlig i auth.users
