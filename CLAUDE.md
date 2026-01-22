# CLAUDE.md - Utvecklingsguide för Equinet

> **Hur** vi arbetar i projektet. För **vad** som är byggt, se README.md.

## 📌 Projekt

- **Stack**: Next.js 16 (App Router) + TypeScript + Prisma + NextAuth + shadcn/ui
- **Språk**: Svenska (UI/docs), Engelska (kod)
- **Approach**: Databas-först, TDD, Feature branches

## 🏗️ Infrastruktur

### Produktion
- **Hosting**: Vercel (Next.js)
- **Databas**: Supabase (PostgreSQL)
- **URL**: Konfigureras via `NEXTAUTH_URL`

### Environment Variables

| Variabel | Beskrivning | Källa |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL connection string | Supabase Dashboard → Project Settings → Database → Session Pooler (IPv4) |
| `NEXTAUTH_SECRET` | Session encryption key | Generera med `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL | `http://localhost:3000` (dev) eller Vercel URL (prod) |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (Production REQUIRED) | Upstash Dashboard → Create Database → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth token | Upstash Dashboard → Database → REST Token |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (Production recommended) | Sentry Dashboard → Project Settings → DSN |
| `SENTRY_ORG` | Sentry organization (optional) | Sentry Dashboard |
| `SENTRY_PROJECT` | Sentry project name (optional) | Sentry Dashboard |
| `GOOGLE_MAPS_API_KEY` | Geocoding (valfritt) | Google Cloud Console |

**⚠️ Production REQUIRED:**
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` - Rate limiting fungerar INTE utan dessa i serverless (Vercel)
- `NEXT_PUBLIC_SENTRY_DSN` - Starkt rekommenderat för error tracking och monitoring

### 🔍 Recent Security & Architecture Reviews

**Latest Review:** [2026-01-21 Security & Architecture Review](docs/SECURITY-REVIEW-2026-01-21.md)
- ✅ 10 kritiska säkerhetsfixar implementerade
- ✅ Sentry monitoring setup
- ✅ Repository pattern enforced i alla API routes
- ✅ Production Readiness: 6/10 → 8/10

**Key Learnings:**
- Rate limiting MÅSTE använda Redis i serverless (in-memory fungerar EJ)
- IDOR fixas genom atomic authorization checks (i WHERE clause)
- Repository pattern var "dead code" tills vi refactorerade API routes
- Monitoring är mandatory för production (ej "nice-to-have")

**Full Retrospektiv:** [docs/retrospectives/2026-01-21-security-architecture-review.md](docs/retrospectives/2026-01-21-security-architecture-review.md)

### Supabase Setup (Lokal Utveckling)

1. Skapa projekt på [supabase.com](https://supabase.com)
2. Hämta connection string:
   - Project Settings → Database → Connection string
   - **Välj Session Pooler (IPv4)** - fungerar med serverless och lokal utveckling
3. Kopiera till `.env`:
   ```bash
   cp .env.example .env
   # Redigera DATABASE_URL med din Supabase connection string
   ```

### Viktigt om Connection Strings

- **Session Pooler (IPv4)**: Använd för Vercel/serverless + lokal utveckling
- **Direct Connection**: Endast för persistent connections (ej serverless)
- **Transaction Pooler**: För korta queries med pooling

## 🎯 Workflow

### Dagliga Kommandon
```bash
npm run dev              # Dev server
npm run db:studio        # Prisma Studio
npx prisma generate      # Efter schema-ändringar
npx prisma db push       # Pusha schema

npm test                 # Unit tests (watch)
npm run test:e2e         # E2E tests
npx tsc --noEmit         # TypeScript check

rm -rf .next && npm run dev  # Rensa cache
```

### Release & Versionshantering

Projektet använder [standard-version](https://github.com/conventional-changelog/standard-version) för automatisk versionering baserat på conventional commits.

**Release-kommandon:**
```bash
npm run release              # Auto-detect (patch/minor/major)
npm run release:minor        # Force minor bump (0.2.0 → 0.3.0)
npm run release:major        # Force major bump (0.2.0 → 1.0.0)
```

**Vad händer vid release:**
1. Version i `package.json` uppdateras
2. `CHANGELOG.md` genereras/uppdateras automatiskt
3. Git tag skapas (t.ex. `v0.2.0`)
4. Release commit skapas

**Publicera release:**
```bash
git push --follow-tags origin main
```

**Commit-typer som påverkar version:**
- `feat:` → Minor version bump (nya features)
- `fix:` → Patch version bump (buggfixar)
- `BREAKING CHANGE:` → Major version bump

**Konfiguration:** `.versionrc.json`

### Feature Implementation (Databas-först + TDD)

1. **Planering**: Schema → API → UI
2. **TDD-cykel**: 🔴 Red → 🟢 Green → 🔵 Refactor
3. **Feature branch**: `git checkout -b feature/namn`
4. **Merge till main**: Efter alla tester är gröna
5. **Push**: Till remote

## 🧪 Testing (TDD är Obligatoriskt!)

**Skriv tester FÖRST för:**
- ✅ API routes (högst prioritet!)
- ✅ Utilities, hooks, business logic

**Coverage-mål:**
- API Routes: ≥80%, Utilities: ≥90%, Overall: ≥70%

**Test naming:**
```typescript
describe('POST /api/bookings', () => {
  it('should create booking when valid data is provided', async () => {
    // Arrange, Act, Assert
  })
  it('should return 400 when date is in the past', async () => {})
})
```

### Behavior-Based Testing (API Routes)

**Pattern (från Sprint 1 F1-2):**
Testa **vad** API:et gör, inte **hur** det gör det.

```typescript
// ❌ DÅLIGT: Implementation-based (testar Prisma-anrop)
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    include: { services: true, user: true }
  })
)

// ✅ BRA: Behavior-based (testar API-kontrakt)
expect(response.status).toBe(200)
expect(data[0]).toMatchObject({
  id: expect.any(String),
  businessName: 'Test Provider',
})

// ✅ Security assertions (ALLTID!)
expect(data[0].user.email).toBeUndefined()
expect(data[0].user.passwordHash).toBeUndefined()
```

**Varför behavior-based?**
- ✅ Tester överlever refactorings (t.ex. `include` → `select`)
- ✅ Testar faktiskt användarupplevelse (API-kontrakt)
- ✅ Fångar säkerhetsproblem (data leaks)
- ✅ Gör kod mer maintainable

**När använda implementation checks?**
- Vid regression tests för specifika buggar
- När du testar mock/spy behavior i unit tests
- ALDRIG i API integration tests (testa behavior istället)

## 🎓 E2E Testing Best Practices

### Kod-Först Approach (The Golden Rule)
**Problem:** Gissa fältnamn = 5-10 iterationer
**Lösning:** Kolla koden INNAN → 1-2 iterationer ✅

```bash
# 1. Utforska koden först
Read src/app/register/page.tsx  # Hitta labels, data-testid

# 2. Använd Playwright Codegen för komplexa flows
npx playwright codegen http://localhost:3000

# 3. Skriv testen med exakt info från koden
```

### Selector Priority (bäst → sämst)
1. **data-testid** (lägg ALLTID till på list-items, cards, buttons)
2. **Semantic roles** (`getByRole('button', { name: /text/i })`)
3. **nth()** för multiples
4. ❌ UNDVIK CSS classes, komplex DOM traversal

### Vanliga Patterns

**Conditional Fields:**
```typescript
// Fyll synliga fält först
await page.fill('email', 'test@example.com')
// Trigga conditional rendering
await page.click('[data-testid="toggle"]')
// Vänta på synlighet
await page.waitForSelector('#hiddenField', { state: 'visible' })
// NU kan vi fylla conditional field
```

**Empty State:**
```typescript
const count = await page.locator('[data-testid="item"]').count()
if (count === 0) {
  await expect(page.getByRole('heading', { name: /inga/i })).toBeVisible()
} else {
  await expect(page.locator('[data-testid="item"]').first()).toBeVisible()
}
```

**Timing:**
```typescript
// ✅ Vänta på specifikt condition
await expect(page.getByText(/success/i)).toBeVisible({ timeout: 5000 })

// ❌ UNDVIK arbiträra timeouts
await page.waitForTimeout(1000)  // Endast sista utväg
```

## 🔑 Kritiska Patterns

### API Route Pattern
```typescript
export async function POST(request: Request) {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions)
    if (!session) return new Response("Unauthorized", { status: 401 })

    // 2. Parse JSON med error handling (VIKTIGT!)
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      )
    }

    // 3. Validera med Zod
    const validated = schema.parse(body)

    // 4. Authorization check (äger användaren resursen?)

    // 5. Databas-operation
    const result = await prisma.model.create({ data: validated })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error:", error)
    return new Response("Internal error", { status: 500 })
  }
}
```

### Filstruktur
```
src/app/api/[feature]/
├── route.ts              # GET, POST
├── route.test.ts         # Tester
├── [id]/
│   ├── route.ts          # GET, PUT, DELETE
│   └── route.test.ts
```

## 🐛 Vanliga Gotchas

### 1. Next.js 16 Dynamic Params
```typescript
// ✅ RÄTT - params är en Promise
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // Måste awaita!
}
```

### 2. Zod Error Handling
```typescript
// ✅ Använd error.issues (INTE error.errors)
if (error instanceof z.ZodError) {
  return { error: error.issues }
}
```

### 3. Turbopack Cache
```bash
pkill -f "next dev"
rm -rf .next node_modules/.cache
npm run dev
```

### 4. NextAuth Session Update
```typescript
const { data: session, update } = useSession()
await update()  // Efter profile changes
```

### 5. Rate Limiting i Serverless (Learning: 2026-01-21) ⚠️ KRITISKT
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
const isAllowed = await rateLimiters.booking(userId)
if (!isAllowed) return 429
```

**Impact:** Production blocker! Rate limiting fungerar INTE utan Redis i serverless.

### 6. IDOR med Race Condition (Learning: 2026-01-21) ⚠️ SÄKERHET
```typescript
// ❌ FEL - Authorization check FÖRE update (TOCTOU race condition)
const booking = await prisma.booking.findUnique({ where: { id } })
if (booking.customerId !== userId) return 403
await prisma.booking.update({ where: { id }, data: {...} })

// ✅ RÄTT - Authorization i WHERE clause (atomärt)
await prisma.booking.update({
  where: { id, customerId: userId },  // Auth + operation i SAMMA query
  data: {...}
})
```

**Impact:** Eliminerar IDOR + race conditions!

### 7. Prisma Over-Fetching (Learning: 2025-11-16)
```typescript
// ❌ FEL - include hämtar ALLT (over-fetching + exponerar känslig data)
const providers = await prisma.provider.findMany({
  include: {
    services: true,
    user: true,  // Ger oss email, phone, passwordHash 😱
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

**Impact:** 40-50% mindre payload + GDPR-compliant! (F-3.4)

### 8. Saknade Database Indexes (Learning: 2025-11-16)
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

**Impact:** 10-30x snabbare queries vid 1,000+ rows! (F-3.4)

### 9. NextAuth v5 Migration (Learning: 2026-01-22)
```typescript
// ❌ GAMMAL (NextAuth v4)
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
const session = await getServerSession(authOptions)

// ✅ NY (NextAuth v5)
import { auth } from "@/lib/auth"
const session = await auth()

// API Route handler
// ❌ GAMMAL (v4)
import NextAuth from "next-auth"
export default NextAuth(authOptions)

// ✅ NY (v5)
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers

// Middleware
// ❌ GAMMAL (v4)
import { withAuth } from "next-auth/middleware"
export default withAuth(...)

// ✅ NY (v5)
import { auth } from "@/lib/auth"
export default auth((req) => { ... })
```

**Test Mocks - Viktigt!**
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

### 10. TypeScript Memory Issues (Learning: 2026-01-22)
```bash
# Problem: tsc --noEmit kraschar med "JavaScript heap out of memory"
# Orsak: Projekt med >150 TypeScript-filer + Next.js 16 type complexity

# Workaround 1: Öka heap (quick fix)
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit

# Workaround 2: Använd next build istället (kör egen type check)
npm run build

# Workaround 3: Incremental builds (tsconfig.json)
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

**Impact:** `next build` fungerar alltid, men standalone `tsc --noEmit` kan kräva mer minne.

## ✅ Definition of Done

En feature är **DONE** när:

### 1. Funktionalitet
- [ ] Fungerar som förväntat (manuellt testad)
- [ ] Inga TypeScript-fel (`npx tsc --noEmit`)
- [ ] Inga console errors
- [ ] Responsiv (desktop)

### 2. Kod-kvalitet
- [ ] Följer projektkonventioner
- [ ] Säker (ingen XSS, SQL injection, etc.)
- [ ] Error handling (try-catch, loggar fel)
- [ ] Zod-validering (client + server)

### 3. Dokumentation
- [ ] README uppdaterad INNAN commit (om ny feature)
- [ ] Kommentarer vid komplex logik

### 4. Git (Feature Branch Workflow)
- [ ] Feature branch skapad (`feature/namn`)
- [ ] Committed med beskrivande message
- [ ] **Alla tester gröna INNAN merge** (unit + E2E)
- [ ] Mergad till main
- [ ] Pushad till remote

### 5. Testing (TDD)
- [ ] Unit tests skrivna FÖRST
- [ ] E2E tests uppdaterade
- [ ] Coverage ≥70%
- [ ] Manuell testning

### 6. Release (vid milstolpe/sprint-slut)
- [ ] `npm run release` för att skapa ny version
- [ ] CHANGELOG.md genererad och korrekt
- [ ] Git tag skapad
- [ ] `git push --follow-tags origin main`

## ✅ Production Readiness Checklist

**Kör detta INNAN production deployment!**

### Security (MANDATORY)
- [ ] Rate limiting använder Redis (INTE in-memory) → fungerar i serverless
- [ ] Authorization checks är atomära (i WHERE clause, ej före queries)
- [ ] Cookies är `sameSite: strict` + `secure: true` i production
- [ ] Ingen PII/känslig data exponeras i publika API endpoints
- [ ] All user input är validerad (Zod client + server)
- [ ] Error messages exponerar INTE interna detaljer

### Monitoring (HIGHLY RECOMMENDED)
- [ ] Sentry DSN konfigurerad (`NEXT_PUBLIC_SENTRY_DSN`)
- [ ] Error tracking fungerar (testa genom att kasta error)
- [ ] Performance monitoring aktivt (trace sampling)
- [ ] Logs går till external service (ej bara console)

### Architecture (MANDATORY)
- [ ] API routes använder repositories (INTE direkt Prisma)
- [ ] TypeScript errors = 0 (`npx tsc --noEmit`)
- [ ] No `ignoreBuildErrors: true` i next.config.ts
- [ ] Database indexes på alla filter/sort fält

### Environment Variables (MANDATORY)
```bash
# Required i Vercel:
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://..."
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Recommended:
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_ORG="..."
SENTRY_PROJECT="..."
```

### Performance
- [ ] Response times <200ms för vanliga endpoints
- [ ] Payload sizes <100KB för listor
- [ ] Database queries använder indexes (kolla med EXPLAIN)
- [ ] Pagination implementerad för listor >100 items

### Pre-Deployment Smoke Test
```bash
# 1. Verifiera build fungerar
npm run build

# 2. Kör full test suite
npm run test:run && npm run test:e2e

# 3. TypeScript check
npx tsc --noEmit

# 4. Manuella smoke tests i production-like miljö
# - Login/logout
# - Create booking
# - Provider search
# - Error states
```

**Production Readiness Score Target: 8/10 minimum**

Se [docs/SECURITY-REVIEW-2026-01-21.md](docs/SECURITY-REVIEW-2026-01-21.md) för senaste security audit.

## 🚨 Debugging (UI → DB)

```
🎨 UI Layer (Browser console, React DevTools)
   ↓
📱 Client Layer (Network tab - request/response)
   ↓
🔌 API Layer (Server console logs)
   ↓
💾 Database Layer (Prisma Studio)
```

**Checklist när något failar:**
1. [ ] Browser console - errors?
2. [ ] Network tab - request skickad? response?
3. [ ] Server terminal - loggas något?
4. [ ] Lägg till debug-logging
5. [ ] Prisma Studio - finns data?
6. [ ] Fixa i rätt lager
7. [ ] Testa igen

## 🔒 Säkerhet

### Implementerat
- ✅ bcrypt password hashing, HTTP-only cookies, CSRF protection
- ✅ SQL injection protection (Prisma), XSS protection (React)
- ✅ Input validation (Zod client + server)
- ✅ Authorization checks (session + ownership)

### Checklist för Nya API Routes
- [ ] Session check
- [ ] Input validation (Zod)
- [ ] Ownership check
- [ ] Error handling (Zod, Prisma, JSON parsing)
- [ ] Logga errors

## 💾 Disk Space Management

**Problem:** Git push failar vid lågt diskutrymme (signal 10)

**Quick Fix:**
```bash
git config core.compression 0
git push
git config --unset core.compression
```

**Cleanup:**
```bash
npm cache clean --force
rm -rf .next
npx playwright uninstall --all  # Om inte används
```

**Håll >15GB fritt** för säker utveckling!

## 🎨 Design System

- **Färger**: Primary `green-600`, Background `gray-50`, Text `gray-900`/`gray-600`
- **Komponenter**: shadcn/ui (`npx shadcn@latest add [component]`)
- **Forms**: React Hook Form + Zod

## 📚 Resurser

- **README.md** - Vad som är byggt, roadmap
- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth.ts** - NextAuth config
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)

## 🤖 Agent-Team (Learning: 2025-11-16)

Equinet har **7 specialiserade agenter** som täcker alla kritiska områden från MVP till produktion:

### Agent-Översikt

| Agent | Färg | Ansvar | Använd när |
|-------|------|--------|------------|
| **security-reviewer** | 🔒 Red | Säkerhetsrevision (OWASP, auth, data) | Efter nya API endpoints, före produktion |
| **cx-ux-reviewer** | 🎨 Blue | UX/användarupplevelse | Efter UI-implementering, användarresor |
| **tech-architect** | 🏗️ Purple | Arkitektur & teknisk planering | Nya features, performance-problem |
| **test-lead** | 🧪 Cyan | Test-strategi & TDD-workflow | Efter feature-implementation, coverage-gap |
| **data-architect** | 🗄️ Green | Prisma schema & datamodellering | Nya datamodeller, query-optimering |
| **quality-gate** | ✅ Yellow | DoD-verifiering & release management | Före merge, före release |
| **performance-guardian** | ⚡ Orange | Performance & observability | Performance-problem, monitoring-design |

---

### När Använda Vilken Agent

#### 🔒 security-reviewer
- ✅ Efter implementerat ny auth-logik eller API-endpoints
- ✅ Före deploy till produktion
- ✅ När API exponerar känslig user data
- ✅ Efter säkerhetskritisk kod (payment, PII)

#### 🎨 cx-ux-reviewer
- ✅ Efter implementerat bokningsformulär eller användarflöde
- ✅ När UX-feedback behövs proaktivt
- ✅ Efter nya UI-komponenter
- ✅ Vid användbarhetsproblem

#### 🏗️ tech-architect
- ✅ Nya major features som kräver arkitekturella beslut
- ✅ Performance-problem som påverkar skalning
- ✅ "Ska vi implementera caching nu eller senare?" → Data-driven beslut
- ✅ "Vilken arkitektur för pagination?" → Jämför alternativ
- ❌ Inte för: Enkel buggfix, UI-tweaks

#### 🧪 test-lead
- ✅ Efter feature-implementation → "Är testerna tillräckliga?"
- ✅ Coverage-rapport visar gap → "Vad saknas?"
- ✅ Komplex test-scenario → "Hur testar jag conditional fields?"
- ✅ TDD-planering → "Vilka tester ska jag skriva först?"

#### 🗄️ data-architect
- ✅ Nya datamodeller → "Hur designar jag schema för länkade bokningar?"
- ✅ Performance-problem → "Vilka indexes behövs?"
- ✅ Query-optimering → "Är detta N+1 problem?"
- ✅ Migration-planering → "SQLite → PostgreSQL, vad krävs?"

#### ✅ quality-gate
- ✅ Före merge → "Uppfyller vi DoD?"
- ✅ Före release → "Är vi redo för v1.4.0?"
- ✅ Breaking changes → "Vad påverkas?"
- ✅ Pre-push check → "Allt grönt?"

#### ⚡ performance-guardian
- ✅ Performance-problem → "Varför är dashboard långsam?"
- ✅ Production-förberedelse → "Hur implementerar vi monitoring?"
- ✅ Skalningsplanering → "Klarar vi 1000 samtidiga användare?"
- ✅ Caching-strategi → "Ska vi cacha provider-listan?"

---

### Agent-Kombinationer för Olika Uppgifter

#### 📋 Sprint-Planering
```
tech-architect (arkitektur & roadmap)
+ data-architect (datamodellering)
+ performance-guardian (skalbarhet)
```

#### 🚀 Feature-Implementation (TDD-workflow)
```
1. test-lead (designa tester FÖRST)
2. [Implementera feature]
3. quality-gate (DoD-verifiering)
4. security-reviewer (om säkerhetskritisk)
```

#### ✅ Pre-Merge Checklist
```
quality-gate (DoD compliance)
+ security-reviewer (om säkerhetskritisk kod)
+ test-lead (coverage-kontroll)
```

#### ⚡ Performance-Optimering
```
performance-guardian (bottleneck-identifiering)
+ data-architect (query-optimering, indexes)
+ tech-architect (caching-strategi)
```

#### 🎨 UX/Design Review
```
cx-ux-reviewer (användarupplevelse)
+ test-lead (E2E-tester för user flows)
```

---

### Best Practices: Arbeta med Agenter

✅ **Använd agenter proaktivt** - Inte bara när problem uppstår
✅ **Kombinera agenter** - Låt flera agenter granska olika aspekter
✅ **Följ rekommendationer** - Agenter är byggda på projekt-specifik kunskap
✅ **Dokumentera learnings** - Uppdatera CLAUDE.md med nya insights från agenter

❌ **Undvik att skippa quality-gate** - DoD existerar av en anledning
❌ **Undvik att ignorera security-reviewer** - Säkerhet är kritisk
❌ **Undvik att vänta med test-lead** - TDD = tests först, inte efteråt

---

### Quick Reference

```
Nya features? → tech-architect + data-architect + test-lead
Performance issue? → performance-guardian + data-architect
Säkerhetsaudit? → security-reviewer
UX-feedback? → cx-ux-reviewer
Coverage-gap? → test-lead
Före merge? → quality-gate
Datamodellering? → data-architect
Hitta kod? → Explore (eller Read om du vet fil)
```

---

### Exempel-Scenarios

**Scenario 1: Ny Feature "Payment Integration"**
```
1. tech-architect → Analysera arkitektur och tredjepartsberoenden
2. data-architect → Designa schema för transactions och invoices
3. test-lead → Planera test-suite (TDD!)
4. [Implementera feature med TDD]
5. security-reviewer → Granska PCI-compliance och säkerhet
6. quality-gate → Verifiera DoD innan merge
```

**Scenario 2: "Dashboard är långsam"**
```
1. performance-guardian → Identifiera bottleneck
2. data-architect → Analysera queries och föreslå indexes
3. tech-architect → Designa caching-strategi om behövs
4. test-lead → Lägg till performance-regression tests
```

**Scenario 3: "Klar att deploya v1.4.0?"**
```
1. quality-gate → Pre-release checklist
2. security-reviewer → Final security audit
3. performance-guardian → Verifiera monitoring är redo
4. test-lead → Konfirmera alla tester passerar
```

## 🚀 Performance & Skalbarhet (Learning: 2025-11-16)

### Mindset: Bygg för Skalning från Dag 1

**Anti-pattern:**
> "2 providers = 97ms, det är snabbt! Vi fixar skalning sen."

**Rätt approach:**
> "2 providers = 97ms NU. Men 1,000 providers = 1-3s utan indexes. Lägg till indexes NU (20 min arbete)."

**Learning från F-3.4:**
- ✅ Database indexes är **framtidssäkring** (20 min → 10-30x snabbare)
- ✅ Prisma `select` vs `include` är **både** performance + säkerhet
- ✅ Mät baseline → Förväntat vid skalning → Verifiera efter fix

### Performance Checklist vid Ny Feature

När du skapar en ny feature (t.ex. `/api/providers`):

1. **Database Access Pattern**
   - [ ] Använder `select` (inte `include`)
   - [ ] Har indexes på alla `where`/`orderBy` fält
   - [ ] Foreign key relations har composite indexes

2. **Payload Size**
   - [ ] Returnerar endast data som UI:t behöver
   - [ ] Exponerar INTE känslig data (email, phone, passwords)
   - [ ] Överväg pagination vid >100 items

3. **Metrics**
   - [ ] Mät response time (baseline)
   - [ ] Dokumentera förväntat vid 100/1,000/10,000 rows
   - [ ] Använd Network tab för payload size

4. **Dokumentation**
   - [ ] Anteckna "Framtida förbättringar" (pagination, caching)
   - [ ] Uppdatera NFR.md med ny learning

### Metrics Template

```markdown
## Performance Metrics

**Baseline (X items):**
- Response time: Yms
- Payload size: Z KB

**Förväntad vid skalning:**
| Antal Items | Utan Optimering | Med Optimering | Förbättring |
|-------------|----------------|----------------|-------------|
| 100         | ~Xms           | ~Yms           | Zx          |
| 1,000       | ~Xms           | ~Yms           | Zx          |
| 10,000      | ~Xms ❌        | ~Yms           | Zx          |
```

## 🔄 Key Learnings

### Next.js 16 + React 19 + NextAuth v5 Upgrade (2026-01-22)
**Decision:** Uppgraderade från Next.js 15 + React 18 + NextAuth v4.
- **Why:** Säkerhetsvarningar (CVE-2025-55184, CVE-2025-55183), framtidssäkring
- **Versions:** next 15.5→16.1, react 18.3→19.2, next-auth 4.24→5.0-beta.30
- **Impact:** 13 filer ändrade, ~150 rader logik, 410/410 tester passerar
- **Key Changes:**
  - `params` är nu `Promise` i dynamic routes (måste awaitas)
  - NextAuth: `auth()` ersätter `getServerSession(authOptions)`
  - Middleware: `auth((req) => ...)` ersätter `withAuth(...)`
  - Test mocks måste uppdateras från `next-auth` → `@/lib/auth`
- **Learning:** Repository pattern + behavior-based tests minimerade uppgraderings-impact
- **Retro-learnings (problem vi stötte på):**
  - `.npmrc` med `legacy-peer-deps=true` behövdes för Vercel (react-leaflet peer dep)
  - Edge Function size limit (1MB) → Separera `auth.config.ts` för middleware
  - Playwright browsers måste uppdateras efter major upgrades

**Pre-Merge Checklist för Major Upgrades:**
```bash
# 1. Simulera clean install (som Vercel/CI gör)
rm -rf node_modules package-lock.json
npm install
npm run build

# 2. Kör alla tester
npm run test:run          # Unit tests
npx playwright install    # Uppdatera browsers
npm run test:e2e          # E2E tests

# 3. Verifiera manuellt
npm run dev               # Starta och testa kritiska flöden
```

### SQLite → PostgreSQL Migration (2026-01-21)
**Decision:** Migrerade från SQLite till PostgreSQL (Supabase) för Vercel deployment.
- **Why:** SQLite fungerar inte i serverless miljöer (Vercel), behövde hosted databas
- **Implementation:** Ändrade `provider = "sqlite"` → `provider = "postgresql"` i schema.prisma
- **Connection String:** Använd Session Pooler (IPv4) för serverless kompatibilitet
- **Impact:** Projektet kan nu deployas till Vercel utan databasproblem
- **Dokumentation uppdaterad:** README.md, CONTRIBUTING.md, CLAUDE.md, `.env.example` skapad

### Geocoding Made Optional (2025-12-04)
**Decision:** Removed Google Maps API dependency for MVP by making coordinates optional.
- **Why:** Simplifies onboarding (no API key needed), reduces costs, text-search sufficient for early users
- **Implementation:** Made `latitude`/`longitude` optional in Prisma schema, Zod schemas, and TypeScript interfaces
- **Impact:** Providers can create announcements instantly without geocoding delays or errors
- **Future:** Can re-enable by setting `GOOGLE_MAPS_API_KEY` + updating frontend form
- **Critical Bug Fixed:** Added missing `address`, `latitude`, `longitude` fields to `RouteStop` model

### E2E Testing
- **Kod-först approach** → 80% färre iterationer
- **data-testid** på alla interaktiva element
- **Seriella tester** (1 worker) för MVP → 100% pass rate
- **Framework bugs** kan blockera allt - undersök upgrades först

### Development
- **TDD** fångar buggar tidigt, bättre design
- **Databas-först** → typsäkerhet hela vägen
- **Feature branches** → atomära merges
- **JSON parsing** i API routes MÅSTE ha try-catch

### Performance & Skalbarhet (2025-11-16)
- **Proaktiv analys** lönar sig → Tech-architect avslöjade 3 kritiska problem
- **Säkerhet + Performance** går hand-i-hand → `select` vs `include`
- **Database indexes** är framtidssäkring → 20 min → 10-30x snabbare
- **Mät metrics** → Baseline + Förväntad skalning + Efter fix
- **Dokumentera learnings** medan du arbetar → NFR.md som living document
- **"Framtida förbättringar"** ska dokumenteras tydligt med trigger & estimat

### Meta-Learnings
- **Använd agenter strategiskt** → tech-architect för stora beslut, Explore för kod-sök
- **Reflektera efter varje uppgift** → "Vad tog för lång tid? Hur kan vi jobba bättre?"
- **Skriv ner patterns** → Återanvändbar kunskap är guld
- **Kör alltid retro med agenterna** → Efter varje sprint är committed och klar

## 🔄 Sprint Planning & Retrospectives

### Sprint Workflow
1. **Planera sprint** med tech-architect baserat på föregående retro
2. **Implementera features** med TDD och feature branches
3. **Commit och merge** till main efter alla tester gröna
4. **Kör retrospective** med relevanta agenter (tech-architect, test-lead, quality-gate)
5. **Uppdatera CLAUDE.md** med learnings och nästa sprint-plan

### Retrospective Template
**Agenter att inkludera:**
- tech-architect (arkitektur, patterns, tekniska beslut)
- test-lead (TDD workflow, test quality, coverage)
- quality-gate (DoD compliance, process)
- security-reviewer (vid säkerhetskritiska features)
- data-architect (vid schema-ändringar)

**Frågor att ställa:**
1. Vad gick bra?
2. Vad kunde vi göra bättre?
3. Konkreta rekommendationer för nästa sprint?

---

## 📋 Sprint 1: Quality Foundation & Repository Pattern

**Theme:** Stabilisera testsvit + Repository Pattern foundation
**Duration:** 2 veckor
**Complexity:** 2L + 3M + regression fixes

### 🚨 PRE-SPRINT (Regression Fix)

**R-1: Fix API Test Suite (Size: M)**
- Fix 6 failande tester (providers/bookings) - `select` vs `include` mismatch
- Pre-merge gate kör FULL suite (`npm run test:run && npm run test:e2e && npx tsc --noEmit`)
- GitHub protected branch med required checks
- Dokumentera "Test Update Pattern" när schema ändras
- **Timeline:** 2-3 dagar, BLOCKERAR Sprint 1 start

### 🎯 Sprint 1 Features

**F1-1: ProviderRepository Implementation (Size: L)**
- Implementera komplett repository pattern för Provider aggregate
- Refactor `/api/providers/*` att använda repository (ej direkt Prisma)
- Aggregate Root validation (business rules i Provider model)
- TDD: Unit tests FÖRST (100% coverage)
- E2E-tester passerar oförändrade (API-kontrakt bibehålls)

**F1-2: Behavior-Based API Testing (Size: M)**
- Migrera API-tester från implementation-based → behavior-based
- Tester bryter EJ vid interna refactorings (som select/include ändringar)
- Security assertions bibehålls (känslig data exponeras EJ)
- Dokumentera pattern i CLAUDE.md

**F1-3: E2E Tests in CI Gate (Size: M)**
- `.github/workflows/quality-gates.yml` kör `npm run test:e2e`
- E2E-tester körs EFTER unit tests (fail fast strategy)
- Protected branch kräver E2E-pass för merge
- E2E timeout: 5 min max

**F1-4: ServiceRepository Foundation (Size: M)**
- ServiceRepository med samma interface-pattern som ProviderRepository
- Refactor `/api/services/*` att använda repository
- Unit tests 100%, E2E bibehålls
- Aggregate Root validation för Service

### 📦 Long-Term Backlog (Sprint 2+)

**BookingRepository + Aggregate Root Enforcement (Sprint 2)**
- Booking är mest komplex aggregate (4 relations)
- Behöver learnings från Provider + Service repositories först

**Domain Events for Booking Lifecycle (Sprint 3-4)**
- Kräver stabil repository foundation + event infrastructure
- Trigger: När vi ser behov av async workflows

**Mutation Testing (Sprint 5+)**
- Nice-to-have för quality assurance
- Trigger: När coverage når 90%+

### ✅ Sprint 1 Success Criteria

- [x] Alla API-tester gröna (100% pass rate) → **DONE** (343 tests passing)
- [~] Pre-merge gate kör full suite (unit + E2E + TypeScript + build) → **PARTIAL** (manual checklist, needs automation)
- [x] Provider + Service använder repository pattern → **DONE**
- [~] E2E-tester i CI (protected branch) → **PARTIAL** (local setup done, CI pending)
- [x] Zero flaky tests → **DONE** (in unit tests, E2E TBD)

**Sprint 1 Result:** 4.5/5 features completed (90%)

---

## 🎓 Sprint 0 Retrospective Learnings (2025-11-19)

### 💚 Vad Gick Bra
- **Solid DDD foundation** - 150 tests, 100% coverage, rätt patterns (Entity, ValueObject, Result, Guard)
- **TDD fungerade** - Design blev bättre, tests först är rätt väg
- **Feature branch workflow** - Atomära commits, clean git history
- **Repository abstraction** - Separerar domain från Prisma korrekt

### 🔴 Vad Kunde Varit Bättre
- **6 test regressions** - Pre-merge gate för svag (körde bara nya filer, inte full suite)
- **API-test antipattern** - Testade implementation (Prisma syntax) istället för beteende (API contract)
- **Repository pattern ofullständig** - Bara BookingRepository, inte Provider/Service
- **E2E tests skippades** - Hade fångat regressionerna

### 📋 Konkreta Förbättringar Implementerade

**Test Strategy:**
```typescript
// ❌ DÅLIGT (implementation-based)
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({ include: {...} })
)

// ✅ BÄTTRE (behavior-based)
expect(response.status).toBe(200)
expect(data).toMatchObject({ id: expect.any(String), businessName: expect.any(String) })
expect(data.passwordHash).toBeUndefined() // Security assertion
```

## 🔒 Automated Quality Gates

**Lokal Gate (Husky pre-push hook):**
- ✅ Unit tests (`npm run test:run`)
- ✅ TypeScript check (`npx tsc --noEmit`)

**CI Gate (GitHub Actions - `.github/workflows/quality-gates.yml`):**
- ✅ Unit tests + coverage
- ✅ E2E tests
- ✅ TypeScript check
- ✅ Build verification
- ✅ Lint (non-blocking)

**Branch Protection:**
⚠️ **INAKTIVERAT FÖR MVP** - GitHub branch protection är avstängt för snabbare iteration.
- Återaktivera när: projektet når v1.0 eller går i produktion
- Kräver då: alla CI checks gröna innan merge till main

**Om du behöver skippa lokala checks (EJ rekommenderat):**
```bash
git push --no-verify
```

**Alternativt, kör checks manuellt:**
```bash
npm run pre-push  # Kör samma checks som Husky
```

---

**Test Update Pattern (vid schema-ändringar):**
1. Uppdatera Prisma schema
2. Uppdatera motsvarande repositories
3. Uppdatera API-tester SAMMA commit
4. Kör full test suite innan commit

---

## 🎓 Sprint 1 Retrospective Learnings (2025-11-21)

### 💚 Vad Gick Bra
- **Repository Pattern är Solid** - Provider + Service repositories fungerar perfekt, redo för Booking
- **Behavior-Based Testing = Game Changer** - Tester överlevde `include` → `select` refactoring utan ändringar! Minskade test maintenance med ~70%
- **TDD Workflow Etablerad** - 100% coverage, tests först sparade faktiskt tid genom att klargöra requirements
- **Git Workflow Atomär** - Clean feature branches, lätt att revertera specifika features

### 🔴 Vad Gick Mindre Bra
1. **Environment Setup Helt Odokumenterat (KRITISKT)**
   - Problem: E2E tests failade pga saknad `.env`, Playwright setup scripts laddade inte env vars
   - Impact: Skulle ha blockat produktion deployment + ny developer onboarding
   - Fix: Skapade `.env.example`, lade till `import 'dotenv/config'` i setup scripts, dokumenterade required vars
   - Learning: **"90% done" is not done** - Verifiera alltid i target environment

2. **E2E CI Integration Ofullständig (F1-3)**
   - Problem: Local E2E setup fungerar, men GitHub Actions saknar `DATABASE_URL` i alla jobs
   - Impact: CI kan inte enforcea "E2E must pass" gate än
   - Status: 90% klar, behöver 2-3h för att slutföra

3. **Pre-merge Gate Ej Automatiserad**
   - Problem: Manuell checklist i CLAUDE.md = human error risk
   - Impact: Risk att merge:a failing code om developer skippar checklist
   - Solution: GitHub branch protection + automated workflow

4. **Seed Data Management Ad-Hoc**
   - Problem: E2E tests antar specifik data finns, seed är manuellt, ingen garanti för deterministic data
   - Impact: Fungerar för MVP, kommer bryta vid större E2E suite
   - Risk: Flaky tests pga race conditions eller saknad data

### 📊 Metrics
- **Unit tests:** 343 passing (100%)
- **E2E tests:** Local setup fungerar med seeded data (status pending)
- **Repository Pattern:** Provider ✅ + Service ✅ (Booking nästa)
- **API Test Migration:** 100% behavior-based
- **Sprint Completion:** 4.5/5 features (90%)

### 🎯 Key Learnings

**1. Behavior-Based Testing Pattern (MANDATORY)**
```typescript
// ❌ BAD: Tests implementation (broke during refactoring)
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({include: {services: true, user: true}})
)

// ✅ GOOD: Tests API contract (survived refactoring, caught security issue)
expect(response.status).toBe(200)
expect(data[0]).toMatchObject({
  id: expect.any(String),
  businessName: expect.any(String),
})
expect(data[0].user.passwordHash).toBeUndefined() // Security assertion!
```

**2. Environment Setup är Kritiskt**
- Alltid ha `.env.example` med alla required vars
- Setup scripts MÅSTE ladda `dotenv/config` före Prisma
- Dokumentera setup i README "Getting Started"
- Seed data ska vara del av test workflow

**3. Repository Pattern Overhead Motiverat**
- Konsistens viktigare än minimal overhead
- Service KOMMER bli komplex (pricing rules, availability, packages)
- Gör testing lättare (mock repository vs Prisma)

### 🔄 Process Improvements
- **DoD Update:** Lägg till "Environment variables documented in `.env.example`"
- **Mid-Sprint Check-in:** 15-min sync för sprints >1 vecka för att fånga blockers tidigt
- **Proaktiv Agent Usage:** Använd security-reviewer för booking (payment-related), data-architect för komplex schema

---

## 📋 Sprint 2: Complete Quality Foundation + Booking Repository

**Theme:** Fix flakiness → CI automation → BookingRepository
**Duration:** 2 veckor (7 arbetsdagar)
**Complexity:** 2 Blockers (XS+M) + 2 CI (S+S) + 1 Feature (L)

**🎯 Sprint Goal:** 100% E2E pass rate + Automated quality gates + BookingRepository

---

### 📊 Implementation Order (Tech-Architect Recommended)

**⚠️ KRITISK INSIKT från Sprint Planning:**
Original prioritering var FEL - måste fixa test isolation INNAN CI activation.

**Phase 1: CRITICAL BLOCKERS** (Dag 1-2)
→ F2-2 (Docs) → F2-5 (Test Isolation) 🔴 **BLOCKER**

**Phase 2: CI FOUNDATION** (Dag 2-3)
→ F2-1 (E2E in CI) → F2-4 (Pre-merge Gate)

**Phase 3: FEATURE DEVELOPMENT** (Dag 4-7)
→ F2-3 (BookingRepository) med full agent support

---

### Phase 1: CRITICAL BLOCKERS (Dag 1-2)

**F2-2: Document Environment Setup (Size: XS) - 1h**
🔴 **PRIORITET: CRITICAL** (Dag 1)
- **Varför först?** Onboarding är blockerad utan detta
- Uppdatera `.env.example` med kommentarer för varje var
- Skapa `CONTRIBUTING.md` med setup-instruktioner
- Uppdatera README.md: "Getting Started" sektion
- Dokumentera: "Dagliga Kommandon" i CLAUDE.md
- **Agent:** Ingen - straight implementation
- **Output:** Ny utvecklare kan sätta upp projektet på <10 min

**F2-5: Test Data Management Strategy (Size: M) - 2-3h**
🔴 **PRIORITET: CRITICAL BLOCKER** (Dag 1-2)
- **Varför BLOCKER?** Flaky tests blockerar CI-trust (91.5% → måste bli 100%)
- **Root Cause:** State/timing issues - databas eller UI state läcker mellan tester
- **Must Fix:** booking.spec.ts:16 + route-planning.spec.ts:48
- **Implementation Steps:**
  1. Reproducera flakiness lokalt (kör 20x i loop)
  2. Implementera test isolation pattern: `test-utils/db-helpers.ts`
  3. Uppdatera cleanup/setup scripts med bättre isolation
  4. Fix båda flaky testerna
  5. Verifiera stabilitet: kör full E2E suite 10x (måste vara 10/10 ✅)
- **Agent:** 🧪 **test-lead** (efter fix) - verifiera isolation pattern är rätt
- **Success:** 47/47 E2E tests (100% pass rate) i 10 körningar
- **Blocker för:** F2-1 (kan EJ aktivera E2E i CI med flaky tests)

---

### Phase 2: CI FOUNDATION (Dag 2-3)

**F2-1: Complete F1-3 - E2E in CI (Size: S) - 2-3h**
🟡 **PRIORITET: HIGH** (Dag 2-3)
- **Prerequisites:** ✅ F2-5 (måste vara klar först - 100% pass rate required)
- Add E2E job till `.github/workflows/quality-gates.yml`
- Setup environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`
- Add seed step: `npx tsx prisma/seed-test-users.ts`
- Configure SQLite in-memory för CI (snabbare än fil-baserad)
- Add branch protection rule: E2E checks must pass
- Increase timeouts i CI (2x lokala värden)
- **Agent:** Ingen - straight implementation
- **Blocker för:** F2-4 (pre-merge gate behöver CI först)

**F2-4: Automate Pre-merge Gate (Size: S) - 1-2h**
🟡 **PRIORITET: HIGH** (Dag 3)
- **Prerequisites:** ✅ F2-1 (E2E i CI måste fungera först)
- **Varför viktigt?** Sprint 1 hade 6 regressions p.g.a. manuell gate
- Setup Husky pre-push hook: `.husky/pre-push`
- Run locally: `npm run test:run && npx tsc --noEmit`
- CI runs: E2E + build (via F2-1)
- Enable GitHub branch protection: require status checks
- Ta bort manuell checklist från CLAUDE.md
- **Agent:** ✅ **quality-gate** (efter implementation) - verifiera gate är komplett
- **Output:** Developer kan EJ pusha broken code

---

### Phase 3: FEATURE DEVELOPMENT (Dag 4-7)

**F2-3: BookingRepository Implementation (Size: L) - 3-4 dagar**
🟢 **PRIORITET: MEDIUM** (Dag 4-7)
- **Varför sist?** Mest komplex aggregate (4 relations), behöver stabil foundation
- **Prerequisites:** ✅ F2-5 (test isolation), ✅ F2-4 (pre-merge gate)
- **Complexity:** Booking aggregate har 4 relations (User, Service, Provider via Service, RouteOrder)
- Implementera repository pattern för Booking
- Refactor `/api/bookings/*` att använda repository (ej direkt Prisma)
- Aggregate Root validation för Booking business rules
- TDD: Unit tests FÖRST (100% coverage target)
- E2E-tester passerar oförändrade (API-kontrakt bibehålls)

**Agent Support Schedule (FULL TEAM):**
- **Dag 4 START:** 🗄️ **data-architect** - Granska aggregate design INNAN implementation
- **Dag 5:** 🧪 **test-lead** - TDD test suite design (100% coverage)
- **Dag 6-7:** 🏗️ **tech-architect** - Review när 80% klar (arkitektur check)
- **Dag 7 SLUT:** ✅ **quality-gate** - DoD verification före merge

**TDD Workflow:**
```
Dag 4: data-architect kickoff → Design aggregate boundaries
Dag 5: Write unit tests FIRST → test-lead review
Dag 6: Implement repository → Fix tests (Green phase)
Dag 7: Refactor /api/bookings/* → tech-architect + quality-gate
```

---

### 🚫 SKIPPADE FEATURES (Flyttas till Sprint 3)

**F2-6: Setup Automation Script**
- **Varför skippat?** Nice-to-have, fokusera på core features
- **Manual setup fungerar** - dokumentation (F2-2) är tillräckligt
- **Sprint 3:** Implementera `scripts/setup.sh` när tid finns

### 🐛 Known Issues (Från Sprint 1)

**E2E Test Flakiness: booking.spec.ts:16**
- **Symptom:** Test "should search and filter providers" passes isolated but fails i full suite
- **Failure:** Timeout waiting for "rensa alla filter" button (30s timeout)
- **Root Cause:** State/timing issues från tidigare tester i suite - databas eller UI state läcker mellan tester
- **Workaround:** Kör testet isolated: `npx playwright test e2e/booking.spec.ts:16`
- **Permanent Fix:** Implementera F2-5 (Test Data Management Strategy)
  - Database transactions för test isolation
  - ELLER test fixtures med deterministic data
  - ELLER beforeEach cleanup av relevant state
- **Impact:** 91.5% E2E pass rate i full suite (43/47 passing)
- **Priority:** Medium - blockar EJ utveckling men skapar falska negativ i CI

**Note:** Auth.spec.ts:134 flakiness är LÖST i Sprint 1 R-1 ✅

---

### ✅ Sprint 2 Success Criteria (100% Required)

**Must-Have (Blockar Sprint 2 Completion):**
- [ ] **47/47 E2E tests passing (100% pass rate)** ← Måste fixas i F2-5
  - booking.spec.ts:16 fixed ✅
  - route-planning.spec.ts:48 fixed ✅
  - Verifierat: 10 körningar = 10/10 success
- [ ] E2E tests kör i CI (`.github/workflows/quality-gates.yml`)
- [ ] GitHub branch protection: E2E checks required
- [ ] Automated pre-merge gate (Husky pre-push hook)
- [ ] Zero manual pre-merge checklist items
- [ ] Environment setup dokumenterad (README + CONTRIBUTING.md + `.env.example`)
- [ ] BookingRepository implementerat med 100% unit test coverage
- [ ] `/api/bookings/*` använder repository (ej direkt Prisma)

**Nice-to-Have:**
- [ ] Test isolation pattern dokumenterad i CLAUDE.md
- [ ] CI timeout optimization (SQLite in-memory)

**Timeline:** 7 arbetsdagar (inom 2 veckor)
**Agent Involvements:** 4 (test-lead, quality-gate, data-architect, tech-architect)

---

**Skapad av**: Claude Code
**För projektöversikt**: Se README.md
**För kvalitetsmål**: Se NFR.md