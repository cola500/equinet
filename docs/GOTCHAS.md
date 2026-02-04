# Vanliga Gotchas

> Samling av vanliga problem och deras lösningar. Uppdateras löpande med nya learnings.

## Innehåll

1. [Next.js 16 Dynamic Params](#1-nextjs-16-dynamic-params)
2. [Zod Error Handling](#2-zod-error-handling)
3. [Turbopack Cache](#3-turbopack-cache)
4. [NextAuth Session Update](#4-nextauth-session-update)
5. [Rate Limiting i Serverless](#5-rate-limiting-i-serverless)
6. [IDOR med Race Condition](#6-idor-med-race-condition)
7. [Prisma Over-Fetching](#7-prisma-over-fetching)
8. [Saknade Database Indexes](#8-saknade-database-indexes)
9. [NextAuth v5 Migration](#9-nextauth-v5-migration)
10. [TypeScript Memory Issues](#10-typescript-memory-issues)
11. [Frontend Data Normalisering](#11-frontend-data-normalisering)
12. [Generiska Felmeddelanden](#12-generiska-felmeddelanden)
13. [Connection Pool Exhaustion](#13-connection-pool-exhaustion)
14. [Prisma DATE-kolumner och Timezone](#14-prisma-date-kolumner-och-timezone)
15. [Safari Date Parsing](#15-safari-date-parsing)
16. [Serverless State & Storage](#16-serverless-state--storage)
17. [Upsert för Race Conditions](#17-upsert-för-race-conditions)
18. [Behavior-Based vs Implementation-Based Testing](#18-behavior-based-vs-implementation-based-testing)
19. [E2E Tests Fångar API-Buggar](#19-e2e-tests-fångar-api-buggar)
20. [Vercel Build Timeout (ignoreBuildErrors)](#20-vercel-build-timeout-ignorebuildErrors)
21. [CSP Blockerar Web Workers](#21-csp-blockerar-web-workers-browser-image-compression)
22. [Mock-uploads Måste Servas av Next.js](#22-mock-uploads-måste-servas-av-nextjs)
23. [Vercel env pull Overskrider Lokal Config](#23-vercel-env-pull-overskrider-lokal-config)
24. [Prisma Migration Workflow (db push -> migrate dev)](#24-prisma-migration-workflow-db-push---migrate-dev)

---

## 1. Next.js 16 Dynamic Params

**Problem:** Dynamic route params är en Promise i Next.js 16+.

```typescript
// ❌ FEL - params är INTE direkt tillgängliga
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id  // Fungerar EJ!
}

// ✅ RÄTT - params är en Promise
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // Måste awaita!
}
```

**Impact:** Runtime error om du inte awaitar params.

---

## 2. Zod Error Handling

**Problem:** Zod använder `issues`, inte `errors`.

```typescript
// ❌ FEL - error.errors finns inte
if (error instanceof z.ZodError) {
  return { error: error.errors }  // undefined!
}

// ✅ RÄTT - använd error.issues
if (error instanceof z.ZodError) {
  return { error: error.issues }
}
```

**Impact:** Returnerar `undefined` istället för valideringsfel.

---

## 3. Turbopack Cache

**Problem:** Turbopack/Next.js cache kan bli korrupt och orsaka konstiga fel.

**Symptom:**
- Hot reload fungerar inte
- Ändringar reflekteras inte
- Konstiga importfel

**Lösning:**
```bash
# Stoppa dev server
pkill -f "next dev"

# Rensa cache
rm -rf .next node_modules/.cache

# Starta om
npm run dev
```

---

## 4. NextAuth Session Update

**Problem:** Session uppdateras inte automatiskt efter profile changes.

```typescript
// ❌ FEL - session är stale efter update
const { data: session } = useSession()
await updateProfile(newData)
// session har fortfarande gamla värden!

// ✅ RÄTT - trigga session refresh
const { data: session, update } = useSession()
await updateProfile(newData)
await update()  // Hämta ny session från server
```

**Impact:** UI visar gamla profildata tills användaren laddar om sidan.

---

## 5. Rate Limiting i Serverless

> **Learning: 2026-01-21** | **Severity: KRITISKT**

**Problem:** In-memory rate limiting fungerar INTE i serverless (Vercel).

```typescript
// ❌ FEL - In-memory Map fungerar INTE i serverless
const attempts = new Map<string, RateLimitRecord>()
// Problem: Varje Vercel-instans har egen Map → rate limits är ineffektiva

// ✅ RÄTT - Upstash Redis (serverless-kompatibel)
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const rateLimiters = {
  booking: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
  })
}

// VIKTIGT: Rate limiters returnerar Promises, måste awaitas
const { success } = await rateLimiters.booking.limit(userId)
if (!success) return new Response("Too many requests", { status: 429 })
```

**Varför?**
- Varje serverless-instans har sitt eget minne
- In-memory Map delas INTE mellan instanser
- Angripare kan kringgå rate limits genom att träffa olika instanser

**Impact:** Production blocker! Rate limiting fungerar INTE utan Redis i serverless.

**Required Environment Variables:**
```bash
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## 6. IDOR med Race Condition

> **Learning: 2026-01-21** | **Severity: SÄKERHET**

**Problem:** Authorization check FÖRE update skapar TOCTOU race condition.

```typescript
// ❌ FEL - Authorization check FÖRE update (TOCTOU race condition)
const booking = await prisma.booking.findUnique({ where: { id } })
if (booking.customerId !== userId) return 403
// ⚠️ RACE CONDITION: booking kan ändras mellan check och update!
await prisma.booking.update({ where: { id }, data: {...} })

// ✅ RÄTT - Authorization i WHERE clause (atomärt)
const result = await prisma.booking.update({
  where: {
    id,
    customerId: userId  // Auth + operation i SAMMA query
  },
  data: {...}
})

if (!result) {
  // Antingen finns inte booking, eller användaren äger den inte
  return new Response("Not found or unauthorized", { status: 404 })
}
```

**Varför?**
- TOCTOU = Time-of-check to time-of-use
- Mellan `findUnique` och `update` kan en annan request ändra datan
- Atomär WHERE clause garanterar att check och operation sker i samma transaktion

**Impact:** Eliminerar IDOR + race conditions!

---

## 7. Prisma Over-Fetching

> **Learning: 2025-11-16** | **Severity: SÄKERHET + PERFORMANCE**

**Problem:** `include` hämtar ALLT, inklusive känslig data.

```typescript
// ❌ FEL - include hämtar ALLT (over-fetching + exponerar känslig data)
const providers = await prisma.provider.findMany({
  include: {
    services: true,
    user: true,  // Ger oss email, phone, passwordHash!
  }
})

// ✅ RÄTT - select endast vad som behövs
const providers = await prisma.provider.findMany({
  select: {
    id: true,
    businessName: true,
    city: true,
    services: {
      select: {
        id: true,
        name: true,
        price: true,
      }
    },
    user: {
      select: {
        firstName: true,
        lastName: true,
        // email/phone ALDRIG i publikt API!
      }
    }
  }
})
```

**Impact:**
- 40-50% mindre payload
- GDPR-compliant (exponerar inte PII)
- Bättre performance (mindre data över nätverket)

---

## 8. Saknade Database Indexes

> **Learning: 2025-11-16** | **Severity: PERFORMANCE**

**Problem:** Queries blir 10-30x långsammare utan indexes vid skalning.

```prisma
model Provider {
  // ... fields ...

  // ❌ SAKNAS - queries blir 10-30x långsammare vid skalning

  // ✅ LÄGG TILL dessa från dag 1:
  @@index([isActive, createdAt])  // För filter + sort
  @@index([city])                  // För search/filter
  @@index([businessName])          // För search
}

model Service {
  // ... fields ...

  @@index([providerId, isActive])  // Foreign key + filter
}
```

**Pattern - Lägg alltid till index på:**
- Fält du filtrerar på (`where: { isActive: true }`)
- Fält du sorterar på (`orderBy: { createdAt: 'desc' }`)
- Fält du söker på (`contains`, `startsWith`)
- Foreign keys + vanliga filter-kombinationer

**Impact:** 10-30x snabbare queries vid 1,000+ rows!

**Verifiera med:**
```sql
EXPLAIN ANALYZE SELECT * FROM "Provider" WHERE city = 'Stockholm';
```

---

## 9. NextAuth v5 Migration

> **Learning: 2026-01-22** | **Severity: MEDIUM**

**Problem:** NextAuth v5 har nytt API - gammal kod fungerar inte.

### Auth i Server Components/API Routes

```typescript
// ❌ GAMMAL (NextAuth v4)
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
const session = await getServerSession(authOptions)

// ✅ NY (NextAuth v5)
import { auth } from "@/lib/auth"
const session = await auth()
```

### API Route Handler

```typescript
// ❌ GAMMAL (v4)
import NextAuth from "next-auth"
export default NextAuth(authOptions)

// ✅ NY (v5)
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### Middleware

```typescript
// ❌ GAMMAL (v4)
import { withAuth } from "next-auth/middleware"
export default withAuth(...)

// ✅ NY (v5)
import { auth } from "@/lib/auth"
export default auth((req) => { ... })
```

### Test Mocks

```typescript
// ❌ GAMMAL mock
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mocked(getServerSession).mockResolvedValue(session)

// ✅ NY mock
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mocked(auth).mockResolvedValue(session)

// För auth-server.ts som kastar vid 401:
vi.mocked(auth).mockRejectedValue(
  NextResponse.json({ error: "Unauthorized" }, { status: 401 })
)
```

**Impact:** Enklare API, bättre Edge-kompatibilitet, mer naturlig middleware-integration.

---

## 10. TypeScript Memory Issues

> **Learning: 2026-01-22** | **Severity: LOW**

**Problem:** `tsc --noEmit` kraschar med "JavaScript heap out of memory".

**Orsak:** Projekt med >150 TypeScript-filer + Next.js 16 type complexity.

### Workaround 1: Öka heap (quick fix)
```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit
```

### Workaround 2: Använd next build istället
```bash
# next build kör egen type check
npm run build
```

### Workaround 3: Incremental builds
```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

**Impact:** `next build` fungerar alltid, men standalone `tsc --noEmit` kan kräva mer minne.

---

## 11. Frontend Data Normalisering

> **Learning: 2026-01-26** | **Severity: MEDIUM**

**Problem:** Frontend visar bara data som kommer från backend, men backend kanske inte returnerar alla förväntade items.

**Symptom:** Användare rapporterar att data "försvinner" efter sparande (t.ex. vissa veckodagar i ett schema).

```typescript
// ❌ FEL - Visar bara det som kommer från DB
const fetchSchedule = async () => {
  const data = await fetch('/api/schedule').then(r => r.json())
  setSchedule(data)  // Om DB bara har 5 av 7 dagar, visas bara 5!
}

// ✅ RÄTT - Normalisera data, fyll i saknade items
const fetchSchedule = async () => {
  const data = await fetch('/api/schedule').then(r => r.json())

  // Säkerställ att alla 7 dagar finns
  const complete = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const existing = data.find((d: any) => d.dayOfWeek === dayOfWeek)
    return existing || { dayOfWeek, startTime: "09:00", endTime: "17:00", isClosed: false }
  })
  setSchedule(complete)
}
```

**Pattern - Normalisera alltid när:**
- Du förväntar dig en fast struktur (7 veckodagar, 12 månader, etc.)
- Backend kan returnera partial data
- Ordningen på items är viktig (index-baserad rendering)

**Impact:** Data "försvinner" inte längre efter CRUD-operationer.

---

## 12. Generiska Felmeddelanden

> **Learning: 2026-01-26** | **Severity: MEDIUM**

**Problem:** "Internal error" eller "Något gick fel" gör debugging omöjligt.

**Symptom:** Användare rapporterar fel men du kan inte reproducera eller debugga.

```typescript
// ❌ FEL - Ingen info för debugging
} catch (error) {
  console.error("Error:", error)
  return new Response("Internal error", { status: 500 })
}

// ✅ RÄTT - Returnera detaljer (i dev/staging) + logga allt
} catch (error) {
  console.error("Error updating schedule:", error)

  // Returnera detaljer för debugging
  return NextResponse.json(
    {
      error: "Internal error",
      details: error instanceof Error ? error.message : "Unknown error"
    },
    { status: 500 }
  )
}
```

**Frontend - Visa detaljerna:**
```typescript
// ❌ FEL - Generiskt meddelande
} catch (error) {
  toast.error("Kunde inte spara")
}

// ✅ RÄTT - Visa detaljer om de finns
const errorData = await response.json().catch(() => ({}))
console.error("Error response:", response.status, errorData)
toast.error(errorData.details || errorData.error || "Kunde inte spara")
```

**OBS:** I produktion, överväg att dölja känsliga detaljer från användare men ALLTID logga dem server-side.

**Impact:** Snabbare debugging, färre "det bara fungerar inte"-rapporter.

---

## 13. Connection Pool Exhaustion

> **Learning: 2026-01-26** | **Severity: KRITISKT**

**Problem:** Parallella databasanrop (`Promise.all`) kan överskrida Supabase Session Pooler-gränsen.

**Symptom:** `FATAL: MaxClientsInSessionMode: max clients reached`

```typescript
// ❌ FEL - 7 parallella connections
const createPromises = schedule.map((item) =>
  prisma.availability.upsert({
    where: { providerId_dayOfWeek: { providerId, dayOfWeek: item.dayOfWeek } },
    update: { ...item },
    create: { providerId, ...item },
  })
)
await Promise.all(createPromises)  // 7 connections samtidigt!

// ✅ RÄTT - Använd transaction (1 connection)
const result = await prisma.$transaction(async (tx) => {
  // Alla operationer inom transaktionen delar samma connection
  await tx.availability.deleteMany({ where: { providerId } })

  for (const item of schedule) {
    await tx.availability.create({
      data: { providerId, ...item },
    })
  }

  return tx.availability.findMany({ where: { providerId } })
})
```

**Varför?**
- Supabase Session Pooler har begränsat antal connections (ofta 10-20)
- `Promise.all` med N operationer = N simultana connections
- Serverless = många instanser kan köra samtidigt → ännu fler connections

**Pattern - Använd `$transaction` när:**
- Du gör flera write-operationer som hör ihop
- Du gör batch-operationer (skapa/uppdatera många records)
- Operationerna ska vara atomära (allt eller inget)

**Bonus:** Transaktioner ger också atomicitet - om något misslyckas rullas allt tillbaka.

**OBS - Zombie-processer (Prisma Studio):**
Prisma Studio (`npm run db:studio`) stängs INTE automatiskt och lever kvar i bakgrunden. Flera instanser ackumuleras över tid och äter upp connections.

```bash
# Kolla om Prisma Studio-processer körs
ps aux | grep prisma

# Döda alla Prisma Studio-processer
pkill -f "prisma studio"
```

**Impact:** Förhindrar "max clients reached" errors i produktion och lokalt.

---

## 14. Prisma DATE-kolumner och Timezone

> **Learning: 2026-01-27** | **Severity: HIGH**

**Problem:** Prisma `@db.Date` kolumner kräver UTC-datum för konsekvent lagring/hämtning.

**Symptom:** DELETE/UPDATE hittar inte records som skapades med lokal tid, returnerar 404.

```typescript
// ❌ FEL - Lokal tid ger olika UTC-värden beroende på timezone
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)  // Lokal tid!
}
// I Stockholm (UTC+1): "2026-01-27" -> 2026-01-26T23:00:00.000Z
// Sparas som 2026-01-26 i databasen!

// ✅ RÄTT - Använd alltid UTC för databasdatum
function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)  // Explicit UTC
}
// Överallt: "2026-01-27" -> 2026-01-27T00:00:00.000Z
// Sparas som 2026-01-27 i databasen!
```

**Varför?**
- PostgreSQL DATE lagrar endast datum (ingen tid)
- Prisma konverterar Date-objekt till UTC före lagring
- Om du skapar med lokal tid och söker med lokal tid kan det bli olika UTC-värden

**Pattern - För Prisma DATE-kolumner:**
- Använd alltid UTC när du skapar Date-objekt
- Använd `src/lib/date-utils.ts` → `parseDate()` som är konfigurerad för UTC
- Formatera tillbaka med `formatDateToString()` som också använder UTC

**Impact:** Records hittas inte vid UPDATE/DELETE om timezone är inkonsekvent.

---

## 15. Safari Date Parsing

> **Learning: 2026-01-27** | **Severity: MEDIUM**

**Problem:** `new Date("YYYY-MM-DD")` tolkas inkonsekvent mellan webbläsare.

**Symptom:** Datum visas fel i Safari/iOS - ofta en dag fel (t.ex. 26 jan istället för 27 jan).

```typescript
// ❌ FEL - Inkonsekvent mellan webbläsare
const date = new Date("2026-01-27")
// Chrome: 2026-01-27T00:00:00 (lokal tid)
// Safari: 2026-01-27T00:00:00Z (UTC) → visas som 26 jan i UTC+1

// ✅ RÄTT - Explicit parsing, konsekvent överallt
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)  // Lokal tid, alla webbläsare
}

// ELLER för UTC (rekommenderas för databas):
function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}
```

**Varför?**
- ISO 8601 date-only strings ("YYYY-MM-DD") tolkas som UTC i Safari
- Chrome/Firefox tolkar dem som lokal tid
- Detta ger off-by-one errors i tidszoner väster om UTC

**Pattern - Använd alltid explicit parsing:**
- Importera `parseDate` från `src/lib/date-utils.ts`
- Undvik `new Date("YYYY-MM-DD")` direkt
- Testa alltid datumlogik i Safari/iOS

**Impact:** Datum visas fel för ~15% av användare (Safari/iOS-användare).

---

## 16. Serverless State & Storage

> **Learning: 2026-01-21** | **Severity: KRITISKT**

**Problem:** Serverless-funktioner är stateless och ephemeral - många vanliga patterns fungerar inte.

**Vad som INTE fungerar i serverless:**

```typescript
// ❌ In-memory state - delas INTE mellan instanser
const cache = new Map<string, Data>()
const attempts = new Map<string, number>()
let globalCounter = 0

// ❌ Filesystem writes - ephemeral, försvinner
fs.writeFileSync('/tmp/data.json', data)  // Kan försvinna när som helst

// ❌ Long-running processes - 10 min timeout på Vercel
setInterval(() => cleanup(), 60000)  // Körs aldrig
await longRunningTask()  // Timeout efter 10 min
```

**Vad som FUNGERAR:**

```typescript
// ✅ Stateless design - ingen lokal state
async function handler(req: Request) {
  const data = await fetchFromDB()  // Hämta state från extern källa
  return process(data)
}

// ✅ Externa datastores
import { Redis } from "@upstash/redis"
const redis = Redis.fromEnv()
await redis.set("key", value, { ex: 3600 })

// ✅ Background jobs för långvariga tasks
import { inngest } from "@/lib/inngest"
await inngest.send({ name: "long.task", data: {...} })
```

**Pattern - Tänk så här:**
- Varje request kan hamna på en ny instans
- Allt lokalt försvinner mellan requests
- Alla delade resurser måste vara externa (Redis, S3, databas)

**Impact:** In-memory state fungerar lokalt men failar i produktion.

---

## 17. Upsert för Race Conditions

> **Learning: 2026-01-27** | **Severity: HIGH**

**Problem:** Check-then-create pattern skapar race conditions vid simultana requests.

```typescript
// ❌ FEL - Race condition: två requests kan skapa duplicates
const existing = await prisma.exception.findUnique({
  where: { providerId_date: { providerId, date } }
})

if (existing) {
  await prisma.exception.update({
    where: { id: existing.id },
    data: { ...newData }
  })
} else {
  await prisma.exception.create({
    data: { providerId, date, ...newData }
  })
}
// ⚠️ Två requests samtidigt → båda ser "finns inte" → duplicate key error

// ✅ RÄTT - Upsert är atomär
await prisma.exception.upsert({
  where: {
    providerId_date: {
      providerId,
      date
    }
  },
  update: {
    ...newData
  },
  create: {
    providerId,
    date,
    ...newData
  }
})
// Databasen hanterar concurrency - ingen race condition
```

**Varför?**
- `upsert` är en enda atomär operation i databasen
- Databasen hanterar locking/concurrency internt
- Inga "gaps" där en annan request kan smyga in

**Pattern - Använd upsert när:**
- Du har en unique constraint (composite key)
- Användare kan skicka samma data flera gånger (double-click, retry)
- Operationen ska vara idempotent

**Impact:** Eliminerar duplicate key errors och race conditions.

---

## 18. Behavior-Based vs Implementation-Based Testing

> **Learning: 2026-01-21** | **Severity: MEDIUM**

**Problem:** Implementation-based tester går sönder vid refactoring även om funktionaliteten är oförändrad.

```typescript
// ❌ IMPLEMENTATION-BASED - testar HOW
describe('GET /api/providers', () => {
  it('should call prisma with correct params', async () => {
    await GET(mockRequest)

    expect(prisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        include: { services: true }
      })
    )
  })
})
// Problem: Om du ändrar från include till select → test failar
// Problem: Om du lägger till caching → test failar
// Även om API:et returnerar exakt samma data!

// ✅ BEHAVIOR-BASED - testar WHAT
describe('GET /api/providers', () => {
  it('should return active providers with services', async () => {
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      id: expect.any(String),
      businessName: expect.any(String),
      services: expect.any(Array)
    })
  })

  it('should not expose sensitive data', async () => {
    const response = await GET(mockRequest)
    const data = await response.json()

    expect(data[0].user?.passwordHash).toBeUndefined()
    expect(data[0].user?.email).toBeUndefined()
  })
})
// Överlever refactoring - testar API-kontraktet
```

**Fördelar med behavior-based:**
- Tester överlever refactorings
- Testar det användaren faktiskt bryr sig om (responsen)
- Fångar säkerhetsproblem (känslig data som läcker)
- Dokumenterar API-kontraktet

**Impact:** Mindre test-underhåll, bättre förtroende vid refactoring.

---

## 19. E2E Tests Fångar API-Buggar

> **Learning: 2026-01-28** | **Severity: MEDIUM**

**Problem:** Unit tests med mockade beroenden missar integration-buggar.

**Vad E2E-tester fångar som unit tests missar:**

```typescript
// Unit test - PASSERAR (mockar bort verkliga problem)
vi.mock('@prisma/client')
vi.mocked(prisma.booking.create).mockResolvedValue(mockBooking)

it('should create booking', async () => {
  const response = await POST(mockRequest)
  expect(response.status).toBe(201)  // ✅ Passerar alltid
})

// Men i verkligheten...
// ❌ Saknat fält i Zod schema
// ❌ Foreign key constraint failure
// ❌ Unique constraint violation
// ❌ Felaktig date parsing
// ❌ Missing authorization check
```

**E2E-test fångar dessa:**

```typescript
// E2E test - testar hela stacken
test('should create booking with valid data', async ({ page }) => {
  await page.goto('/providers/123')
  await page.click('[data-testid="book-service"]')
  await page.fill('[name="date"]', '2026-02-15')
  await page.click('[type="submit"]')

  // Denna assertion fångar ALLA problem i kedjan:
  // - Zod validation
  // - Prisma constraints
  // - Auth checks
  // - Response format
  await expect(page.locator('[data-testid="booking-confirmation"]')).toBeVisible()
})
```

**Pattern - E2E för kritiska flöden:**
- Autentisering och authorization
- Betalningsflöden
- CRUD för kärndomäner (bookings, providers)
- Användarresor med flera steg

**Balans:**
| Test Type | Vad det testar | Hastighet | Coverage |
|-----------|----------------|-----------|----------|
| Unit | Isolerad logik | Snabb | Djup |
| Integration | API endpoints | Medium | Medium |
| E2E | Hela flödet | Långsam | Bred |

**Impact:** Fångar buggar som unit tests missar, särskilt validation och constraints.

---

## 20. Vercel Build Timeout (ignoreBuildErrors)

> **Learning: 2026-01-29** | **Severity: KRITISKT**

**Problem:** `next build` kör en full TypeScript-check som tar 14+ minuter på Vercels 8GB maskin.

**Symptom:** Vercel-build hänger sig vid "Running TypeScript ..." och tar 14+ minuter istället för ~50 sekunder.

**Orsak:** Projektet har 150+ TypeScript-filer inklusive testfiler. `next build` typecheckar ALLA filer via `tsconfig.json`, som inkluderar `**/*.ts` och `**/*.tsx` (alltså även tester).

```typescript
// ❌ FEL - next.config.ts UTAN ignoreBuildErrors
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  // TypeScript-check körs under build -> 14+ min timeout
}

// ✅ RÄTT - TypeScript checkas i CI, inte under build
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  // TypeScript errors checked separately in CI - skip during build to avoid timeout
  typescript: {
    ignoreBuildErrors: true,
  },
}
```

**Varför är detta säkert?**
- TypeScript checkas redan via Husky pre-push hook (`npm run typecheck`)
- TypeScript checkas i GitHub Actions CI pipeline
- `tsconfig.typecheck.json` exkluderar testfiler och använder incremental builds
- Dubbelarbete att köra det igen i `next build`

**VARNING:** Denna inställning ser "osäker" ut och kan tas bort vid refaktorering. Den är en MEDVETEN optimering, inte ett hack.

**Impact:** Build-tid: 14+ min -> ~50 sekunder.

---

## 21. CSP Blockerar Web Workers (browser-image-compression)

> **Learning: 2026-01-30** | **Severity: MEDIUM**

**Problem:** `browser-image-compression` använder Web Workers via blob-URLs. Utan `worker-src` i Content Security Policy blockerar browsern workern.

**Symptom:** `Refused to load blob:http://localhost:3000/... because it does not appear in the worker-src directive of the Content Security Policy.`

```typescript
// ❌ FEL - CSP utan worker-src
"default-src 'self'",
"img-src 'self' data: blob: https:",
// blob: i img-src hjälper INTE - workers har eget direktiv

// ✅ RÄTT - Lägg till worker-src
"default-src 'self'",
"img-src 'self' data: blob: https:",
"worker-src 'self' blob:", // Krävs för browser-image-compression
```

**Varför?**
- `img-src blob:` tillåter blob-URLs för bilder, men inte för workers
- `worker-src` är ett separat CSP-direktiv
- Om `worker-src` saknas faller det tillbaka till `script-src`, som inte tillåter `blob:`

**Pattern - Kontrollera CSP vid nya bibliotek:**
- Läs bibliotekets dokumentation om Web Workers, Service Workers, eller WebAssembly
- Testa med strikt CSP i dev (inte bara produktion)

**Impact:** Bildkomprimering misslyckas tyst, okomprimerade bilder kan inte laddas upp.

---

## 22. Mock-uploads Måste Servas av Next.js

> **Learning: 2026-01-30** | **Severity: MEDIUM**

**Problem:** Mock-upload som returnerar en påhittad URL ger 404 eftersom ingen route servrar filen.

**Symptom:** `Failed to load resource: the server responded with a status of 404` för uppladdade bilder i dev-läge.

```typescript
// ❌ FEL - URL pekar ingenstans
const mockUrl = `/mock-uploads/${bucket}/${fileName}`
return { data: { path: mockPath, url: mockUrl } }
// Next.js har ingen route för /mock-uploads/* → 404

// ✅ RÄTT - Spara till public/ så Next.js servrar filen
import { writeFile, mkdir } from "fs/promises"
const dir = nodePath.join(process.cwd(), "public", "uploads", bucket)
await mkdir(dir, { recursive: true })
await writeFile(nodePath.join(dir, fileName), buffer)
const mockUrl = `/uploads/${bucket}/${fileName}`
// Next.js servrar allt i public/ automatiskt
```

**Varför?**
- Next.js servrar statiska filer från `public/` automatiskt
- En påhittad URL utan motsvarande fil eller route ger alltid 404
- I produktion används Supabase Storage som returnerar riktiga URLs

**OBS:** Lägg till `/public/uploads/` i `.gitignore` så dev-bilder inte committas.

**Impact:** Uppladdade bilder visas inte alls i dev-läge utan Supabase.

---

## 23. Vercel env pull Overskrider Lokal Config

> **Learning: 2026-02-03** | **Severity: HIGH**

**Problem:** `vercel env pull` skapar `.env.local` med produktionsvärden som overskrider `.env`.

**Symptom:** Inloggning fungerar inte lokalt trots korrekt databas och lösenord. Felmeddelande: "Ogiltig email eller lösenord".

```bash
# Next.js prioritetsordning (högst först):
# 1. .env.local        ← Vercel env pull skriver hit!
# 2. .env.development
# 3. .env
```

```bash
# .env (lokal dev - KORREKT)
NEXTAUTH_URL="http://localhost:3000"

# .env.local (skapad av Vercel CLI - OVERSKRIDER .env!)
NEXTAUTH_URL="https://equinet-app.vercel.app"
# ❌ NextAuth tror appen kör på Vercel → CSRF-validering misslyckas
```

**Varför?**
- `NEXTAUTH_URL` styr CSRF-token-validering och cookie-domän
- Om URL:en inte matchar faktisk host misslyckas autentisering tyst
- NextAuth returnerar 200 men med error i body - inget tydligt felmeddelande server-side

**Fix efter `vercel env pull`:**
```bash
# Kontrollera och korrigera NEXTAUTH_URL i .env.local
grep NEXTAUTH_URL .env.local
# Ändra till: NEXTAUTH_URL="http://localhost:3000"
```

**Bonus-gotcha:** `.env.local` kan också innehålla Upstash-credentials, vilket gör att lokal dev delar rate-limiter med produktion (5 försök per 15 min). Misslyckade lokala inloggningar kan rate-limita dig.

**Pattern - Efter `vercel env pull`:**
- Kontrollera alltid `NEXTAUTH_URL` - måste vara `http://localhost:3000` lokalt
- Var medveten om att Upstash rate-limiting nu är delad med produktion
- Starta om dev-servern efter `.env.local`-ändringar

**Impact:** Total login-blockering lokalt utan tydligt felmeddelande.

---

## 24. Prisma Migration Workflow (db push -> migrate dev)

> **Learning: 2026-02-04** | **Severity: HIGH**

**Problem:** Projektet anvande `prisma db push` for alla schemaandringar -- ingen migrationshistorik.

**Symptom:** `prisma migrate dev` failar med drift detection. Ingen reversibel historik. Deploy-pipelines kan inte anvanda `prisma migrate deploy`.

```bash
# GAMMALT workflow (ingen historik)
npx prisma db push

# NYTT workflow (med migrationshistorik)
npx prisma migrate dev
```

**Vad som andrades:**
- Baseline migration skapades (`prisma/migrations/0_init/migration.sql`) som representerar hela schemat
- Markerades som applicerad via `prisma migrate resolve --applied 0_init`
- npm scripts uppdaterade: `setup` och `db:reset` anvander nu `migrate dev`/`migrate reset`

**Nytt workflow for schemaandringar:**
```bash
# 1. Andra i prisma/schema.prisma
# 2. Kor migrate dev (skapar migration + applicerar)
npx prisma migrate dev --name add_my_field

# 3. Migrationen hamnar i prisma/migrations/ -- committa den!
git add prisma/migrations/
git commit -m "feat: add my_field to MyModel"
```

**Viktigt:**
- Anvand ALDRIG `db push` langre (forutom for prototyping utan historik)
- `prisma migrate reset` raderar ALLT och kor alla migrationer fran scratch + seed
- Migrationer ar idempotenta -- saker att kora pa ny maskin
- Production deploy: `prisma migrate deploy` (kor bara pending migrations, ingen drift check)

**Impact:** Reversibel migrationshistorik, production-ready deploys, teamkompatibelt.

---

## Relaterade Dokument

- [CLAUDE.md](../CLAUDE.md) - Utvecklingsguide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Bidragsguide
- [Security Review](SECURITY-REVIEW-2026-01-21.md) - Senaste säkerhetsaudit
