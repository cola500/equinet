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
  - Review-fynd
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

1. `auth-server.ts` + `middleware.ts`: byt ATOMART (samma commit).
   auth-server byter internals till Supabase. Middleware tar bort NextAuth-wrapper.
2. `auth-dual.ts`: ta bort Bearer + NextAuth-grenar. Bara Supabase kvar.
3. Klientkomponenter: byt `useSession`/`signOut` till Supabase.
4. Radera NextAuth-filer, mobile token-filer, beroenden.

## Faser

### Fas 1: auth-server.ts + middleware.ts (ATOMART)

**auth-server.ts**: Byt `auth()` fran NextAuth till Supabase. Returnera samma session-shape:
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

KRITISKT: Om DB-lookup returnerar null -> throw 401 Response (befintligt beteende).
Returnera ALDRIG ett partiellt sessionobjekt.

**middleware.ts**: Ta bort NextAuth, använd bara Supabase.
KRITISKT: Middleware MASTE trigga cookie-refresh via korrekt Supabase SSR-monster:
```typescript
// Skapa response FORST, lat Supabase satta cookies pa den
const response = NextResponse.next({ request: req })
const supabase = createServerClient(..., {
  cookies: {
    getAll() { return req.cookies.getAll() },
    setAll(cookies) { cookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)) }
  }
})
await supabase.auth.getUser()  // INTE getSession -- triggar refresh
```

### Fas 2: auth-dual.ts forenkling

- Ta bort Bearer-path (rad 34-42)
- Ta bort NextAuth-path (rad 44-59)
- Behall bara Supabase-path (rad 62-70)
- `authMethod` blir bara `"supabase"` (ta bort "bearer"/"nextauth" fran typen)

### Fas 3: Klientkomponenter

| Komponent | Ändring |
|-----------|--------|
| `SessionProvider.tsx` | NextAuth SessionProvider -> Supabase session via context |
| `useAuth.ts` | `useSession()` -> Supabase `onAuthStateChange` + user |
| `Header.tsx` | `signOut("next-auth/react")` -> `supabase.auth.signOut()` |
| `DeleteAccountDialog.tsx` | Samma som Header |
| `stable/profile/page.tsx` | `useSession()` -> `useAuth()` (redan wrappad) |

KRITISKT: signOut MASTE ocksa rensa NextAuth-cookies explicit:
```typescript
// Rensa kvarliggande NextAuth-cookies
document.cookie = "next-auth.session-token=; Max-Age=0; path=/"
document.cookie = "__Secure-next-auth.session-token=; Max-Age=0; path=/; secure"
```

### Fas 4: Ta bort filer

Se "Filer att ta bort" nedan.

### Fas 5: Beroenden

- Ta bort `next-auth` fran package.json
- Ta bort `next-auth.d.ts` typfil
- npm install for att uppdatera lockfile

OBS: MobileToken Prisma-modell tas INTE bort har -- flyttas till S13-3
(schema-ändring efter produktionsvalidering av auth).

### Fas 6: Verifiering

- `npm run check:all` (typecheck + test + lint + swedish)
- Manuell login-test (om dev-server kors)

## Review-fynd (tech-architect + security-reviewer)

### Atagardat i planen

1. **Middleware cookie-refresh** (blocker): `setAll` maste satta cookies pa response.
   Fixat i Fas 1 med korrekt Supabase SSR-monster.
2. **Null-guard vid DB-lookup** (kritiskt): auth() maste returnera null/throw, aldrig
   partiellt objekt. Fixat i Fas 1.
3. **NextAuth-cookie cleanup** (kritiskt): signOut maste rensa kvarliggande cookies.
   Fixat i Fas 3.
4. **Fas 1+3 atomicitet** (major): auth-server + middleware i samma commit.
   Fixat i strategin.
5. **MobileToken schema-drop** (major): Flyttat till S13-3 for sakrare rollback.

### Accepterade risker

6. **Extra DB-roundtrip per request**: Redan monstret i auth-dual (75 routes).
   Minimal overhead -- en findUnique by PK. Cachning adderas vid behov.
7. **isAdmin JWT-crosscheck**: DB-lookup ar standard i projektet. RLS ger
   extra skydd pa DB-niva. Godtagbart utan JWT-dubbelkoll.

## Risker

| Risk | Mitigation |
|------|-----------|
| 135 routes som använder `auth()` | Drop-in replacement -- samma interface |
| Session-shape mismatch | Prisma-lookup ger exakt samma falt |
| Middleware cookie-refresh | Korrekt Supabase SSR-monster med setAll pa response |
| Kvarliggande NextAuth-cookies | Explicit rensning i signOut |
| Tester som mockar `auth()` | Mock-interfacet andras inte |
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
- `src/lib/mobile-auth.test.ts`
- `src/domain/auth/__tests__/MobileTokenService.test.ts`
- `src/app/api/auth/native-login/` alla tester
- `src/app/api/auth/mobile-token/` alla tester

## Filer att andra

- `src/lib/auth-server.ts` -- byt NextAuth -> Supabase (behall interface)
- `src/lib/auth-dual.ts` -- ta bort Bearer + NextAuth, bara Supabase
- `src/lib/auth-dual.test.ts` -- uppdatera tester
- `middleware.ts` -- ta bort NextAuth, använd Supabase med cookie-refresh
- `src/lib/auth-supabase-edge.ts` -- eventuell uppdatering for cookie-refresh
- `src/components/providers/SessionProvider.tsx` -- byt till Supabase
- `src/hooks/useAuth.ts` -- byt useSession till Supabase
- `src/components/layout/Header.tsx` -- byt signOut + rensa NextAuth-cookies
- `src/components/account/DeleteAccountDialog.tsx` -- byt signOut
- `src/app/stable/profile/page.tsx` -- byt useSession till useAuth
- `package.json` -- ta bort next-auth

## Definition of Done

- [ ] `auth()` i auth-server returnerar samma session-shape via Supabase
- [ ] `auth()` returnerar null/throw 401 vid saknad DB-rad (aldrig partiellt objekt)
- [ ] auth-dual bara har Supabase-path
- [ ] middleware använder bara Supabase med korrekt cookie-refresh
- [ ] signOut rensar bade Supabase- och NextAuth-cookies
- [ ] Klientkomponenter använder Supabase for session + signOut
- [ ] Alla NextAuth + mobile token filer borttagna
- [ ] `next-auth` borttagen fran package.json
- [ ] `npm run check:all` 4/4 grona
- [ ] Inga imports av `next-auth` kvar i kodbasen
- [ ] `app_metadata.userType` + `app_metadata.isAdmin` verifierat i Supabase
