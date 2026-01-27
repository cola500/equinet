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

**Impact:** Förhindrar "max clients reached" errors i produktion.

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

## Relaterade Dokument

- [CLAUDE.md](../CLAUDE.md) - Utvecklingsguide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Bidragsguide
- [Security Review](SECURITY-REVIEW-2026-01-21.md) - Senaste säkerhetsaudit
