---
title: "S14-0 Done: iOS-verifiering av Supabase Auth"
description: "iOS-appen verifierad med Supabase Auth -- 2 buggar hittade och fixade"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Buggar hittade
  - Laerdomar
---

# S14-0 Done: iOS-verifiering av Supabase Auth

## Acceptanskriterier

- [x] Bygga iOS-appen mot Supabase-projektet (zzdamokfeenencuggjjp)
- [x] Login via Supabase Swift SDK
- [x] Dashboard med data
- [x] Navigation: alla tabs (Oversikt, Kalender, Bokningar, Mer)
- [x] WebView-sidor: autentiserade (Ruttplanering via session exchange)
- [x] Native skarmar: Kunder
- [x] Logout + re-login

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (validering, error handling)
- [x] Unit tests skrivna (17 auth-dual-tester, alla grona)
- [x] 4/4 quality gates grona (3905 tester)
- [x] Feature branch

## Reviews

Kordes: code-reviewer (enda relevanta -- verifieringsstory med bugfixar, ingen ny arkitektur)

## Buggar hittade och fixade

### Bugg 1: Bearer token-auth saknades i auth-dual.ts (KRITISK)

**5 Whys:**
1. Dashboard visade "logga in igen" -> API returnerade 401
2. 401 -> getAuthUser() hittade ingen auth
3. Ingen auth -> Lastes bara cookies, inte Bearer-header
4. Inget Bearer-stod -> Borttaget i S13-2 med MobileTokenService
5. Inte ersatt -> S13-6 verifierade bara webben

**Fix:** La till Supabase Bearer token-verifiering i auth-dual.ts.
Anvander `createSupabaseAdminClient().auth.getUser(token)` for att verifiera
access tokens fran iOS. Cookie-auth forst (webb), sedan Bearer (iOS).

**Filer:** `src/lib/auth-dual.ts`, `src/lib/auth-dual.test.ts`

### Bugg 2: Session exchange satte inga cookies (KRITISK)

**Orsak:** `native-session-exchange` endpoint verifierade token med
`getUser(accessToken)` men anropade aldrig `setSession()`. Utan setSession
satter Supabase SSR-klienten inga cookies.

**Fix:** iOS skickar nu aven `refreshToken` i request body.
Endpointen anropar `setSession({ access_token, refresh_token })` som
trigger cookie-sattning via SSR-klientens `setAll()` callback.

**Filer:** `src/app/api/auth/native-session-exchange/route.ts`,
`ios/Equinet/Equinet/AuthManager.swift`

## Gotcha: Supabase Auth ar global, inte per schema

Schema-isolation (`?schema=staging`) fungerar for data men INTE for auth.
`auth.users` ar global -- alla schemas delar samma auth-anvandare.
Custom Access Token Hook laser fran `public."User"`, inte schema-specifik.

**Konsekvens:** Slot machine-monstret kraver att public-schemats User-tabells
IDs matchar auth.users IDs. Seedskript maste anvanda auth.users IDn, inte
auto-genererade UUIDs.

## Laerdomar

1. **Verifiering av auth-migrering MASTE inkludera iOS** -- webben och iOS
   anvander helt olika auth-mekanismer (cookies vs Bearer). Att verifiera
   bara webben missar kritiska buggar.
2. **getUser() != setSession()** i Supabase SSR -- getUser verifierar bara,
   setSession ar det som satter cookies. Viktig skillnad.
3. **Seed med auth-matchande IDs** -- vid Supabase Auth maste User.id
   matcha auth.users.id exakt. Seedskriptet bor hamta auth-IDn forst.
