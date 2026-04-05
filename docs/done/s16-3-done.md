---
title: "S16-3: Onboarding leverantör #2 -- Done"
description: "Verifierat och fixat onboarding-flödet för nya leverantörer"
category: retro
status: active
last_updated: 2026-04-05
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

# S16-3: Onboarding leverantör #2 -- Done

## Acceptanskriterier

- [x] Registreringsflödet verifierat end-to-end (Supabase Auth admin.createUser)
- [x] Onboarding-checklistan (S9-8) fungerar för ny leverantör
- [x] Tomma tillstånd (S9-10) visas korrekt
- [x] Testat: registrera -> logga in -> se checklista -> profil -> tjänst
- [x] Identifierat och fixat gap i flödet (businessName-validering)
- [x] E2E-test för onboarding-flödet

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (Zod superRefine-validering, error handling)
- [x] Unit tests skrivna FÖRST (TDD), E2E-test, coverage OK
- [x] Feature branch, alla tester gröna (3970 unit + 2 E2E onboarding)
- [x] check:all 4/4 gröna (typecheck, test, lint, swedish)

## Reviews körda

- [x] code-reviewer (station 4)
- Ej relevant: security-reviewer (ingen ny API route skapad)
- Ej relevant: cx-ux-reviewer (ingen ny UI skapad, bara label-ändring)

## Avvikelser

### E2E service-skapande skippat

GET /api/services migrerades till Supabase-klient med RLS i S14. Lokalt
(Docker utan RLS) returnerar Supabase alla tjänster, inte bara leverantörens.
E2E-testet för tjänsteskapande kräver RLS-environment och är skippat lokalt.
Täcks av unit tests.

## Identifierade gap (fixade)

### 1. businessName valfritt vid leverantörsregistrering (FIXAT)

**Problem**: Zod-schemat i `src/lib/validations/auth.ts` hade `businessName: z.string().optional()`
oavsett userType. En leverantör kunde registrera sig utan företagsnamn, vilket
resulterade i att AuthService inte skapade Provider-record (`providerId=null`).

**Fix**: `superRefine`-validering som kräver businessName när `userType === 'provider'`.

**Root cause**: Schemat designades med alla provider-fält som optional, men
AuthService.register() kräver businessName för att skapa Provider.

## Identifierade NON-issues (verifierade som OK)

- **Login-redirect**: Fungerar korrekt -- `/dashboard` redirectar baserat på userType
- **Middleware**: Skyddar provider/customer/admin-routes korrekt
- **Tomma tillstånd**: Finns på alla sidor (dashboard, tjänster, bokningar, kunder)
- **Onboarding-checklista**: 4 steg, auto-hides vid komplett, 7-dagars dismiss
- **Tillgänglighetsschema**: Auto-skapar default (09-17 alla dagar)
- **Geocoding**: Manuellt via "Sök adress"-knapp, fungerar med Nominatim

## Lärdomar

1. **RLS-migrering skapar lokal/remote-divergens**: GET-routes som migrerades till
   Supabase-klient i S14 fungerar bara korrekt med RLS. Lokalt utan RLS returneras
   alla rader. E2E-tester som verifierar per-provider data behöver RLS-environment.

2. **Lokal Docker saknar triggers**: `handle_new_user`-trigger existerar inte i
   Docker-postgres. E2E-seeding behöver fallback för att skapa User manuellt.

3. **Migrationer kan bli out-of-sync**: 5 migrationer var inte applicerade lokalt,
   inklusive RLS-policies (kräver Supabase auth-schema) och remove_password_hash.
   `prisma migrate resolve --applied` behövdes för RLS-migrationer.
