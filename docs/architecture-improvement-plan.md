---
title: Arkitekturförbättringsplan
description: Genomförbar plan för de två högst prioriterade refaktoreringarna -- rollkonstanter och API-route wrapper
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Del 1 -- requireRole och rollkonstanter
  - Del 2 -- API-route wrapper
  - Rekommenderad ordning
---

# Arkitekturförbättringsplan

> Två konkreta förbättringar som adresserar de mest fragila delarna av kodbasen.

---

## Del 1: requireRole() + rollkonstanter

### Målbild

En central definition av roller och en `requireRole(session, role)` utility som ersätter alla `session.user.userType !== "provider"` strängjämförelser. Varje rollcheck refererar till en konstant, inte en sträng.

**Före:**
```typescript
// 66 varianter av detta, med subtila skillnader i felmeddelande och statuskod:
if (session.user.userType !== "provider") {
  return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })  // ibland 403
}
```

**Efter:**
```typescript
const provider = requireProvider(session)
// Kastar Response(401) om ej inloggad, Response(403) om fel roll
// Returnerar { userId, providerId } -- typsäkert, ingen null-check behövs
```

### Varför det är viktigt

- **66 hårdkodade strängjämförelser** i API-routes. Ingen garanti att de är konsekventa.
- Session 106 visade att 78% av routes saknade null-check -- problemet upptäcktes sent.
- Felmeddelanden varierar: ibland "Ej inloggad" (401), ibland "Åtkomst nekad" (403) för samma scenario.
- Att lägga till en ny roll (t.ex. stable_owner) kräver granskning av alla 66 ställen.

### Minsta möjliga första implementation

**Steg 1: Skapa `src/lib/roles.ts`** (ny fil, ~80 LOC)

```typescript
// --- Rollkonstanter ---
export const ROLES = {
  PROVIDER: "provider",
  CUSTOMER: "customer",
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// --- Session-typer ---
export interface AuthenticatedUser {
  userId: string
  email: string
  userType: UserRole
  isAdmin: boolean
}

export interface ProviderUser extends AuthenticatedUser {
  userType: "provider"
  providerId: string
}

export interface CustomerUser extends AuthenticatedUser {
  userType: "customer"
}

// --- Auth guards ---

/** Kräver inloggad användare. Kastar Response(401) om ej inloggad. */
export function requireAuth(
  session: { user?: { id?: string; userType?: string; email?: string; isAdmin?: boolean } } | null
): AuthenticatedUser {
  if (!session?.user?.id) {
    throw NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    userType: session.user.userType as UserRole,
    isAdmin: session.user.isAdmin === true,
  }
}

/** Kräver inloggad leverantör. Kastar 401/403. */
export function requireProvider(
  session: { user?: { id?: string; userType?: string; providerId?: string | null } } | null
): ProviderUser {
  const user = requireAuth(session)
  if (user.userType !== ROLES.PROVIDER) {
    throw NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
  }
  const providerId = (session!.user as { providerId?: string | null }).providerId
  if (!providerId) {
    throw NextResponse.json({ error: "Leverantörsprofil saknas" }, { status: 403 })
  }
  return { ...user, userType: "provider", providerId }
}

/** Kräver inloggad kund. Kastar 401/403. */
export function requireCustomer(
  session: { user?: { id?: string; userType?: string } } | null
): CustomerUser {
  const user = requireAuth(session)
  if (user.userType !== ROLES.CUSTOMER) {
    throw NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
  }
  return { ...user, userType: "customer" }
}
```

**Nyckeldesign**:
- Följer `requireAdmin()`-mönstret som redan finns (kastar Response)
- Returnerar typsäkra objekt -- `providerId` är `string`, aldrig `null`
- Konsoliderar null-check + rollcheck + providerId-check i ett anrop
- Ingen ändring av `requireAdmin()` -- den gör DB-lookup, dessa gör det inte

**Steg 2: Tester för `src/lib/roles.ts`** (~100 LOC)

```
- requireAuth med null session -> 401
- requireAuth med giltig session -> returnerar AuthenticatedUser
- requireProvider med customer session -> 403
- requireProvider med provider utan providerId -> 403
- requireProvider med giltig provider -> returnerar ProviderUser med providerId
- requireCustomer med provider session -> 403
- requireCustomer med giltig customer -> returnerar CustomerUser
```

**Steg 3: Migrera 5 enkla routes** (pilotgrupp)

Välj 5 routes med enkel struktur och god testtäckning:
- `src/app/api/services/route.ts`
- `src/app/api/horses/route.ts`
- `src/app/api/provider/profile/route.ts`
- `src/app/api/customer/horses/route.ts`
- `src/app/api/notifications/route.ts`

Ändring per route: ~3 rader borttagna, ~1 rad tillagd:
```typescript
// Före (5-8 rader):
const session = await auth()
if (!session) {
  return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
}
if (session.user.userType !== "provider" || !session.user.providerId) {
  return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
}
const providerId = session.user.providerId

// Efter (1 rad):
const { providerId } = requireProvider(await auth())
```

Kör testerna efter varje route. Alla befintliga tester ska passera utan ändring (mocks kastar redan Response-objekt).

### Stegvis migrationsplan

| Steg | Vad | Filer | Verifiering |
|------|-----|-------|-------------|
| 1 | Skapa `roles.ts` + tester | 2 nya | `npm run test -- roles` |
| 2 | Migrera 5 pilot-routes | 5 ändrade | `npm run test:run` |
| 3 | Granska: fungerar mönstret? Behövs justeringar? | -- | Manuell bedömning |
| 4 | Migrera provider-routes (~30 st) | 30 ändrade | `npm run test:run` |
| 5 | Migrera customer-routes (~10 st) | 10 ändrade | `npm run test:run` |
| 6 | Migrera mixed/övriga routes (~20 st) | 20 ändrade | `npm run test:run` + `npm run typecheck` |
| 7 | Uppdatera `useAuth.ts` att använda ROLES-konstanter | 1 ändrad | Manuell verifiering |
| 8 | Sök efter kvarvarande `userType !==` strängar | -- | `grep -rn 'userType.*!==\|!==.*userType' src/app/api/` |

Steg 4-6 kan köras med parallella agenter per batch (liknande session 106).

### Risker

| Risk | Sannolikhet | Hantering |
|------|-------------|-----------|
| Tester som mockar `auth()` behöver uppdateras | Låg | Mockarna returnerar redan session-objekt. `requireProvider` läser samma fält. |
| Befintlig route kastar redan Response i catch-block | Låg | `requireProvider` kastar Response, fångas av befintlig `if (error instanceof Response) return error` |
| Native routes använder `authFromMobileToken`, inte `auth()` | Ingen risk | Vi rör inte native routes i denna iteration. |
| Middleware har egna rollcheckar | Ingen risk | Middleware lämnas orörd -- den gör coarse-grained routing, inte fine-grained auth. |

### Vad som INTE ska göras i första iterationen

- **Ändra inte middleware.ts** -- den har sin egen rolllogik för routing, inte auth
- **Ändra inte `requireAdmin()`** -- den gör DB-lookup, våra funktioner gör det inte. Olika pattern.
- **Ändra inte native routes** (`/api/native/*`) -- de använder `authFromMobileToken`, en helt annan auth-mekanism
- **Skapa inte `requireStableOwner()`** -- stable-rollen finns inte formellt ännu
- **Refaktorera inte middleware till konfigurationsdriven** -- det är en separat förbättring
- **Ändra inte `useAuth.ts`** i steg 1-6 -- klient-sidan är lägre prioritet

### Filer som påverkas

**Nya filer**: `src/lib/roles.ts`, `src/lib/roles.test.ts`
**Ändrade filer**: ~60 route.ts-filer under `src/app/api/` (exklusive native, admin, public)
**Orörda**: middleware.ts, admin-auth.ts, useAuth.ts, alla native routes, alla testfiler (mockarna fungerar redan)

### Verifiering

1. `npm run test:run` -- alla ~3700 tester gröna
2. `npm run typecheck` -- inga TypeScript-fel
3. `grep -rn "userType.*!==" src/app/api/ | grep -v native | grep -v test` -- returnerar 0 resultat
4. Manuell stickprovskontroll: logga in som provider och customer, verifiera att rollbaserade routes fungerar

---

## Del 2: API-route wrapper (withApiHandler)

### Målbild

En wrapper-funktion som hanterar auth, rate limiting, JSON-parsing och Zod-validering centraliserat. Routes definierar bara konfiguration och affärslogik.

**Före** (~25 rader boilerplate per handler):
```typescript
export async function POST(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled("voice_logging"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.ai(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }
    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }
    let body
    try { body = await request.json() }
    catch { return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 }) }
    const validated = schema.parse(body)
    // ... affärslogik ...
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Valideringsfel", details: error.issues }, { status: 400 })
    logger.error("Error", error as Error)
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
```

**Efter** (~3 rader config + ren affärslogik):
```typescript
export const POST = withApiHandler({
  auth: "provider",
  rateLimit: "ai",
  featureFlag: "voice_logging",
  schema: interpretSchema,
}, async ({ provider, body, request }) => {
  // Ren affärslogik -- auth, rate limit, parse, validering redan hanterade
  const result = await voiceService.interpret(body.transcript, provider.providerId)
  return NextResponse.json(result)
})
```

### Varför det är viktigt

- **~2,000 LOC duplicerad boilerplate** i 159 routes
- Varje ny route kräver copy-paste av 15-25 rader som måste vara exakt rätt
- Session 106 visade att en inkonsistens (saknad null-check) fanns i 78% av routes
- Felmeddelanden, statuskoder och ordning varierar subtilt mellan routes
- En ändring i mönstret (ny rate limiter, nytt felformat) kräver sweep av alla routes

### Minsta möjliga första implementation

**Skapa `src/lib/api-handler.ts`** (~120 LOC)

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getClientIP, rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { requireAuth, requireProvider, requireCustomer, type AuthenticatedUser, type ProviderUser, type CustomerUser } from "@/lib/roles"
import { logger } from "@/lib/logger"
import { z, type ZodSchema } from "zod"

// --- Konfiguration ---

type AuthLevel = "none" | "any" | "provider" | "customer"
type RateLimiterKey = keyof typeof rateLimiters

interface HandlerConfig<TSchema extends ZodSchema | undefined> {
  /** Auth-krav. "none" = publik, "any" = inloggad, "provider"/"customer" = rollkrav */
  auth?: AuthLevel
  /** Vilken rate limiter att använda. Default: "api" */
  rateLimit?: RateLimiterKey | false
  /** Feature flag som måste vara aktiverad */
  featureFlag?: string
  /** Zod-schema för request body (POST/PUT/PATCH) */
  schema?: TSchema
  /** Rate limit key-strategi: "ip" (default) eller "user" (kräver auth) */
  rateLimitKey?: "ip" | "user"
}

// --- Context som handler tar emot ---

interface BaseContext {
  request: NextRequest
}

interface AuthContext extends BaseContext {
  user: AuthenticatedUser
}

interface ProviderContext extends BaseContext {
  user: ProviderUser
  provider: ProviderUser  // Alias för tydlighet
}

interface CustomerContext extends BaseContext {
  user: CustomerUser
}

type ContextFor<TAuth extends AuthLevel> =
  TAuth extends "provider" ? ProviderContext :
  TAuth extends "customer" ? CustomerContext :
  TAuth extends "any" ? AuthContext :
  BaseContext

type ContextWithBody<TAuth extends AuthLevel, TSchema extends ZodSchema | undefined> =
  TSchema extends ZodSchema
    ? ContextFor<TAuth> & { body: z.infer<TSchema> }
    : ContextFor<TAuth>

// --- Huvudfunktion ---

export function withApiHandler<
  TAuth extends AuthLevel = "any",
  TSchema extends ZodSchema | undefined = undefined,
>(
  config: HandlerConfig<TSchema> & { auth?: TAuth },
  handler: (ctx: ContextWithBody<TAuth, TSchema>) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Feature flag
      if (config.featureFlag) {
        if (!(await isFeatureEnabled(config.featureFlag))) {
          return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
        }
      }

      // 2. Rate limiting
      if (config.rateLimit !== false) {
        const limiterKey = config.rateLimit ?? "api"
        const identifier = getClientIP(request)
        try {
          const isAllowed = await rateLimiters[limiterKey](identifier)
          if (!isAllowed) {
            return NextResponse.json(
              { error: "För många förfrågningar. Försök igen senare." },
              { status: 429 }
            )
          }
        } catch (error) {
          if (error instanceof RateLimitServiceError) {
            return NextResponse.json(
              { error: "Tjänsten är tillfälligt otillgänglig" },
              { status: 503 }
            )
          }
          throw error
        }
      }

      // 3. Auth
      const authLevel = config.auth ?? "any"
      let context: Record<string, unknown> = { request }

      if (authLevel !== "none") {
        const session = await auth()
        if (authLevel === "provider") {
          const provider = requireProvider(session)
          context = { ...context, user: provider, provider }
        } else if (authLevel === "customer") {
          const customer = requireCustomer(session)
          context = { ...context, user: customer }
        } else {
          const user = requireAuth(session)
          context = { ...context, user }
        }
      }

      // 4. Body parsing + Zod validation
      if (config.schema) {
        let rawBody: unknown
        try {
          rawBody = await request.json()
        } catch {
          return NextResponse.json(
            { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
            { status: 400 }
          )
        }
        const parsed = config.schema.parse(rawBody)
        context = { ...context, body: parsed }
      }

      // 5. Kör handler
      return await handler(context as ContextWithBody<TAuth, TSchema>)

    } catch (error) {
      // Thrown Response (från requireAuth/requireProvider/requireAdmin)
      if (error instanceof Response) {
        return error as NextResponse
      }
      // Zod-valideringsfel
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Valideringsfel", details: error.issues },
          { status: 400 }
        )
      }
      // Oväntat fel
      logger.error(
        "Unhandled API error",
        error instanceof Error ? error : new Error(String(error))
      )
      return NextResponse.json(
        { error: "Internt serverfel" },
        { status: 500 }
      )
    }
  }
}
```

**Nyckeldesign**:
- **Ordningen är fixerad**: feature flag -> rate limit -> auth -> body parse -> handler. Aldrig fel.
- **Bygger på `requireProvider`/`requireCustomer`** från del 1 -- därför görs del 1 först.
- **Typsäker context**: handler för `auth: "provider"` får `ProviderContext` med `providerId: string`.
- **Opt-out**: `rateLimit: false` för routes som inte ska rate-limiteras. `auth: "none"` för publika routes.
- **Kompatibel med befintliga tester**: mockade `auth()` och `rateLimiters` fungerar identiskt.
- **Ingen breaking change**: wrapper returnerar `(request: NextRequest) => Promise<NextResponse>`, samma signatur som Next.js route handler.

### Stegvis migrationsplan

| Steg | Vad | Filer | Verifiering |
|------|-----|-------|-------------|
| 1 | Skapa `api-handler.ts` + tester | 2 nya | `npm run test -- api-handler` |
| 2 | Migrera 3 pilot-routes med olika mönster | 3 ändrade | Befintliga tester gröna |
| 3 | Granska: täcker wrappern alla varianter? Behövs justeringar? | -- | Manuell |
| 4 | Migrera enkla provider-routes (GET-only, ingen body) | ~20 ändrade | `npm run test:run` |
| 5 | Migrera POST/PUT/PATCH-routes med schema | ~30 ändrade | `npm run test:run` |
| 6 | Migrera feature-flaggade routes | ~15 ändrade | `npm run test:run` |
| 7 | Migrera publika routes (`auth: "none"`) | ~10 ändrade | `npm run test:run` |
| 8 | Migrera komplexa routes (multi-method, custom error) | ~15 ändrade | `npm run test:run` + `npm run typecheck` |

**Pilot-routes (steg 2)** -- tre olika mönster:

1. `src/app/api/services/route.ts` -- provider + schema (vanligaste mönstret)
2. `src/app/api/feature-flags/route.ts` -- publik, ingen auth
3. `src/app/api/voice-log/route.ts` -- provider + feature flag + ai rate limit

**Steg 4-8** kan köras med parallella agenter per batch.

### Risker

| Risk | Sannolikhet | Hantering |
|------|-------------|-----------|
| Routes med unik rate-limit-key (t.ex. per userId) | Medel | Lägg till `rateLimitKey: "user"` option. Piloten avslöjar om det behövs. |
| Routes som returnerar custom headers (Cache-Control) | Låg | Handler returnerar NextResponse -- den kan sätta headers fritt. |
| Routes med multi-method (GET + POST i samma fil) | Hög | Varje export (GET, POST) wrappar separat. Inget problem. |
| Routes som gör auth() + extra DB-lookup (t.ex. admin) | Medel | Admin-routes behåller `requireAdmin()` -- de exkluderas från wrappern eller har `auth: "any"` + manuell admin-check i handler. |
| Testmockar slutar fungera | Låg | Wrappern anropar samma `auth()` och `rateLimiters` som mockarna redan interceptar. |
| Route som behöver request INNAN rate-limit | Låg | Inget sådant mönster hittades. Om det uppstår: `rateLimit: false` + manuell check. |

### Vad som INTE ska göras i första iterationen

- **Ändra inte native routes** (`/api/native/*`) -- de använder `authFromMobileToken`, inte `auth()`. Kräver separat wrapper (`withNativeHandler`) i framtiden.
- **Ändra inte admin routes** -- de har `requireAdmin()` med DB-lookup, ett annat mönster
- **Ändra inte webhook routes** (`/api/webhooks/*`) -- de har egen signaturverifiering
- **Ändra inte cron routes** (`/api/cron/*`) -- de har `CRON_SECRET` verifiering
- **Bygg inte in params-parsing** (dynamic route segments) -- det är en framtida förbättring
- **Bygg inte in response-caching** -- routes hanterar det själva

### Filer som påverkas

**Nya filer**: `src/lib/api-handler.ts`, `src/lib/api-handler.test.ts`
**Ändrade filer**: ~90 route.ts-filer under `src/app/api/` (exklusive native, admin, webhooks, cron, test)
**Orörda**: Alla testfiler (mockarna fungerar redan), middleware.ts, native routes, admin routes

### Verifiering

1. `npm run test:run` -- alla ~3700 tester gröna
2. `npm run typecheck` -- inga TypeScript-fel
3. `npm run lint` -- inga nya varningar
4. Stickprov: räkna rader per route, verifiera att boilerplate försvunnit:
   ```bash
   # Före: ~50 LOC per handler i snitt
   # Efter: ~20 LOC per handler (config + affärslogik)
   wc -l src/app/api/services/route.ts  # bör minska ~40%
   ```
5. Grep efter kvarvarande boilerplate:
   ```bash
   grep -rn "getClientIP" src/app/api/ | grep -v native | grep -v test | grep -v api-handler
   # Bör returnera 0 resultat (allt hanteras av wrappern)
   ```

---

## Rekommenderad ordning

### Del 1 FÖRST, sedan del 2

**Varför:**
1. `withApiHandler` **bygger på** `requireProvider`/`requireCustomer` från del 1. Utan rollkonstanter måste wrappern ha sin egen auth-logik, vilket skapar duplicering.
2. Del 1 är **mindre och säkrare** -- den introducerar en ny fil utan att ändra befintlig funktionalitet. Fel i del 1 påverkar bara migrerade routes.
3. Del 1 ger **omedelbar verifierbar nytta** efter steg 2 (5 pilot-routes). Del 2 kräver mer setup innan den ger värde.
4. Om del 1 avslöjar problem (t.ex. mocks som inte fungerar med throw-pattern) vill vi veta det innan vi bygger en wrapper ovanpå.

### Uppskattad komplexitet

| Del | Ny kod | Migrering | Total tid | Komplexitet |
|-----|--------|-----------|-----------|-------------|
| 1. rollkonstanter | ~80 LOC + ~100 LOC test | ~60 routes, mekanisk | 3-5 timmar | **Låg** |
| 2. API wrapper | ~120 LOC + ~150 LOC test | ~90 routes, mekanisk men med varianter | 5-8 timmar | **Medel** |

### Tidplan

```
Dag 1: Del 1, steg 1-3 (roles.ts + tester + 5 pilot-routes)
Dag 1: Del 1, steg 4-6 (migrera resterande ~55 routes med parallella agenter)
Dag 1: Del 1, steg 7-8 (useAuth + verifiering)

Dag 2: Del 2, steg 1-3 (api-handler.ts + tester + 3 pilot-routes)
Dag 2: Del 2, steg 4-6 (migrera ~65 routes med parallella agenter)
Dag 2: Del 2, steg 7-8 (publika + komplexa routes + verifiering)
```

### Framtida steg (utanför scope)

- `withNativeHandler` -- separat wrapper för `/api/native/*` med `authFromMobileToken`
- `withAdminHandler` -- wrapper som inkluderar `requireAdmin()` med DB-lookup
- Middleware refaktorering till konfigurationsdriven rollmappning
- `withCronHandler` -- wrapper med `CRON_SECRET` verifiering
