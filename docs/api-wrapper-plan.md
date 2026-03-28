---
title: API-wrapper plan
description: Plan och status för withApiHandler -- centraliserad boilerplate-hantering i API-routes
category: architecture
status: in-progress
last_updated: 2026-03-28
sections:
  - Kartläggning
  - Iteration 1
  - Pilot-resultat
  - Nästa steg
---

# API-wrapper plan

> `withApiHandler` i `src/lib/api-handler.ts`

---

## Kartläggning -- vad upprepas mest

Analys av 47 redan migrerade routes. Återkommande boilerplate per handler:

| Mönster | LOC per handler | Förekomster |
|---------|----------------|-------------|
| `requireProvider(await auth())` + catch Response | 3-5 | ~35 |
| Rate limit (getClientIP + rateLimiters.api + 429-svar) | 5-7 | ~45 |
| JSON-parsing try-catch + 400-svar | 5-7 | ~40 |
| Zod parse + ZodError catch + 400-svar | 3-5 | ~40 |
| Feature flag check + 404-svar | 3 | ~15 |
| Generisk catch (Response + ZodError + Error -> 500) | 8-12 | ~90 |

**Mest effektiva att centralisera**: catch-blocket (8-12 rader x ~90 handlers) och rate limiting (5-7 rader x ~45 handlers).

## Vad iteration 1 omfattar

| Funktion | Inkluderad | Notering |
|----------|-----------|----------|
| Auth (provider/customer/any/none) | Ja | Bygger på befintliga role helpers |
| Rate limiting | Ja | Default "api", konfigurerbart, fail-closed (503) |
| Feature flag | Ja | Valfritt, returnerar 404 |
| JSON-parsing + Zod-validering | Ja | Valfritt schema, returnerar 400 |
| Standardiserad felhantering | Ja | Response passthrough, Zod 400, generisk 500 |
| Typsäker context | Ja | `ctx.user.providerId` bara tillgänglig med `auth: "provider"` |

## Vad som INTE ingår i iteration 1

| Funktion | Varför inte |
|----------|-------------|
| Mixed public/private (GET publik, PUT auth) | Varje export hanteras separat -- wrappern behöver inte hantera detta |
| Dynamic route params (`[id]`, `[customerId]`) | Parsas av Next.js, inte wrappern |
| Custom rate limit key (per userId istället för IP) | Kan läggas till senare om behov uppstår |
| Native routes (authFromMobileToken) | Helt annan auth-mekanism |
| Admin routes (requireAdmin med DB-lookup) | Kräver Prisma-anrop i auth-steget |

---

## Wrapper-signatur

```typescript
export function withApiHandler<TAuth, TSchema>(
  config: {
    auth?: "none" | "any" | "provider" | "customer"  // default: "any"
    rateLimit?: RateLimiterKey | false                // default: "api"
    featureFlag?: string                              // optional
    schema?: ZodSchema                                // optional, parsar body
  },
  handler: (ctx) => Promise<NextResponse>
)
```

**Context som handler tar emot:**
- `ctx.request` -- alltid tillgänglig
- `ctx.user` -- AuthenticatedUser / ProviderUser / CustomerUser (ej tillgänglig med `auth: "none"`)
- `ctx.body` -- validerad body (bara tillgänglig om `schema` anges)

**Exekveringsordning (fixerad):**
1. Auth (requireProvider/requireCustomer/requireAuth)
2. Rate limiting
3. Feature flag
4. JSON-parsing + Zod-validering
5. Handler

---

## Pilot-resultat

### 3 routes migrerade

| Route | Auth | Före | Efter | Teständringar |
|-------|------|------|-------|---------------|
| `provider/subscription/status` | provider + feature flag | 50 LOC | 22 LOC | Inga |
| `notifications` | any (GET+POST) | 72 LOC | 30 LOC | Inga |
| `municipality-watches` | customer + feature flag + Zod (POST+GET) | 112 LOC | 48 LOC | Inga |

**Total reduktion**: 234 LOC -> 100 LOC (57% minskning)

### Vad blev bättre

1. **Ingen duplicerad catch-block** -- wrappern hanterar Response, ZodError och generiska fel
2. **Ingen duplicerad rate limiting** -- default "api" limiter appliceras automatiskt
3. **Ingen duplicerad JSON-parsing** -- `schema` option hanterar parse + validering
4. **Deklarativt** -- config-objektet visar auth/rate-limit/feature-flag på en rad
5. **Inga teständringar behövdes** -- befintliga tester passerade utan modifiering

### Vad som fortfarande är kvar

- Routes med custom rate limit key (per userId, t.ex. `service-create:${userId}`)
- Routes med custom felmeddelanden vid rate limit (t.ex. "För många tjänster skapade")
- Routes som gör provider-lookup via repository efter auth (inte bara providerId)

Dessa kan antingen: (a) behålla manuell rate limiting i handlern, eller (b) wrappern utökas med `rateLimitKey`-option i iteration 2.

---

## Wrapper-batch 2 -- 9 routes

| Route | Auth | Config | Före | Efter | Teständring |
|-------|------|--------|------|-------|-------------|
| `provider/subscription/portal` | provider | +featureFlag +rateLimit:"subscription" | 82 | 37 | Inga |
| `provider/subscription/checkout` | provider | +featureFlag +schema +rateLimit:"subscription" | 88 | 43 | Inga |
| `horses` | any | GET+POST, +schema (POST) | 99 | 39 | Inga |
| `follows` | customer | POST+GET, +featureFlag | 107 | 42 | Inga |
| `follows/[providerId]` | customer/any | DELETE+GET | 80 | 37 | Inga |
| `municipality-watches/[id]` | customer | DELETE, +featureFlag | 47 | 19 | URL-param extraction |
| `route-orders/my-orders` | customer | GET, +featureFlag | 90 | 59 | Request-typ + felformat |
| `customer-reviews` | provider | POST+GET | 129 | 71 | Inga |
| `provider/due-for-service` | provider | GET, komplex affärslogik | 166 | 140 | Inga |

**Total reduktion**: 888 -> 487 LOC (-401, 45%)

### Upptäckter

1. **Dynamic route params**: `withApiHandler` skickar inte Next.js route context (`params`). Routes med `[id]` extraherar param från `request.nextUrl.pathname` eller använder closure-pattern.
2. **Komplex affärslogik**: `provider/due-for-service` (140 LOC kvar) visar att wrappern inte magiskt krymper routes med tung logik -- den tar bort ~26 rader boilerplate men affärslogiken dominerar.
3. **Custom rate limiters**: `subscription`-routes använder `rateLimit: "subscription"` istället för default "api" -- wrappern stödjer detta utan problem.

---

## Wrapper-batch 3 -- 6 routes

| Route | Auth | Före | Efter | Teständring |
|-------|------|------|-------|-------------|
| `provider/customers` | provider | 323 | 260 | Inga |
| `provider/customers/[customerId]` | provider | 166 | 112 | Params via URL |
| `provider/profile` | provider | 233 | 172 | +rate-limit mock |
| `services` | provider | 127 | 76 | +rate-limit mock (GET) |
| `services/[id]` | provider | 136 | 64 | Params via URL, -132 LOC test |
| `voice-log` | provider | 194 | 144 | Inga |

**Total reduktion**: 1179 -> 828 LOC (-351, 30%)

### Upptäckter batch 3

1. **Custom rate-limit key i services/POST**: `rateLimit: false` + manuell `rateLimiters.serviceCreate()` i handlern. Wrappern behöver inte utökas -- opt-out fungerar.
2. **Profile PUT behåller inner try/catch**: Prisma-specifika felkoder (P2025, P2002) hanteras i affärslogiken, inte av wrappern. Okända fel kastas vidare.
3. **`[customerId]` param**: Extraheras via `extractCustomerId()` helper som splittar URL-path. Samma pragmatiska lösning som batch 2.

---

## Slutstatus -- wrapper pausad 2026-03-28

### Vad som är migrerat

**18 routes** använder `withApiHandler` efter 3 batchar (pilot + batch 2 + batch 3):

| Batch | Routes | LOC före | LOC efter | Reduktion |
|-------|--------|----------|-----------|-----------|
| Pilot | 3 | 234 | 100 | -57% |
| Batch 2 | 9 | 888 | 487 | -45% |
| Batch 3 | 6 | 1179 | 828 | -30% |
| **Totalt** | **18** | **2301** | **1415** | **-886 LOC (-39%)** |

3739 tester gröna. 0 regressioner genom hela migreringen.

### Vad wrappern täcker bra idag

- **Auth**: provider, customer, any, none -- med typsäker context
- **Rate limiting**: default "api" by IP, konfigurerbart (`"ai"`, `"subscription"` etc.), fail-closed (503)
- **Feature flags**: valfritt, returnerar 404
- **JSON-parsing + Zod**: valfritt schema, returnerar 400 med issues
- **Felhantering**: Response passthrough, ZodError -> 400, generisk -> 500
- **Escape hatch**: `rateLimit: false` för routes med custom rate-limit-key

### Etablerade mönster

```typescript
// Enkel provider-route
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user }) => { ... },
)

// Med feature flag + Zod body
export const POST = withApiHandler(
  { auth: "customer", featureFlag: "municipality_watch", schema: watchSchema },
  async ({ user, body }) => { ... },
)

// Custom rate limiter (opt-out + manuell)
export const POST = withApiHandler(
  { auth: "provider", rateLimit: false },
  async ({ user, request }) => {
    const allowed = await rateLimiters.serviceCreate(`key:${user.userId}`)
    if (!allowed) return NextResponse.json({ error: "..." }, { status: 429 })
    ...
  },
)

// Dynamic params (pragmatisk URL-split)
const id = request.nextUrl.pathname.split("/").pop()!
```

---

## Kvarvarande specialfall

Routes som inte migrerades till wrappern och varför:

| Kategori | Antal | Varför inte |
|----------|-------|-------------|
| Mixed public/private | ~3 | GET publik + mutation auth -- wrappern konfigureras per handler, men dessa bör verifieras individuellt |
| IDOR + dynamic params | ~7 | `hasCustomerRelationship()`, nested IDOR -- affärslogiken dominerar, liten vinst av wrapper |
| Custom auth (dual JWT+session) | ~2 | `resolveAuth`, `authFromMobileToken` -- utanför wrapperns scope |
| Saknade tester | ~3 | Fortnox connect, customer/due-for-service, customer/horses/intervals |
| Högrisk (dual-mode, ghost user) | ~4 | `route-orders/route.ts`, `bookings/manual` -- kräver individuell granskning |
| Admin routes | ~12 | `requireAdmin()` med DB-lookup, eget mönster |
| Native routes | ~20 | `authFromMobileToken`, helt annan auth-mekanism |

---

## Varför wrappern inte behöver bredare sweep nu

**Den stora vinsten är redan tagen.** De 18 migrerade routerna var de med mest boilerplate relativt affärslogik. Kvarvarande routes har antingen:
- Mycket affärslogik (wrappern sparar bara 20-30 rader av 200+)
- Specialfall som kräver individuell bedömning
- Redan kort boilerplate (en requireProvider-rad + en rate-limit-rad)

**Ytterligare migrering ger avtagande avkastning.** Batch 3 visade 30% reduktion mot batch 1:s 57% -- routerna blir progressivt mer specialiserade.

**De kvarvarande filerna bör migreras selektivt** -- när man ändå redigerar en route för annan anledning, byt till wrappern i samma commit.

**Wrapper v2 kan vänta** tills ett tydligt behov uppstår. De tre vanligaste sakerna som saknas (params-stöd, custom rate-limit-key, admin-auth) har alla fungerande workarounds (URL-split, rateLimit:false, requireAdmin manuellt).

---

## Rekommenderad strategi framåt

### Använd withApiHandler för:
- **Alla nya routes** -- deklarativt, säkert, konsekvent
- **Routes du redan redigerar** -- byt till wrappern i samma commit (opportunistisk migrering)
- **Enkla CRUD-routes** med provider/customer auth

### Låt en route vara som den är om:
- Den fungerar, har tester, och du inte redigerar den
- Den har dual-auth eller custom auth-pattern
- Boilerplate-andelen är liten jämfört med affärslogik

### Triggers som motiverar wrapper v2:
- **params-stöd**: Om 5+ routes använder URL-split-workaround
- **rateLimitKey: "user"**: Om custom rate-limit-key upprepas i 3+ routes
- **Admin-wrapper**: Om admin-routes refaktoreras (kräver DB-lookup i auth-steget)
- **Native-wrapper**: Om iOS-appens API-routes standardiseras
