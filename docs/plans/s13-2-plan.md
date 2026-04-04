---
title: "S13-2: Ta bort NextAuth + MobileTokenService"
description: "Cleanup -- ta bort NextAuth, mobile tokens, unified Supabase auth"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Sammanfattning
  - Nuvarande tillstand
  - Strategi
  - Faser
  - Risker
  - Filer att ta bort
  - Filer att andra
  - Definition of Done
---

# S13-2: Ta bort NextAuth + MobileTokenService

## Sammanfattning

Ta bort NextAuth och MobileTokenService. Supabase Auth blir enda auth-kallan.
Tre auth-kallor (Bearer JWT, NextAuth cookie, Supabase cookie) -> en (Supabase).

## Nuvarande tillstand

| Auth-kalla | Anvands av | Filer |
|------------|-----------|-------|
| `auth()` via NextAuth | 135 API routes + tester | `auth-server.ts` -> `auth.ts` |
| `getAuthUser()` via auth-dual | 75 API routes + tester | `auth-dual.ts` (3 kallor) |
| `useSession()` NextAuth React | 4 klientkomponenter | useAuth, SessionProvider, Header, etc |
| Bearer JWT (MobileToken) | iOS-app (redan migrerad S13-4) | `mobile-auth.ts`, `MobileTokenService.ts` |
| Supabase cookie | Middleware + auth-dual | `auth-supabase-edge.ts`, `supabase/server.ts` |

## Strategi

**Drop-in replacement** -- inte batch-migrering av 135 filer.

1. `auth-server.ts`: byt internals fran NextAuth till Supabase. Samma session-shape.
   135 filer andras INTE -- de importerar fortfarande `auth()` fran auth-server.
2. `auth-dual.ts`: ta bort Bearer + NextAuth-grenar. Bara Supabase kvar.
3. `middleware.ts`: ta bort NextAuth. Anvand bara `getSupabaseUserFromCookie`.
4. Klientkomponenter: byt `useSession`/`signOut` till Supabase.
5. Radera NextAuth-filer, mobile token-filer, beroenden.

## Faser

### Fas 1: auth-server.ts drop-in (135 routes opaverkade)

Byt `auth()` fran NextAuth till Supabase. Returnera samma session-shape:
```typescript
session.user.id        // Supabase user.id
session.user.email     // Supabase user.email
session.user.userType  // DB-lookup
session.user.isAdmin   // DB-lookup
session.user.providerId // DB-lookup
session.user.stableId  // DB-lookup
```

Prisma-lookup kravs -- Supabase JWT har bara app_metadata (userType, isAdmin).
`providerId` och `stableId` finns bara i DB.

### Fas 2: auth-dual.ts forenkling

- Ta bort Bearer-path (rad 34-42)
- Ta bort NextAuth-path (rad 44-59)
- Behall bara Supabase-path (rad 62-70)
- `authMethod` blir bara `"supabase"` (ta bort "bearer"/"nextauth" fran typen)

### Fas 3: middleware.ts omskrivning

- Ta bort `import NextAuth` och `import { authConfig }`
- Anvand bara `getSupabaseUserFromCookie(req)` (redan testad)
- Behall `handleAuthorization` oforandrad
- Exportera som standard Next.js middleware (inte NextAuth-wrapper)

### Fas 4: Klientkomponenter

| Komponent | Andring |
|-----------|--------|
| `SessionProvider.tsx` | NextAuth SessionProvider -> Supabase session via context |
| `useAuth.ts` | `useSession()` -> Supabase `onAuthStateChange` + user |
| `Header.tsx` | `signOut("next-auth/react")` -> `supabase.auth.signOut()` |
| `DeleteAccountDialog.tsx` | Samma som Header |
| `stable/profile/page.tsx` | `useSession()` -> `useAuth()` (redan wrappad) |

### Fas 5: Ta bort filer

Se "Filer att ta bort" nedan.

### Fas 6: Prisma schema + beroenden

- Ta bort `MobileToken`-modell fran schema.prisma
- Ta bort `mobileTokens` relation fran User-modell
- Skapa migration: `ALTER TABLE DROP TABLE "MobileToken"`
- Ta bort `next-auth` fran package.json
- Ta bort `next-auth.d.ts` typfil

### Fas 7: Verifiering

- `npm run check:all` (typecheck + test + lint + swedish)
- Manuell login-test (om dev-server kors)

## Risker

| Risk | Mitigation |
|------|-----------|
| 135 routes som anvander `auth()` | Drop-in replacement -- samma interface |
| Session-shape mismatch | Prisma-lookup ger exakt samma falt |
| Middleware edge-kompatibilitet | `getSupabaseUserFromCookie` redan testad i prod |
| Tester som mockar `auth()` | Mock-interfacet andras inte |
| MobileToken-tabell med data | Migration droppar tabellen -- data behovs inte langre |
| `useSession` offline-cache | Migreras till Supabase + sessionStorage-pattern |

## Filer att ta bort

### NextAuth
- `src/lib/auth.ts` (48 rader)
- `src/lib/auth.config.ts` (79 rader)
- `src/app/api/auth/[...nextauth]/route.ts` (22 rader)
- `src/types/next-auth.d.ts`

### Mobile tokens
- `src/lib/mobile-auth.ts` (123 rader)
- `src/domain/auth/MobileTokenService.ts` (185 rader)
- `src/infrastructure/persistence/mobile-token/` (4 filer)
- `src/app/api/auth/mobile-token/route.ts` + test
- `src/app/api/auth/mobile-token/refresh/route.ts` + test
- `src/app/api/auth/native-login/route.ts` + tester

### Tester
- `src/lib/auth-server.test.ts` (om finns)
- `src/lib/mobile-auth.test.ts`
- `src/domain/auth/__tests__/MobileTokenService.test.ts`
- `src/app/api/auth/native-login/` alla tester
- `src/app/api/auth/mobile-token/` alla tester

## Filer att andra

- `src/lib/auth-server.ts` -- byt NextAuth -> Supabase (behall interface)
- `src/lib/auth-dual.ts` -- ta bort Bearer + NextAuth, bara Supabase
- `src/lib/auth-dual.test.ts` -- uppdatera tester
- `middleware.ts` -- ta bort NextAuth, anvand Supabase
- `src/components/providers/SessionProvider.tsx` -- byt till Supabase
- `src/hooks/useAuth.ts` -- byt useSession till Supabase
- `src/components/layout/Header.tsx` -- byt signOut
- `src/components/account/DeleteAccountDialog.tsx` -- byt signOut
- `src/app/stable/profile/page.tsx` -- byt useSession till useAuth
- `prisma/schema.prisma` -- ta bort MobileToken
- `package.json` -- ta bort next-auth

## Definition of Done

- [ ] `auth()` i auth-server returnerar samma session-shape via Supabase
- [ ] auth-dual bara har Supabase-path
- [ ] middleware anvander bara Supabase
- [ ] Klientkomponenter anvander Supabase for session + signOut
- [ ] Alla NextAuth + mobile token filer borttagna
- [ ] MobileToken borttagen fran Prisma schema
- [ ] `next-auth` borttagen fran package.json
- [ ] `npm run check:all` 4/4 grona
- [ ] Inga imports av `next-auth` kvar i kodbasen
