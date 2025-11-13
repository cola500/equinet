# CLAUDE.md - Utvecklingsguide för AI-assistenter

Detta dokument beskriver **hur** vi arbetar i Equinet-projektet. För information om **vad** som är byggt och planeras, se README.md.

## 📌 Projektkontext

**Projektnamn**: Equinet
**Typ**: Bokningsplattform för hästtjänster (MVP)
**Huvudspråk**: Svenska (dokumentation & UI), Engelska (kod & kommentarer)
**Senast uppdaterad**: 2025-11-12

## 🛠️ Teknisk Stack & Arkitektur

### Huvudsakliga Teknologier

```
Next.js 16 (App Router)
├── TypeScript (strict mode)
├── Tailwind CSS v4
├── Prisma ORM
│   └── SQLite (dev) → PostgreSQL (prod)
├── NextAuth.js v4
│   └── Credentials Provider
├── shadcn/ui + Radix UI
├── React Hook Form + Zod
├── date-fns (sv locale)
└── Sonner (toasts)
```

### Viktiga Arkitektur-Beslut

1. **App Router Pattern**
   - Använder Next.js 15/16 App Router (INTE pages router)
   - Server Components by default, "use client" när nödvändigt
   - Dynamic routes har `params` som Promise - måste awaitas

2. **Databas-först Approach**
   - Prisma schema är "source of truth"
   - Generera types från Prisma
   - Använd Prisma Client singleton (`src/lib/prisma.ts`)

3. **Validering på Båda Sidor**
   - Client: React Hook Form + Zod (bättre UX, snabb feedback)
   - Server: Zod (säkerhet, kan inte hoppas över)
   - Dela gärna schema mellan client/server

4. **Autentisering & Auktorisering**
   - NextAuth v4 med JWT sessions
   - Custom callbacks i `src/lib/auth.ts` lägger till userType & providerId
   - useAuth hook för client-side (`src/hooks/useAuth.ts`)
   - Alla API routes kontrollerar session & userType

## 🎯 Utvecklingsworkflow

### Dagliga Kommandon

```bash
# Utveckling
npm run dev              # Starta dev server (localhost:3000)
npm run db:studio        # Prisma Studio (localhost:5555)

# Databas
npx prisma generate      # Efter schema-ändringar
npx prisma db push       # Pusha schema till databas
npm run db:reset         # ⚠️ Återställ (raderar all data!)

# Felsökning
rm -rf .next && npm run dev    # Rensa cache
npx tsc --noEmit                # TypeScript check
```

### När du lägger till nya features

#### 1. Planering
- Fundera på databasschema först
- Skissa API endpoints
- Tänk på både kund- och leverantörsperspektiv
- Använd TodoWrite för att tracka steg

#### 2. Implementering (Databas-först)
```bash
# a) Uppdatera schema
vim prisma/schema.prisma

# b) Generera & pusha
npx prisma generate && npx prisma db push

# c) Skapa API routes med Zod validation

# d) Bygg UI med shadcn komponenter
```

#### 3. Testning (TDD - Red, Green, Refactor)
```bash
# Skriv tester FÖRST
touch src/app/api/new-feature/route.test.ts

# Kör tester i watch mode
npm test

# Implementera minsta kod för grönt test

# Refaktorera när testerna är gröna
```

## 🧪 Test-Driven Development

### TDD är Obligatoriskt

**Skriv ALLTID tester innan implementation för:**
- ✅ API routes (högst prioritet!)
- ✅ Utility functions
- ✅ Custom hooks
- ✅ Komplex business logic

### TDD-cykeln

```
🔴 RED   → Skriv test som failar (beskriv önskat beteende)
🟢 GREEN → Minsta kod för att få testet grönt
🔵 REFACTOR → Förbättra koden, testen ska vara gröna
♻️  UPPREPA → Nästa feature/beteende
```

### Test-naming Convention

```typescript
describe('POST /api/bookings', () => {
  it('should create booking when valid data is provided', async () => {
    // Arrange - Setup
    // Act - Execute
    // Assert - Verify
  })

  it('should return 400 when date is in the past', async () => {})
  it('should return 401 when user is not authenticated', async () => {})
})
```

### Vad ska INTE testas?

- ❌ Enkla presentationskomponenter
- ❌ Tredjepartsbibliotek
- ❌ shadcn/ui komponenter
- ❌ CSS/styling

### Testverktyg

```bash
npm test              # Watch mode (bäst under utveckling)
npm run test:ui       # Vitest UI (rekommenderas!)
npm run test:run      # Single run (CI/CD)
npm run test:coverage # Coverage report
```

**Coverage-mål:**
- API Routes: ≥80%
- Utilities: ≥90%
- Hooks: ≥80%
- Overall: ≥70%

## 🎓 E2E-Testning: Lärdomar & Best Practices

> **💡 VIKTIGT: Stanna upp och lär från varje uppgift!**
> Efter varje större implementation eller bugfix - reflektera över:
> - Vad fungerade bra?
> - Vad tog onödigt många iterationer?
> - Vilka patterns kan vi återanvända?
> - Hur kan vi jobba smartare nästa gång?

### 🔍 Kod-Först Approach (The Golden Rule)

**Problem:** När vi skrev E2E-tester genom att gissa fältnamn, knappar och labels tog det 5-10 iterationer per test.

**Lösning:** Alltid kolla koden INNAN du skriver tester!

```bash
# 1. Utforska koden först
Task agent (Explore, medium) -> "Dokumentera alla labels, knappar och data-testid i [component]"

# 2. Kolla screenshots från misslyckade tester
Read test-results/*/test-failed-1.png
Read test-results/*/error-context.md

# 3. Använd Playwright Codegen för komplexa interaktioner
npx playwright codegen http://localhost:3000

# 4. SKA TESTEN
# Nu vet vi exakt vad som finns i UI:t
```

**Resultat:** Från 5-10 iterationer → 1-2 iterationer per test ✅

### 📋 Test Data Management

**Problem:** Parallella tester delade samma databas och kolliderade med varandra.

**Lösningar:**

1. **Unika Identifiers**
```typescript
// ✅ Använd timestamps för unika emails
await page.fill('email', `test${Date.now()}@example.com`)

// ✅ Använd millisekunder för unika bokningstider
const uniqueMinute = new Date().getMilliseconds() % 60
const time = `09:${uniqueMinute.toString().padStart(2, '0')}`
```

2. **Framtida Datum för Bokningar**
```typescript
// ✅ Boka långt i framtiden för att undvika konflikter
const futureDate = new Date()
futureDate.setDate(futureDate.getDate() + 14) // 2 veckor
```

3. **Seriell Körning (MVP Workaround)**
```typescript
// playwright.config.ts
workers: 1  // Kör tester seriellt för delad databas
```

**Framtida förbättringar:**
- Isolera testdata per worker (olika users/providers)
- Database transactions med rollback
- Separata test-databaser per worker

### 🎯 Selector Best Practices

**Problem:** Selectors bröts när DOM-struktur ändrades.

**Prioriterad ordning (bäst → sämst):**

1. **data-testid** (bäst, aldrig ändras)
```typescript
✅ page.locator('[data-testid="booking-item"]')
```

2. **Semantic Roles** (bra, tillgängligt)
```typescript
✅ page.getByRole('button', { name: /skapa konto/i })
✅ page.getByRole('heading', { name: /min profil/i })
✅ page.getByLabel(/email/i)
```

3. **nth() för Multiple Matches**
```typescript
✅ page.getByRole('button', { name: /redigera/i }).nth(1)
// När det finns flera "Redigera"-knappar
```

4. **UNDVIK: CSS classes och komplex DOM traversal**
```typescript
❌ page.locator('.button.primary')  // Kan ändras
❌ page.locator('div > div > button')  // Sköra
```

### ⏱️ Timing & Waits

**Problem:** Tester failade pga timing-issues.

**Lösningar:**

1. **Vänta på Specifika Conditions**
```typescript
// ✅ Vänta på element
await page.waitForSelector('[data-testid="item"]', { timeout: 10000 })

// ✅ Vänta på URL-ändring
await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

// ✅ Vänta på synlig element
await expect(page.getByText(/success/i)).toBeVisible({ timeout: 5000 })

// ❌ UNDVIK arbiträra timeouts
await page.waitForTimeout(1500)  // Endast när inget annat fungerar
```

2. **Vänta på State Changes**
```typescript
// ✅ Vänta på att NY status visas efter toggle
const expectedStatus = currentStatus === 'Aktiv' ? 'Inaktiv' : 'Aktiv'
await expect(
  page.locator('[data-testid="status"]')
    .filter({ hasText: new RegExp(`^${expectedStatus}$`, 'i') })
).toBeVisible({ timeout: 5000 })
```

3. **Vänta på Validation**
```typescript
// ✅ Vänta på att form validation slutförts
await page.fill('password', 'Test123!')
await page.waitForSelector('text=/lösenordet uppfyller alla krav/i')
// NU är det säkert att submitta
await page.click('button[type="submit"]')
```

### 🔄 Handling Dynamic Content

**Problem:** Element försvann/ändrades efter API-anrop och page refresh.

**Lösning: Re-query efter changes**
```typescript
// ❌ Gammal referens blir stale efter refresh
const badge = page.locator('[data-testid="status"]')
await badge.click()  // Trigger refresh
const newText = await badge.textContent()  // ❌ Kan vara stale!

// ✅ Query igen efter refresh
await badge.click()
await page.waitForTimeout(1000)  // Vänta på refresh
const newBadge = page.locator('[data-testid="status"]')  // Ny query
const newText = await newBadge.textContent()  // ✅ Aktuell data
```

### 🏗️ Test Structure Patterns

**1. Empty State Tests**
```typescript
test('should handle empty state', async ({ page }) => {
  await page.goto('/page')
  await page.waitForTimeout(1000)  // Låt sidan ladda

  const itemCount = await page.locator('[data-testid="item"]').count()

  if (itemCount === 0) {
    // Verifiera empty state
    await expect(page.getByText(/inga items/i)).toBeVisible()
  } else {
    // Verifiera items visas
    await expect(page.locator('[data-testid="item"]').first()).toBeVisible()
  }
})
```

**2. Dialog Handling**
```typescript
test('should handle confirmation dialog', async ({ page }) => {
  // Setup listener INNAN action som triggar dialog
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('säker')
    dialog.accept()
  })

  // NU klicka på knappen som öppnar dialogen
  await page.click('button[name="delete"]')
})
```

**3. Conditional Tests (när testdata varierar)**
```typescript
test('should accept booking if available', async ({ page }) => {
  await page.goto('/bookings')

  const hasPending = await page.locator('[data-testid="pending"]')
    .isVisible().catch(() => false)

  if (!hasPending) {
    console.log('No pending bookings, skipping test')
    return  // Skippa gracefully
  }

  // Fortsätt med test...
})
```

### 📊 Iterativa Förbättringar

**Lessons Learned från Equinet E2E-implementation:**

**Iteration 1: Parallella tester (4 workers)**
- ⚡ Snabbt: ~17s
- ❌ Problem: 2 tester failade (race conditions)
- 📈 Pass rate: 91% (20/22)

**Iteration 2: Seriella tester (1 worker)**
- 🐌 Långsammare: ~40s
- ✅ Stabilt: Alla tester passerar
- 📈 Pass rate: 100% (22/22)

**Lärdom:** För MVP, prioritera **stabilitet > hastighet**

**Framtida optimeringar:**
```typescript
// TODO: Worker-isolerad testdata
const testUser = {
  email: `worker${workerId}_test@example.com`,
  providerId: `provider_${workerId}`
}

// TODO: Database transactions
beforeEach(async () => {
  await db.transaction.begin()
})
afterEach(async () => {
  await db.transaction.rollback()
})
```

### 🧠 Meta-Lärdom: Reflektera Aktivt

**Efter varje uppgift, fråga dig själv:**

1. **Vad tog för lång tid?**
   - Exempel: "Gissade fältnamn istället för att kolla koden först"
   - Åtgärd: Lägg till "Kod-först approach" som standard

2. **Vilka problem upprepades?**
   - Exempel: "Timing issues i 5 olika tester"
   - Åtgärd: Skapa pattern för "Vänta på state change"

3. **Vad kan bli ett pattern?**
   - Exempel: "Empty state handling fungerade bra"
   - Åtgärd: Dokumentera som återanvändbart pattern

4. **Hur minskar vi iterationer nästa gång?**
   - Exempel: "Screenshots + Codegen sparade 3-4 iterationer"
   - Åtgärd: Lägg till i standard workflow

**Gör detta till en vana! Det är skillnaden mellan att upprepa misstag och att kontinuerligt förbättras.** 🚀

---

## 🔑 Kritiska Filer & Patterns

### Konfiguration

1. **`.env.local`** (GIT-IGNORED!)
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="[openssl rand -base64 32]"
NEXTAUTH_URL="http://localhost:3000"
```

2. **`prisma/schema.prisma`**
   - Databasschema (source of truth)
   - Kör `npx prisma generate` efter ändringar

3. **`src/lib/auth.ts`**
   - NextAuth konfiguration
   - Callbacks lägger till userType & providerId i session

### Filstruktur Convention

```
src/app/api/[feature]/
├── route.ts              # GET, POST för lista/skapa
├── route.test.ts         # Tester för route.ts
├── [id]/
│   ├── route.ts          # GET, PUT, DELETE för specifik
│   └── route.test.ts     # Tester
```

### API Route Pattern

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

// Zod schema
const schema = z.object({
  field: z.string()
})

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session) return new Response("Unauthorized", { status: 401 })

    // 2. Parse & validate
    const body = await request.json()
    const validated = schema.parse(body)

    // 3. Authorization check (äger användaren resursen?)
    // ...

    // 4. Databas-operation
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

## 🐛 Vanliga Gotchas & Fixes

### 1. Next.js 16 Dynamic Params
**Problem:** `params` är en Promise nu (ändrades i Next.js 15/16)

```typescript
// ❌ Gammal syntax (funkar inte)
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params  // Error!
}

// ✅ Ny syntax
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // Måste awaita!
}
```

### 2. Prisma Client Regeneration
**Problem:** TypeScript errors efter schema-ändringar

```bash
# Fix:
npx prisma generate
# Starta om TS server i VS Code:
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### 3. Zod Error Handling
**Problem:** `error.errors` finns inte (ändrades i senare versioner)

```typescript
// ❌ Fel
catch (error) {
  if (error instanceof z.ZodError) {
    return { error: error.errors }  // errors finns inte
  }
}

// ✅ Rätt
catch (error) {
  if (error instanceof z.ZodError) {
    return { error: error.issues }  // använd issues
  }
}
```

### 4. Enum med Custom Error Messages
```typescript
// ❌ Fel syntax
userType: z.enum(["customer", "provider"], {
  errorMap: () => ({ message: "Fel typ" })
})

// ✅ Rätt syntax
userType: z.enum(["customer", "provider"], {
  message: "Fel typ"
})
```

### 5. Turbopack Cache Issues
**Problem:** Svart skärm, 500 errors, .next/dev kan inte skapas

```bash
# Fix:
pkill -f "next dev"
rm -rf .next node_modules/.cache
npm run dev
```

### 6. NextAuth Session Updates
**Problem:** Session uppdateras inte automatiskt efter profile changes

```typescript
// Använd update() från useSession
const { data: session, update } = useSession()

// Efter profile update:
await update()
```

## 🎨 UI/UX Patterns

### Design System

**Färger:**
- Primary: `green-600` (#16a34a)
- Background: `gray-50` (#f9fafb)
- Text: `gray-900` / `gray-600`

**Komponenter:**
- Använd shadcn/ui (`npx shadcn@latest add [component]`)
- Alla UI komponenter i `src/components/ui/`

### Standard Layout Pattern

```tsx
<div className="min-h-screen bg-gray-50">
  {/* Header */}
  <header className="bg-white border-b">
    <div className="container mx-auto px-4 py-4">
      {/* Logo & Navigation */}
    </div>
  </header>

  {/* Main Content */}
  <main className="container mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold mb-8">Page Title</h1>
    <div className="max-w-2xl">
      {/* Content */}
    </div>
  </main>
</div>
```

### Form Pattern (React Hook Form + Zod)

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "Namn krävs")
})

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "" }
  })

  const onSubmit = async (data: z.infer<typeof schema>) => {
    // Submit logic
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

## 🔒 Säkerhet

### Implementerat
- ✅ bcrypt password hashing (10 rounds)
- ✅ HTTP-only cookies (NextAuth)
- ✅ CSRF protection (NextAuth)
- ✅ SQL injection protection (Prisma)
- ✅ XSS protection (React escaping)
- ✅ Input validation (Zod client & server)
- ✅ Authorization checks (session + ownership)

### Checklist för Nya API Routes
- [ ] Kontrollera session (authenticated?)
- [ ] Validera input (Zod schema)
- [ ] Kontrollera ägarskap (användarens resource?)
- [ ] Zod error handling (catch ZodError)
- [ ] Database error handling
- [ ] Logga errors (console.error)

### TODO för Produktion
- [ ] Rate limiting
- [ ] HTTPS enforcement
- [ ] CSP headers
- [ ] PostgreSQL (ersätt SQLite)
- [ ] Password strength requirements
- [ ] 2FA

## 🚨 Debugging-Strategier

### API Route Errors

1. **Kolla console logs** (både client & server)
```typescript
console.log("Request body:", body)
console.error("Error details:", error)
```

2. **Testa med curl/Postman**
```bash
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"field": "value"}'
```

3. **Inspektera Prisma Studio**
```bash
npm run db:studio
# Verifiera att data ser rätt ut
```

### Client-Side Errors

1. **Använd React DevTools**
2. **Kolla Network tab** (se faktiska requests)
3. **Console.log state changes**
4. **Hard refresh** (Cmd+Shift+R / Ctrl+Shift+R)

### TypeScript Errors

```bash
# Check all errors
npx tsc --noEmit

# Regenerate Prisma types
npx prisma generate

# Restart TS Server (VS Code)
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## 📚 Resurser

### Extern Dokumentation
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Zod Docs](https://zod.dev)
- [Vitest Docs](https://vitest.dev)

### Intern Dokumentation
- **README.md** - Vad som är byggt, roadmap, användarguide
- **CLAUDE.md** - Detta dokument (arbetsprocesser)
- **prisma/schema.prisma** - Databasschema

## 💡 Best Practices Checklista

### Innan du börjar koda
- [ ] Läs CLAUDE.md (detta dokument)
- [ ] Kolla README.md för projektöversikt
- [ ] Förstå databasschema (prisma/schema.prisma)
- [ ] Kör `npm run dev` och testa appen manuellt

### När du kodar
- [ ] Följ TDD (tester först!)
- [ ] Använd TypeScript strict mode (ingen `any`)
- [ ] Validera input med Zod på både client & server
- [ ] Kontrollera auth & authorization
- [ ] Logga errors tydligt
- [ ] Använd svenska i UI-texter
- [ ] Använd engelska i kod & kommentarer

### Innan du commitar
- [ ] Kör alla tester (`npm test`)
- [ ] Kör TypeScript check (`npx tsc --noEmit`)
- [ ] Testa manuellt i browser
- [ ] Uppdatera README.md om du lagt till features
- [ ] Skriv tydligt commit message (svenska OK)

### När något inte fungerar
1. Läs felmeddelandet noga
2. Kolla console logs (både client & server)
3. Testa i isolation (curl, Postman, Prisma Studio)
4. Kolla "Vanliga Gotchas" i detta dokument
5. Rensa cache (`.next`, `node_modules/.cache`)

## 🔄 Senaste Ändringar i Arbetsflödet

### 2025-11-13
- **Lade till E2E-testning sektion med lärdomar från implementation**
  - Kod-först approach: Minskar iterationer från 5-10 till 1-2
  - Test data management patterns för parallella tester
  - Selector best practices (data-testid > roles > nth())
  - Timing & waits patterns
  - Meta-lärdom: Vikten av att reflektera aktivt efter varje uppgift
- **Dokumenterade att aktivt lärande ska bli en vana**
  - Efter varje större uppgift: stanna upp och reflektera
  - Identifiera patterns som kan återanvändas
  - Förbättra processen kontinuerligt

### 2025-11-12
- Separerade CLAUDE.md (hur vi jobbar) från README.md (vad vi byggt)
- Förtydligade TDD-workflow
- Lade till fler debugging-strategier
- Dokumenterade vanliga gotchas bättre

---

**Skapad av**: Claude Code
**För projektöversikt**: Se README.md
**För frågor om vad som är byggt**: Se README.md
**För frågor om hur vi jobbar**: Detta dokument
