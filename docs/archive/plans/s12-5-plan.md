---
title: "S12-5: Migrera auth routes till dual-auth"
description: "Migrera 3 auth-angränsande routes från auth() till getAuthUser(request)"
category: plan
status: wip
last_updated: 2026-04-03
tags: [auth, supabase, migration]
sections:
  - Scope
  - Approach
  - Risker
---

# S12-5: Migrera auth routes till dual-auth

## Scope

3 routes behöver migreras från `auth()` (NextAuth) till `getAuthUser(request)` (dual-auth):

| Route | Metod | Nuvarande auth | Notering |
|-------|-------|---------------|----------|
| `/api/auth/mobile-token` | POST | `auth()` | DELETE använder redan `authFromMobileToken()` direkt -- behåll som-är |
| `/api/customer/onboarding-status` | GET | `auth()` | Rak migrering |
| `/api/account` | DELETE | `auth()` | GDPR-radering, känslig route |

**Ej i scope** (behöver ingen migrering):
- 7 oautentiserade routes (register, verify-email, forgot-password, reset-password, resend-verification, web-login, native-login, accept-invite)
- `/api/auth/[...nextauth]` -- NextAuth catch-all, rör inte
- `/api/auth/mobile-token/refresh` -- använder redan `authFromMobileToken()` direkt
- `/api/auth/mobile-token` DELETE -- använder redan `authFromMobileToken()` direkt
- `/api/provider/onboarding-status` -- redan migrerad (referensimplementation)
- `/api/v2/test-auth` -- Supabase PoC, inte relevant

## Approach

Förenklat stationsflöde (mekanisk migrering, bevisat mönster sedan S11-4).

Per route:
1. Byt import: `@/lib/auth-server` -> `@/lib/auth-dual`
2. Byt anrop: `auth()` -> `getAuthUser(request)`
3. Byt variabel: `session.user.id` -> `authUser.id`
4. Uppdatera tester: mock `@/lib/auth-dual` istället för `@/lib/auth-server`

### mobile-token POST specialfall

Nuvarande kod:
- POST: `auth()` (session cookie från WKWebView)
- DELETE: `authFromMobileToken(request)` (Bearer token från native)

Ny kod:
- POST: `getAuthUser(request)` -- löser rätt auth automatiskt (prio: Bearer > NextAuth > Supabase)
- DELETE: behåll `authFromMobileToken(request)` direkt -- behöver specifikt `tokenId` för revokering

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/app/api/auth/mobile-token/route.ts` | POST: auth() -> getAuthUser() |
| `src/app/api/auth/mobile-token/route.test.ts` | Mock auth-dual istället för auth-server |
| `src/app/api/customer/onboarding-status/route.ts` | auth() -> getAuthUser() |
| `src/app/api/customer/onboarding-status/route.test.ts` | Mock auth-dual |
| `src/app/api/account/route.ts` | auth() -> getAuthUser() |
| `src/app/api/account/route.test.ts` | Mock auth-dual |

## Risker

1. **mobile-token POST auth-ändring**: `getAuthUser()` provar Bearer först. Om WKWebView-anropet råkar ha en Bearer-header (borde inte ske) löser det till Bearer-auth istället för session cookie. Låg risk -- WKWebView gör vanlig fetch utan Authorization-header.
2. **Account deletion**: Känslig operation. `getAuthUser()` returnerar `AuthUser` med `.id` istället för `session.user.id`. Funktionellt identiskt -- ID:t slås upp från DB i `enrichFromDatabase()`.
