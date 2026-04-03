---
title: "S11-1: Dual-auth helper"
description: "Plan för getAuthUser() som stödjer alla tre auth-systemen under parallell drift"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Design
  - Middleware
  - Filer
  - TDD-approach
  - Risker
---

# S11-1: Dual-auth helper

## Bakgrund

S10-5 bekräftade GO för Supabase Auth. Under migreringsperioden (fas 1) behöver
routes kunna autenticera via **tre** auth-system: Bearer (iOS mobile token),
NextAuth (session cookie) och Supabase Auth (Supabase cookie). Denna helper ger
en normaliserad `AuthUser` oavsett vilken auth-källa som används.

**Princip:** Befintliga routes förblir oförändrade. Nya routes (och routes som
gradvis migreras) byter från `auth()` till `getAuthUser(request)`.

## Design

### AuthUser-typ

```typescript
interface AuthUser {
  id: string              // User.id (public.User)
  email: string
  userType: string        // "provider" | "customer" | "admin"
  isAdmin: boolean
  providerId: string | null
  stableId: string | null
  authMethod: "bearer" | "nextauth" | "supabase"  // spårbarhet
}
```

### getAuthUser(request) -- flöde

**Fast prioritetsordning (ingen feature flag-styrning):**

```
1. Bearer token (Authorization: Bearer ...)
   - authFromMobileToken(request) -> userId
   - DB-lookup: User + Provider (se nedan)
   - Om giltig -> AuthUser { authMethod: "bearer" }

2. NextAuth session cookie
   - auth() -> session
   - DB-lookup: User + Provider (se nedan)
   - Om giltig -> AuthUser { authMethod: "nextauth" }

3. Supabase Auth cookie
   - createSupabaseServerClient() -> supabase.auth.getUser()
   - DB-lookup: User + Provider (se nedan)
   - Om giltig -> AuthUser { authMethod: "supabase" }

4. Inget auth -> returnera null
```

### Varför fast prioritetsordning

- **Bearer först**: iOS-appen skickar alltid Bearer-header. Snabbast att
  kontrollera (bara header-check, inget cookie-parsing). Undviker att
  session-cookies "vinner" över explicit Authorization-header.
- **NextAuth före Supabase**: Befintliga användare har NextAuth-cookies.
  Under migreringen ska de inte märka skillnad. Supabase-cookies finns
  bara hos nyinloggade via Supabase Auth.
- **Ingen feature flag**: Prioritetsordningen är deterministisk. Feature
  flag styr istället vilka *login-sidor* som används, inte auth-resolvering.

### DB-lookup för providerId (ALDRIG JWT claims)

JWT claims (både NextAuth och Supabase) kan vara stale -- t.ex. om en
provider skapas eller tas bort mellan token-utfärdande. `getAuthUser()`
gör ALLTID en databaslookup för att hämta aktuellt `providerId`,
`stableId` och `isAdmin`.

```typescript
// Alla tre auth-metoder landar här:
async function enrichFromDatabase(userId: string, email: string, authMethod): AuthUser | null {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      userType: true,
      isAdmin: true,
      provider: { select: { id: true, stableId: true } },
    },
  })
  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? email,
    userType: user.userType,
    isAdmin: user.isAdmin,
    providerId: user.provider?.id ?? null,
    stableId: user.provider?.stableId ?? null,
    authMethod,
  }
}
```

**Varför DB-lookup?**
- JWT claims kan ljuga (stale token, manipulerad claim)
- `providerId` kan ändras (provider skapas efter login)
- En enda källa till sanning: databasen
- Kostnaden är ~1ms (primärnyckel-lookup, alltid i minne)

## Middleware

### Problem

Middleware (`middleware.ts`) kör i Edge runtime och har idag bara tillgång till
NextAuth-session via `auth()`. Den kontrollerar roller (admin, provider, customer)
och blockerar obehöriga. Utan Supabase-stöd i middleware blockeras användare som
bara har Supabase-cookie.

### Lösning

Utöka middleware till att hantera Supabase-tokens:

```typescript
// middleware.ts
export default auth(async (req) => {
  const { auth: nextAuthSession, nextUrl } = req

  // Om NextAuth-session finns, använd den (som idag)
  if (nextAuthSession?.user) {
    return handleAuthorization(nextAuthSession.user, nextUrl)
  }

  // Fallback: kolla Supabase-cookie
  const supabaseUser = await getSupabaseUserFromCookie(req)
  if (supabaseUser) {
    return handleAuthorization(supabaseUser, nextUrl)
  }

  // Ingen auth alls
  if (nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', nextUrl))
})
```

**Edge-begränsning:** Middleware kan INTE göra DB-lookup (ingen Prisma i Edge).
Här litar vi på Supabase JWT claims för `userType` och `isAdmin` i
middleware-kontexten. Den fullständiga DB-verifieringen sker i `getAuthUser()`
i API-routen.

**getSupabaseUserFromCookie():** Ny helper i `src/lib/auth-supabase-edge.ts`
som dekrypterar Supabase-cookien i Edge runtime. Använder `@supabase/ssr`
(redan Edge-kompatibel).

### Filer

| Fil | Ändring |
|-----|---------|
| `middleware.ts` | **ÄNDRAD** -- Supabase-fallback efter NextAuth |
| `src/lib/auth-supabase-edge.ts` | **NY** -- Edge-kompatibel Supabase cookie-verifiering |

## Filer (sammanfattning)

| Fil | Ändring |
|-----|---------|
| `src/lib/auth-dual.ts` | **NY** -- `AuthUser`-typ + `getAuthUser()` + `enrichFromDatabase()` |
| `src/lib/auth-dual.test.ts` | **NY** -- BDD dual-loop tester |
| `src/lib/auth-supabase-edge.ts` | **NY** -- Edge Supabase cookie-helper |
| `middleware.ts` | **ÄNDRAD** -- Supabase-fallback |

## TDD-approach (BDD dual-loop)

### Yttre integrationstest (vad vi vill bevisa)

1. Bearer token -> DB-lookup -> AuthUser { authMethod: "bearer" }
2. NextAuth session -> DB-lookup -> AuthUser { authMethod: "nextauth" }
3. Supabase cookie -> DB-lookup -> AuthUser { authMethod: "supabase" }
4. Bearer + NextAuth samtidigt -> Bearer vinner
5. NextAuth + Supabase samtidigt -> NextAuth vinner
6. Inget auth -> null
7. Giltig token men userId finns inte i DB -> null
8. Provider skapad efter login -> providerId korrekt (DB-lookup, inte claim)

### Inre unit-tester

- `enrichFromDatabase()`: user finns, user saknas, user utan provider
- Supabase cookie-parsing: giltig, ogiltig, saknas
- Bearer-extraktion: rätt prioritetsordning
- Middleware: NextAuth-session -> ok, Supabase-cookie -> ok, ingen -> redirect/401

## Risker

| Risk | Mitigation |
|------|-----------|
| DB-lookup per request (prestanda) | ~1ms primärnyckel-lookup, försumbart |
| Edge runtime: ingen Prisma i middleware | Middleware litar på JWT claims för routing-beslut, DB-verifiering sker i API route |
| Tre auth-system att underhålla | Temporärt -- NextAuth + Bearer fasas ut efter full migrering |
| Supabase-cookies saknas i befintliga sessioner | NextAuth fallback i prioritetsordningen |
| `@supabase/ssr` i Edge runtime | Redan Edge-kompatibel (verifierat i docs) |
