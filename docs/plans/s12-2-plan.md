---
title: "S12-2: Migrera booking routes till dual-auth"
description: "Byt auth() mot getAuthUser() i alla booking API routes"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Scope
  - Approach
  - Filer som andras
  - Risker
---

# S12-2: Migrera booking routes till dual-auth

## Bakgrund

Sprint 11-4 bevisade migreringsmonstret: `auth()` -> `getAuthUser(request)`.
`getAuthUser()` i `src/lib/auth-dual.ts` provar i ordning: Bearer JWT -> NextAuth -> Supabase Auth.
Alltid DB-lookup for providerId/stableId/isAdmin.

## Scope

4 route-filer, 7 HTTP-handlers:

| Fil | Handlers | Nuvarande auth |
|-----|----------|---------------|
| `src/app/api/bookings/route.ts` | GET, POST | `auth()` direkt |
| `src/app/api/bookings/[id]/route.ts` | GET, PUT, DELETE | PUT: manuell dual-auth, ovriga: `auth()` |
| `src/app/api/bookings/[id]/payment/route.ts` | GET, POST | `requireAuth(auth())` |
| `src/app/api/bookings/manual/route.ts` | POST | `auth()` direkt |

## Approach

Mekanisk migrering, samma monster for alla:

1. **Import**: `auth` fran `auth-server` -> `getAuthUser` fran `auth-dual`
2. **Anrop**: `await auth()` -> `await getAuthUser(request)`
3. **Null-check**: `!session` -> `!authUser`, return 401
4. **Properties**: `session.user.id` -> `authUser.id`, `session.user.userType` -> `authUser.userType`
5. **Specialfall PUT**: Ta bort manuell Bearer-check, ersatt med `getAuthUser()`
6. **Specialfall payment**: Ta bort `requireAuth()` wrapper, använd direkt null-check

Stationsflode: Plan -> Red -> Green -> Review -> Verify -> Merge

### TDD

- Uppdatera befintliga tester: mock `getAuthUser` istallet for `auth`
- Varje route far test som verifierar 401 nar `getAuthUser` returnerar null
- Befintliga beteendetester ska fortfarande passera (bara auth-mocken andras)

## Filer som andras

**Route-filer (4):**
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/app/api/bookings/[id]/payment/route.ts`
- `src/app/api/bookings/manual/route.ts`

**Test-filer (4):**
- `src/app/api/bookings/route.test.ts`
- `src/app/api/bookings/[id]/route.test.ts`
- `src/app/api/bookings/[id]/payment/route.test.ts`
- `src/app/api/bookings/manual/route.test.ts`

## Risker

- **Lag**: Inga -- mekanisk ändring, bevisat monster
- **PUT dual-auth**: Redan fungerar, men manuell kod ersatts med `getAuthUser()` som gor samma sak
- **requireAuth wrapper**: Maste forstas korrekt -- den kastar Response, vi byter till null-check + return
