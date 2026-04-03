---
title: "S12-3: Migrera provider routes till dual-auth"
description: "Uppdatera withApiHandler att använda getAuthUser() istället för auth()"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Approach
  - Filer som ändras
  - Steg
  - Risker
  - Tester
---

# S12-3: Migrera provider routes till dual-auth

## Approach

**Nyckelinsikt:** Alla 5 routes i scopet använder `withApiHandler`, som internt anropar `auth()` (NextAuth-only). Istället för att riva ut wrappern ur varje route (som S12-2 gjorde med booking routes som inte använde wrappern), **uppdaterar vi `withApiHandler` att använda `getAuthUser(request)`**.

Detta ger dual-auth (Bearer > NextAuth > Supabase) åt ALLA routes som använder wrappern -- inte bara S12-3s scope.

**Mönster:**
```
// Före (withApiHandler line 78):
const session = await auth()
ctx.user = requireProvider(session)

// Efter:
const authUser = await getAuthUser(request)
const sessionLike = authUser ? { user: { id: authUser.id, ... } } : null
ctx.user = requireProvider(sessionLike)
```

`requireProvider`/`requireAuth`/`requireCustomer` behöver inte ändras -- de tar `SessionLike` som redan matchar `AuthUser`-fälten.

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/lib/api-handler.ts` | Byt `auth()` -> `getAuthUser(request)`, adaptera till SessionLike |
| `src/lib/api-handler.test.ts` | Uppdatera mock: `auth` -> `getAuthUser` |
| `src/app/api/provider/profile/route.test.ts` | Uppdatera mock |
| `src/app/api/provider/customers/route.test.ts` | Uppdatera mock |
| `src/app/api/provider/customers/[customerId]/route.test.ts` | Uppdatera mock |
| `src/app/api/services/route.test.ts` | Uppdatera mock |
| `src/app/api/services/[id]/route.test.ts` | Uppdatera mock |

**Routes som INTE ändras:** Inga route-filer behöver ändras. `withApiHandler` hanterar allt.

## Steg

### Fas 1: RED -- Tester

1. Uppdatera `api-handler.test.ts`: mocka `getAuthUser` istället för `auth`
2. Verifiera att testerna failar (eftersom koden fortfarande använder `auth()`)

### Fas 2: GREEN -- Implementation

3. Ändra `api-handler.ts`:
   - Byt import: `auth` -> `getAuthUser`
   - I auth-blocket: anropa `getAuthUser(request)`, konvertera till `SessionLike`
   - Skicka vidare till befintliga `requireProvider`/`requireAuth`/`requireCustomer`
4. Kör api-handler-tester -- ska bli gröna

### Fas 3: Testerna för route-filerna

5. Uppdatera route-tester att mocka `@/lib/auth-dual` istället för `@/lib/auth-server`
6. Kör alla berörda testsviter

### Fas 4: Verify

7. `npm run check:all`

## Risker

1. **Andra routes som också använder `withApiHandler`**: Det finns ~28 routes med wrappern. Alla får dual-auth, vilket är önskat. Risk: om någon route-test mockar `auth()` direkt (inte via wrappern) kan den behöva uppdateras.
   - **Mitigation**: Sök alla test-filer som mockar `@/lib/auth-server` OCH använder `withApiHandler`.

2. **`requireProvider` tar `session.user.providerId` från session-objektet**: `getAuthUser` har `providerId` direkt på top-level. Adaptern måste mappa korrekt.
   - **Mitigation**: Mappningen är enkel och testbar.

## Tester

- `api-handler.test.ts`: Alla befintliga tester + nytt test för "autentiserar via Bearer token"
- Route-tester: Befintliga tester med uppdaterade mockar
- Manuellt: Verifiera att `npm run check:all` passerar
