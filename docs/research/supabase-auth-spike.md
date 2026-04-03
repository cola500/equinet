---
title: "Supabase Auth Spike -- Kan Supabase sköta autentisering?"
description: "Research-spike: vad innebär det att migrera från NextAuth v5 till Supabase Auth?"
category: research
status: active
last_updated: 2026-04-03
tags: [auth, supabase, nextauth, migration, spike]
sections:
  - Sammanfattning
  - Bakgrund -- Nuvarande auth-system
  - Supabase Auth -- Vad erbjuds
  - Fråga 1 -- Next.js App Router-integration
  - Fråga 2 -- Custom JWT claims
  - Fråga 3 -- Prisma-samexistens
  - Fråga 4 -- iOS-appen
  - Fråga 5 -- RLS-koppling
  - Fråga 6 -- Migrering av befintliga användare
  - Fråga 7 -- Säkerhet och rate limiting
  - Fråga 8 -- Kostnad
  - Jämförelsetabell
  - Migreringsinsats
  - Rekommendation
---

# Supabase Auth Spike -- Kan Supabase sköta autentisering?

## Sammanfattning

**Rekommendation: Ja, Supabase Auth är ett starkt alternativ som förenklar arkitekturen.**

Största vinsten: unified auth för webb + iOS (eliminerar dual auth-systemet), inbyggd RLS-koppling, och mindre egen kod att underhålla. Största risken: migreringen är omfattande (~3-5 sprints) och berör middleware, alla API-routes, iOS-appen, och användardata.

**Föreslaget nästa steg:** Proof-of-concept med en ny test-route som använder Supabase Auth parallellt med NextAuth, utan att röra befintlig funktionalitet.

---

## Bakgrund -- Nuvarande auth-system

Equinet använder **NextAuth v5 (beta)** med Credentials-provider (email + lösenord).

| Komponent | Nuvarande lösning |
|-----------|-------------------|
| Webb-session | JWT-baserad via NextAuth, httpOnly-cookie, 24h maxAge |
| iOS native | Eget JWT-system: `MobileTokenService` (jose HS256, SHA-256 hash i DB, 90d expiry) |
| iOS WebView | NextAuth session-cookie (separat från native JWT) |
| Lösenord | bcrypt, 10 salt rounds |
| Rate limiting | Upstash Redis, custom per endpoint |
| Email-verifiering | Egen token-baserad flow |
| Lösenordsåterställning | Egen token-baserad flow |
| Middleware | Edge-kompatibel, roll-baserad routing |
| Användarmodell | Prisma `User` med `passwordHash`, `userType`, `isAdmin`, `providerId` |

**Smärtpunkter med nuvarande system:**

1. **Dual auth**: Två separata auth-system (NextAuth-cookie + custom JWT) som måste synkas
2. **Underhållsbörda**: Egen kod för email-verifiering, lösenordsåterställning, token-rotation
3. **NextAuth beta**: v5 är fortfarande beta, API-ändringar mellan versioner
4. **Ingen RLS-koppling**: Auth-tokens kopplar inte till databas-nivå säkerhet

---

## Supabase Auth -- Vad erbjuds

Supabase Auth (GoTrue) är en komplett auth-tjänst som ingår i varje Supabase-projekt.

**Auth-metoder:**

| Metod | Status |
|-------|--------|
| Email + lösenord | Tillgänglig |
| Magic link (email) | Tillgänglig |
| Email OTP (6-siffrig kod) | Tillgänglig |
| Telefon OTP (SMS via Twilio) | Tillgänglig |
| OAuth (Google, Apple, GitHub, 20+ providers) | Tillgänglig |
| Anonym inloggning | Tillgänglig |
| SAML SSO | Pro-plan |
| MFA/TOTP | Tillgänglig (gratis) |

Equinet använder idag bara email + lösenord. Med Supabase Auth kan vi enkelt lägga till Google/Apple-inloggning i framtiden utan egen implementation.

---

## Fråga 1 -- Next.js App Router-integration

**Svar: Väl stödd via `@supabase/ssr`.**

Supabase erbjuder `@supabase/ssr` (ersätter deprecated `@supabase/auth-helpers-nextjs`) med tre utility-filer:

1. **Browser-klient** -- `createBrowserClient()` för klient-komponenter
2. **Server-klient** -- `createServerClient()` med cookie-hantering för Server Components/API routes
3. **Middleware** -- Refreshar tokens via `supabase.auth.getUser()`

**Viktiga gotchas:**

- `getSession()` validerar INTE JWT-signaturen server-side. Använd ALLTID `getUser()` för auth-checks (eller `getClaims()` med JWT-secret för snabbare validering).
- `getUser()` gör ett nätverksanrop till Supabase Auth-servern (~50-100ms). För performance-kritiska paths kan `getClaims()` vara bättre.
- Middleware MÅSTE anropa `getUser()` för att refresha tokens -- Server Components kan inte skriva cookies själva.
- Session lagras i httpOnly-cookies, automatiskt chunked om JWT överstiger 4KB.

**Jämförelse med nuvarande:**

| Aspekt | NextAuth v5 | Supabase Auth |
|--------|-------------|---------------|
| Session-strategi | JWT i cookie | JWT i cookie (chunked) |
| Token-refresh | Via `update` trigger | Automatiskt i middleware |
| Server-validering | Lokal JWT-dekoding | `getUser()` (nätverksanrop) eller `getClaims()` |
| Edge-kompatibel | Ja | Ja |

---

## Fråga 2 -- Custom JWT claims (userType, providerId, stableId)

**Svar: Möjligt via Custom Access Token Hook (PostgreSQL-funktion).**

Man skapar en PL/pgSQL-funktion som körs vid varje token-utfärdande:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer as $$
declare
  claims jsonb;
  app_user record;
begin
  claims := event->'claims';

  select u."userType", u."isAdmin", p.id as provider_id, u."stableId"
  into app_user
  from public."User" u
  left join public."Provider" p on p."userId" = u.id
  where u.id = (event->>'user_id')::uuid;

  if app_user is not null then
    claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'));
    claims := jsonb_set(claims, '{app_metadata, userType}', to_jsonb(app_user."userType"));
    claims := jsonb_set(claims, '{app_metadata, isAdmin}', to_jsonb(app_user."isAdmin"));
    if app_user.provider_id is not null then
      claims := jsonb_set(claims, '{app_metadata, providerId}', to_jsonb(app_user.provider_id));
    end if;
    event := jsonb_set(event, '{claims}', claims);
  end if;

  return event;
end;
$$;
```

**Gotchas:**

- Claims uppdateras vid token-refresh, inte i realtid. Om `userType` ändras kan det ta upp till session-refresh-intervallet.
- Reserverade claims (`iss`, `aud`, `exp`, `sub`, `role`, `provider`, `providers`) får INTE tas bort.
- Funktionen körs vid varje token-utfärdande/refresh -- håll den snabb (enkel SELECT).
- Många custom claims ökar JWT-storleken. Håll det minimalt.
- Åtkomst i RLS: `auth.jwt()->'app_metadata'->>'providerId'`.

---

## Fråga 3 -- Prisma-samexistens

**Svar: Fungerar, men kräver en sync-trigger.**

Supabase Auth hanterar `auth.users` i `auth`-schemat. Prisma hanterar `public`-schemat. Prisma stödjer INTE cross-schema foreign keys.

**Rekommenderad approach:**

1. Behåll Prismas `User`-tabell i `public`-schemat
2. Använd **samma UUID** som Supabase Auth genererar som `User.id`
3. Skapa en databas-trigger som synkar `auth.users` → `public.User`:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public."User" (
    id, email, "userType", "firstName", "lastName", "passwordHash",
    "emailVerified", "emailVerifiedAt"
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'userType', 'customer'),
    coalesce(new.raw_user_meta_data->>'firstName', ''),
    coalesce(new.raw_user_meta_data->>'lastName', ''),
    '',  -- lösenord hanteras av Supabase Auth
    new.email_confirmed_at is not null,
    new.email_confirmed_at
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

4. `passwordHash`-kolumnen i `User` kan fasas ut (Supabase Auth lagrar lösenord i `auth.users`)
5. Prisma-migrationer rör ALDRIG `auth`-schemat

**Gotchas:**

- Om triggern failar, failar sign-up. Robust error-handling i PL/pgSQL krävs.
- Prisma `multiSchema` preview feature finns men rekommenderas INTE -- `migrate dev` kan försöka droppa `auth.users`.

---

## Fråga 4 -- iOS-appen

**Svar: Supabase Swift SDK hanterar allt vi byggt manuellt.**

| Aspekt | Nuvarande (custom) | Supabase Swift SDK |
|--------|--------------------|--------------------|
| Token-lagring | Manuell Keychain | Keychain automatiskt |
| Token-refresh | Manuell rotation via `/refresh` | Automatiskt 60s före expiry |
| Max tokens per user | 5 (egen logik) | Obegränsat (managed) |
| Auth-metoder | Bara email+lösenord | Email, OAuth, magic link, anon |
| Kodunderhåll | `MobileTokenService` + `PrismaMobileTokenRepository` + 3 API routes | 0 egen kod |

**Vinst:** Eliminerar `MobileTokenService`, `authFromMobileToken()`, `mobile-auth.ts`, och alla `/api/auth/mobile-token/*` routes. iOS-appen använder samma Supabase-session som webben -- inget dual auth-system.

**WebView-integration:** Supabase-sessionen kan delas med WKWebView via cookies (samma mekanism som idag, men unified).

---

## Fråga 5 -- RLS-koppling

**Svar: Supabase Auth + RLS ger defense-in-depth -- men bara via Supabase-klienten.**

Med Supabase Auth kan RLS-policies använda:
- `auth.uid()` -- användarens UUID
- `auth.jwt()->'app_metadata'->>'providerId'` -- custom claims

**VIKTIGT:** Prisma ansluter med `service_role` som **kringgår RLS**. RLS fungerar bara när man använder Supabase-klienten med användarens JWT (anon key + user token).

**Konsekvens för Equinet:**
- Befintliga Prisma-queries (repositories) behöver INTE ändras
- RLS ger en extra säkerhetsnivå för nya routes/features som använder Supabase-klienten
- Matchar den gradvisa RLS-roadmapen i `docs/architecture/rls-roadmap.md`

---

## Fråga 6 -- Migrering av befintliga användare

**Svar: Tekniskt möjligt, men kräver planering.**

### Lösenords-hash

Supabase Auth använder bcrypt (samma som Equinet). Kolumnen `auth.users.encrypted_password` accepterar bcrypt-hashar. Migration via direkt SQL:

```sql
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
)
select
  u.id::uuid,
  u.email,
  u."passwordHash",
  case when u."emailVerified" then u."emailVerifiedAt" else null end,
  jsonb_build_object(
    'firstName', u."firstName",
    'lastName', u."lastName",
    'userType', u."userType"
  ),
  u."createdAt",
  u."updatedAt"
from public."User" u
where u."isManualCustomer" = false;
```

### User IDs

Equinet använder UUID:er (`@default(uuid())`). Supabase Auth genererar egna UUID:er. Två alternativ:

1. **Behåll befintliga ID:er** -- Infoga med samma UUID i `auth.users.id`. Alla FK:er behåller sina värden. **Rekommenderat.**
2. **Nya ID:er** -- Kräver uppdatering av alla FK-kolumner. Onödigt komplext.

### Sessioner

Alla användare måste logga in på nytt efter migrering. Inga sessioner kan migreras.

---

## Fråga 7 -- Säkerhet och rate limiting

**Svar: Inbyggt skydd som ersätter delar av vår custom-logik.**

| Skydd | Nuvarande (custom) | Supabase Auth (inbyggt) |
|-------|--------------------|-----------------------|
| Login rate limit | Upstash Redis, 10/15min | Token bucket, 30/bucket/IP |
| Registrering rate limit | Upstash Redis, 3/timme | Inbyggt |
| Email rate limit | - | 2/timme (inbyggd SMTP), 30/timme (custom SMTP) |
| CAPTCHA | - | hCaptcha/Turnstile-integration |
| Brute force | Egen logik | fail2ban |
| PKCE | - | Default för SSR |
| MFA | - | TOTP (gratis) |

**OBS:** Rate limiting för icke-auth API routes (bookings, routes, etc.) behöver fortfarande Upstash Redis.

---

## Fråga 8 -- Kostnad

| | Free | Pro ($25/mån) |
|---|------|---------------|
| MAU | 50 000 | 100 000 |
| Auth-anrop | Obegränsat | Obegränsat |
| MFA | Ja | Ja |
| Custom SMTP | Ja | Ja |
| Auth Hooks | Ja | Ja |
| SAML SSO | Nej | Ja |

Equinet har idag ~50 aktiva användare. Free tier räcker med god marginal. Pro-planen ($25/mån) som redan används för Storage täcker auth utan extra kostnad.

---

## Jämförelsetabell

| Aspekt | NextAuth v5 (nuvarande) | Supabase Auth |
|--------|------------------------|---------------|
| **Underhåll** | Egen kod: email-verifiering, lösenordsåterställning, token-rotation, rate limiting | Managed tjänst |
| **Stabilitet** | Beta (v5), API-ändringar | Stabil, versionerad |
| **iOS-integration** | Custom dual auth (JWT + cookie) | Unified via Swift SDK |
| **RLS-koppling** | Ingen | Direkt via `auth.uid()` och custom claims |
| **OAuth/social login** | Kräver egen implementation | 20+ providers out-of-the-box |
| **MFA** | Saknas | TOTP inbyggt |
| **Kodmängd att underhålla** | ~15 filer, ~2000 LOC | ~5 filer, ~300 LOC |
| **Vendor lock-in** | Låg (NextAuth är open source) | Medel (GoTrue är open source, men hooks/triggers är Supabase-specifika) |
| **Migreringsinsats** | - | Hög (3-5 sprints) |

---

## Migreringsinsats

### Faser

**Fas 0: Proof-of-concept (1 sprint)**
- Supabase Auth-klient setup (`@supabase/ssr`)
- Custom Access Token Hook med `userType`, `providerId`
- EN test-route som autenticerar via Supabase Auth
- Verifiera token-refresh i middleware
- iOS: testa Supabase Swift SDK login-flow

**Fas 1: Parallell drift (1-2 sprints)**
- Nya routes använder Supabase Auth
- Befintliga routes använder fortfarande NextAuth
- Helper-funktion som stödjer båda auth-system
- Databasmigrering: kopiera befintliga användare till `auth.users`

**Fas 2: Migration av befintliga routes (1-2 sprints)**
- Migrera API routes från `auth()` till `supabase.auth.getUser()`
- Migrera middleware
- Migrera iOS från `MobileTokenService` till Supabase Swift SDK
- Uppdatera klient-komponenter från `useSession()` till Supabase `onAuthStateChange`

**Fas 3: Cleanup (0.5 sprint)**
- Ta bort NextAuth, `MobileTokenService`, custom token-routes
- Ta bort `passwordHash` från `User`-modellen
- Ta bort `MobileToken`-modellen
- Uppdatera dokumentation

### Berörda filer (~40+)

| Kategori | Filer |
|----------|-------|
| Auth-konfiguration | `auth.ts`, `auth.config.ts`, `auth-server.ts`, `middleware.ts` |
| Mobile auth | `mobile-auth.ts`, `MobileTokenService.ts`, `PrismaMobileTokenRepository.ts` |
| Auth routes (7 st) | `register`, `native-login`, `verify-email`, `forgot-password`, `reset-password`, `mobile-token/*` |
| API routes (alla) | Varje route som anropar `auth()` eller `authFromMobileToken()` |
| Klient-komponenter | Alla som använder `useSession()` |
| iOS | `AuthManager.swift`, `APIClient.swift`, `WebView.swift` |
| Prisma | `schema.prisma` (User, MobileToken) |
| Typer | `next-auth.d.ts`, `auth.ts` |

### Risker

| Risk | Sannolikhet | Impact | Mitigation |
|------|------------|--------|-----------|
| Alla användare måste logga in på nytt | Säker | Medel | Kommunicera i förväg, planera tidpunkt |
| Trigger-fel vid sign-up | Låg | Hög | Testa grundligt, monitoring |
| JWT-storlek > 4KB med custom claims | Låg | Medel | Minimera claims, testa med Chrome |
| `getUser()` latency (50-100ms) | Medel | Låg | Använd `getClaims()` för snabba paths |
| iOS-app kräver uppdatering samtidigt | Säker | Medel | App Store review-tid inplanerad |

---

## Rekommendation

**Gör Fas 0 (proof-of-concept) som nästa steg.**

Motivering:
1. **Vinsten är tydlig**: Unified auth, mindre kod, RLS-koppling, OAuth-möjlighet, MFA
2. **Risken är hanterbar**: Parallell drift möjliggör gradvis migrering
3. **Kostnad = 0**: Auth ingår i befintlig Supabase-plan
4. **Timing**: Bättre att migrera nu med ~50 användare än med 500

PoC:n bekräftar att custom claims fungerar, att Prisma-sync-triggern är stabil, och att iOS Swift SDK integrerar smidigt. Om PoC:n visar problem -- avbryt utan att ha rört befintlig funktionalitet.

---

## Källor

- [Supabase Auth docs -- Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Auth -- Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase Auth -- Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase Swift SDK](https://github.com/supabase/supabase-swift)
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Pricing](https://supabase.com/pricing)
- [Prisma + Supabase integration](https://supabase.com/docs/guides/database/prisma)
- Equinets RLS-spike: `docs/research/rls-spike.md`
- Equinets RLS-roadmap: `docs/architecture/rls-roadmap.md`
