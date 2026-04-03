---
title: "S12-5: Migrera auth routes till dual-auth -- Done"
description: "3 auth-angränsande routes migrerade från auth() till getAuthUser(request)"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S12-5: Migrera auth routes till dual-auth -- Done

## Acceptanskriterier

- [x] Alla auth-relaterade routes som använder `auth()` migrerade till `getAuthUser(request)`
- [x] Tester uppdaterade och gröna
- [x] Inga beteendeändringar -- samma HTTP-statuskoder, samma response-format

## Migrerade routes

| Route | Metod | Före | Efter |
|-------|-------|------|-------|
| `/api/auth/mobile-token` | POST | `auth()` | `getAuthUser(request)` |
| `/api/customer/onboarding-status` | GET | `auth()` | `getAuthUser(request)` |
| `/api/account` | DELETE | `auth()` | `getAuthUser(request)` |

**Ej migrerade (behöver inte):**
- 8 oautentiserade routes (register, verify-email, forgot-password, reset-password, resend-verification, web-login, native-login, accept-invite)
- `/api/auth/[...nextauth]` -- NextAuth catch-all
- `/api/auth/mobile-token` DELETE -- använder `authFromMobileToken()` direkt (behöver tokenId)
- `/api/auth/mobile-token/refresh` -- använder `authFromMobileToken()` direkt
- `/api/v2/test-auth` -- Supabase PoC

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (samma auth-checks, IDOR-skydd oförändrat)
- [x] Tester uppdaterade och gröna (25 tester i berörda filer)
- [x] `npm run check:all` -- 4/4 gröna (3988 tester)
- [x] Feature branch, alla tester gröna

## Reviews

- [x] code-reviewer (obligatorisk)
- Ej relevant: security-reviewer (ingen ny auth-logik, bara byte av auth-källa)
- Ej relevant: cx-ux-reviewer (ingen UI-ändring)

## Avvikelser

Inga avvikelser från planen.

## Lärdomar

- **Scope var mindre än förväntat**: Sprint-dokumentet flaggade S12-5 som "kräver mer eftertanke" och 1-2 dagars effort. I verkligheten var det bara 3 routes som behövde migreras -- resten var oautentiserade. Mekanisk migrering på ~15 minuter.
- **mobile-token DELETE behålls som-är**: `authFromMobileToken()` returnerar `{ userId, tokenId }` -- `tokenId` behövs för revokering. `getAuthUser()` returnerar inte `tokenId`, så DELETE måste behålla direkt Bearer-auth.
- **Test-mönstret stabiliserat**: AuthUser-mock med alla fält (`id`, `email`, `userType`, `isAdmin`, `providerId`, `stableId`, `authMethod`) fungerar bra. Inget `as never` behövs.
