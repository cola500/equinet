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
✅ page.locator('[data-testid="service-card"]')
✅ page.locator('[data-testid="service-item"]')
✅ page.locator('[data-testid="provider-card"]')
```

**Implementerade data-testid i Equinet:**
- `[data-testid="user-type-customer"]` - Kund-knapp i registrering
- `[data-testid="user-type-provider"]` - Leverantör-knapp i registrering
- `[data-testid="provider-card"]` - Provider-kort i galleri (/providers)
- `[data-testid="service-card"]` - Tjänstekort på provider-detaljsida (för booking)
- `[data-testid="service-item"]` - Tjänsteobjekt i provider's tjänste-lista
- `[data-testid="booking-item"]` - Bokningsobjekt (både customer och provider sidor)

**Regel:** Vid skapande av nya list-items, kort eller interaktiva element - lägg ALLTID till data-testid!

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

4. **Strict Mode Violations - Var specifik!**
```typescript
// ❌ Fel: getByText() kan matcha flera element
await page.getByText(/inga.*bokningar/i)
// Error: strict mode violation: resolved to 2 elements

// ✅ Rätt: Använd mer specifik selector
await page.getByRole('heading', { name: /inga.*bokningar/i })
// Matchar endast <h1>, <h2>, <h3>, etc.

// Lärdomar:
// - getByText() matchar HELA text-noder, även osynlig text i divs
// - getByRole() är mer specifikt och följer semantisk HTML
// - Vid strict mode violations: använd mer specifik selector eller nth()
```

5. **UNDVIK: CSS classes och komplex DOM traversal**
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

### 🎭 Conditional/Hidden Fields Pattern

**Problem:** Formulärfält som visas/döljs baserat på användarval (t.ex. conditional rendering med `hidden` CSS-class).

**Lösning: Fyll i fält i rätt ordning och vänta på synlighet**

```typescript
// ❌ FEL ordning - försöker fylla fält som ännu inte är synliga
await page.click('[data-testid="user-type-provider"]');
await page.getByLabel(/företagsnamn/i).fill('Test AB')  // Failar! Fältet är dolt

// ✅ RÄTT ordning - fyll synliga fält först, sedan trigga conditional
// 1. Fyll i alltid-synliga fält först
await page.getByLabel(/förnamn/i).fill('Test');
await page.getByLabel(/efternamn/i).fill('Testsson');
await page.getByLabel(/email/i).fill('test@example.com');

// 2. Trigga conditional rendering (klick på knapp/radio som visar fälten)
await page.click('[data-testid="user-type-provider"]');

// 3. Vänta på att fältet blir SYNLIGT (inte bara 'attached')
await page.waitForSelector('#businessName', { state: 'visible', timeout: 5000 });

// 4. NU kan vi fylla i de conditional fälten
await page.getByLabel(/företagsnamn/i).fill('Test AB');
```

**Viktigt:**
- Använd `state: 'visible'` (INTE `state: 'attached'`)
- Parent-element med `hidden` CSS-class gör barn-element dolda
- Fyll alltid i synliga fält innan du triggar conditional logic

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

**4. Conditional Rendering Tests (olika UI beroende på state)**
```typescript
test('should handle empty state with conditional content', async ({ page }) => {
  await page.goto('/bookings')

  const bookingCount = await page.locator('[data-testid="booking-item"]').count()

  if (bookingCount === 0) {
    // Empty state ska visas
    await expect(page.getByRole('heading', { name: /inga.*bokningar/i })).toBeVisible()

    // Men content kan variera beroende på annan state
    // Kolla om texten säger "Byt filter" (betyder att det finns bokningar i andra filter)
    const hasFilterText = await page.getByText(/byt filter/i).isVisible().catch(() => false)

    if (!hasFilterText) {
      // Helt tomt - länken ska visas
      await expect(page.getByRole('link', { name: /hitta tjänster/i })).toBeVisible()
    }
    // Om hasFilterText är true: skippa länkkontrollen (länken visas bara vid helt tomt)
  } else {
    // Bokningar finns - verifiera listan
    await expect(page.locator('[data-testid="booking-item"]').first()).toBeVisible()
  }
})
```

**Lärdomar:**
- UI kan rendera olika innehåll beroende på **flera** state-variabler (inte bara en)
- Exempel: `bookings.length === 0` OCH filter-status
- Tester måste hantera alla kombinationer av conditional rendering
- Använd nested conditionals för att testa rätt sak i rätt scenario

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

**Iteration 3: Conditional fields fix (2025-11-13)**
- ✅ Fixade provider-registrering med conditional fields
- ✅ Använd kod-först approach konsekvent
- ✅ Alla data-testid på plats
- 📈 Pass rate: **100% (22/22) - STABILT**
- ⏱️ Körning: ~31s

**Iteration 4: Availability feature + Empty state fix (2025-11-13)**
- ✅ Implementerade availability schema (öppettider per veckodag)
- ✅ Playwright setup project för automatisk testdata-seeding
- ❌ Problem: Empty state test failade på två olika sätt:
  1. `getByText()` matchade flera element (strict mode violation)
  2. Conditional rendering av länk vs text beroende på `bookings.length`
- ✅ Lösning:
  - Använd `getByRole('heading')` för specifik selector
  - Conditional check för "Byt filter"-text innan länkkontroll
- 📈 Pass rate: **100% (23/23) - STABILT**
- ⏱️ Körning: ~41s

**Iteration 5: Next.js 15.5.0 Upgrade & Manifest Bug Fix (2025-11-15)**
- ❌ Problem: Next.js 15.0.3 manifest bug blockerade ALL E2E-testning
  - Playwright kunde inte starta dev server (MODULE_NOT_FOUND errors)
  - Saknade manifest-filer: middleware-manifest.json, routes-manifest.json
- 🔍 Investigation: Identifierade att problemet var Next.js-specifikt, inte Playwright
- ✅ Lösning: Uppgradera Next.js 15.0.3 → 15.5.0
  1. Testade upgrade på separat branch (test/nextjs-15.5-upgrade)
  2. Manifest-filer genereras nu korrekt
  3. Dev server startar på 1.5s (snabbare än 15.0.3!)
  4. Fixade 2 selector-problem i route-planning tests:
     - Strict mode violation: `getByText()` → `getByRole('heading').first()`
     - Empty state: Generisk heading-check istället för specifik text
- 📈 Pass rate: **100% (35/35 tester) - STABILT** ✨
- ⏱️ Körning: ~1.9 minuter (med all setup/cleanup)

**Viktiga Lärdomar:**
1. **Framework-buggar kan blockera hela arbetsflödet** - undersök om upgrade löser problemet
2. **Test på separat branch** innan merge till main - säkrare än workarounds
3. **Kod-först approach fungerar!** - Fixade selectors på 1-2 iterationer (inte 5-10)
4. **All E2E-testning är nu redo för CI/CD** - inga blocking issues kvar

**Lärdom:** För MVP, prioritera **stabilitet > hastighet**. Kod-först approach minskar iterationer dramatiskt!

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

## ✅ Definition of Done (DoD)

> **Filosofi**: "Koden gör vad den ska och förstör inget annat i processen."

**DoD är vår quality checklist** - en uppgift är inte klar förrän ALLA punkter är avcheckade.

### 🎯 Version 1.0 (Lean Start - Vi bygger ut över tid!)

En feature/uppgift är **DONE** när:

#### 1. Funktionalitet
- [ ] **Fungerar som förväntat** - Manuellt testad i browser
- [ ] **Inga TypeScript-fel** - `npx tsc --noEmit` passerar
- [ ] **Inga console errors** - Browser console är ren
- [ ] **Responsiv** - Fungerar på desktop (mobile nice-to-have)

#### 2. Kod-kvalitet
- [ ] **Följer projektkonventioner** - Samma stil som befintlig kod
- [ ] **Säker kod** - Ingen XSS, SQL injection, eller andra OWASP-risker
- [ ] **Error handling** - Använder try-catch, loggar fel tydligt
- [ ] **Validering** - Zod-validering på både client OCH server

#### 3. Dokumentation
- [ ] **README.md uppdaterad INNAN commit** - Om ny feature, lägg till under version-highlights (gör det i SAMMA commit som koden för atomär change)
- [ ] **Kommentarer vid behov** - Komplex logik är förklarad
- [ ] **Komponent-README** - Nya komponenter har egen dokumentation (ex: `components/layout/README.md`)

#### 4. Git
- [ ] **Committed** - Med beskrivande commit message
- [ ] **Pushad** - Till remote repository

#### 5. Testning (TDD - Test-Driven Development)
**Vi följer TDD-principen: Red → Green → Refactor**

- [ ] **Unit tests SKRIVNA FÖRST** - För nya komponenter, hooks, utils och API routes
- [ ] **E2E tests uppdaterade/nya** - För användarflöden som påverkas
- [ ] **Alla tester passerar** - `npm run test:run` (unit) + `npm run test:e2e` (E2E)
- [ ] **Coverage ≥70%** - För ny kod (kör `npm run test:coverage` för att verifiera)
- [ ] **Manuell testning** - Slutlig verifiering av user flow i browser

**TDD-cykel:**
1. 🔴 **Red**: Skriv test som failar (beskriv önskat beteende)
2. 🟢 **Green**: Skriv minsta kod för att få testet grönt
3. 🔵 **Refactor**: Förbättra koden, testen ska vara gröna
4. ♻️ **Upprepa**: Nästa feature/beteende

---

### 📝 DoD Checklist i Praktiken

**Exempel: "Lägg till layout-komponent system"**

- [x] ✅ Funktionalitet
  - [x] Header visas konsekvent på alla sidor
  - [x] Navigation fungerar korrekt
  - [x] Ingen TypeScript-fel
  - [x] Inga console errors
  - [x] Responsiv design

- [x] ✅ Kod-kvalitet
  - [x] Följer projektets komponentstruktur
  - [x] Auth-kontroller på plats
  - [x] Error boundaries (där relevant)

- [x] ✅ Dokumentation
  - [x] README.md uppdaterad med layout-struktur
  - [x] `components/layout/README.md` skapad med exempel

- [x] ✅ Git
  - [x] Committed med beskrivande meddelande
  - [x] Pushad till main

- [x] ✅ Testning
  - [x] Manuellt testad på alla sidor

**Resultat:** Feature är DONE! ✨

---

### 🔄 Evolverande DoD

**DoD ska uppdateras regelbundet!** Efter varje större milstolpe eller retrospective:

**När lägga till mer?**
- När vi hittat återkommande buggar → Lägg till check för det
- När vi byggt ut testsuite → Höj testkrav
- När vi närmar oss produktion → Lägg till säkerhet/performance-checks

**Nuvarande TODO för framtida versioner:**
- [ ] Performance budgets (när vi optimerar)
- [ ] Accessibility checks (WCAG compliance)
- [ ] Security scans (när vi går mot prod)
- [ ] Cross-browser testing (Safari, Firefox, Chrome)

---

### 💡 Varför DoD?

✅ **Konsekvent kvalitet** - Varje feature håller samma standard
✅ **Mindre teknisk skuld** - Vi skippar inga steg
✅ **Färre buggar** - Fångar problem innan de blir större
✅ **Bättre dokumentation** - Framtida utvecklare (och vi själva!) förstår koden
✅ **Trygghet** - Vi vet att koden är produktionsklar

---

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
- [ ] **Kolla DoD-checklistan ovan!** ⬆️
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

## 🛡️ JSON Parsing Pattern (Kritiskt för API Routes!)

### Problem
När en API route tar emot en POST/PUT request och försöker parsa JSON med `await request.json()`, kan det gå fel på flera sätt:
- Tom request body
- Korrupt JSON
- Fel Content-Type
- Network-avbrott under upload

**Om detta inte hanteras korrekt:**
1. `request.json()` kastar error
2. API:t crashar utan att returnera något svar
3. Klienten får ingen response
4. Klientens `response.json()` kastar också error
5. Användaren ser ingen feedback (t.ex. dialog som aldrig stängs)

### Lösning: ALLTID Wrappa request.json() i Try-Catch

**Pattern som ska användas i ALLA POST/PUT routes:**

```typescript
export async function POST(request: Request) {
  try {
    // 1. Auth check först
    const session = await auth()

    // 2. VIKTIGT: Parse JSON med error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error("Invalid JSON in request body:", jsonError)
      return NextResponse.json(
        { error: "Invalid request body", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // 3. Nu är det säkert att validera med Zod
    const validated = schema.parse(body)

    // 4. Business logic...
    const result = await prisma.model.create({ data: validated })

    return NextResponse.json(result)
  } catch (error) {
    // 5. Övrig error handling (auth, Zod, Prisma, etc.)
    if (error instanceof Response) return error
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

### Varför detta är viktigt

**Utan try-catch:**
```typescript
// ❌ FEL - kan krascha utan svar
const body = await request.json()  // Kastar Error vid invalid JSON
const validated = schema.parse(body)  // Denna rad körs aldrig
```

**Med try-catch:**
```typescript
// ✅ RÄTT - returnerar alltid ett svar
let body
try {
  body = await request.json()
} catch (jsonError) {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
}
// Nu är body garanterat parsad, eller så har vi returnerat error
```

### Checkpointa: Har du lagt till JSON parsing protection?

Kolla varje POST/PUT route:
- [ ] Finns `try { body = await request.json() } catch {}`?
- [ ] Returneras en 400 response vid parse-error?
- [ ] Loggas felet med `console.error()`?
- [ ] Används `body` variabeln efter try-catch blocket?

**Exempel på routes som MÅSTE ha detta:**
- `/api/bookings` (POST)
- `/api/bookings/[id]` (PUT)
- `/api/services` (POST)
- `/api/services/[id]` (PUT)
- `/api/profile` (PUT)
- `/api/provider/profile` (PUT)
- `/api/route-orders` (POST)
- `/api/providers/[id]/availability-schedule` (PUT)
- `/api/routes/[id]/stops/[stopId]` (PATCH)

---

## 🔍 Systematisk Debugging Guide

### Filosofi: Debugga från UI till Databas

När något går fel, följ denna **systematiska process** istället för att gissa:

```
🎨 UI Layer (vad ser användaren?)
   ↓
📱 Client Layer (vad skickas till servern?)
   ↓
🔌 API Layer (tar servern emot det? vad svarar den?)
   ↓
💾 Database Layer (sparas data korrekt?)
```

### Steg-för-Steg Debugging Process

#### 1. UI Layer - Vad ser användaren?

**Verktyg:**
- Browser DevTools Console
- React DevTools (Components & Profiler)
- Network tab (är requesten skickad?)

**Frågor att ställa:**
- Visas rätt felmeddelande?
- Är formulär-fälten ifyllda korrekt?
- Händer något när användaren klickar? (loading state?)
- Finns det console errors?

**Exempel:**
```typescript
// Lägg till debug-logging i client-komponent
const handleSubmit = async (data) => {
  console.log("📤 Skickar data:", data)  // Vad skickas?

  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    console.log("📥 Response status:", response.status)  // Vad kom tillbaka?

    const result = await response.json()
    console.log("📥 Response data:", result)
  } catch (error) {
    console.error("❌ Client error:", error)  // Vad gick fel?
  }
}
```

#### 2. Client Layer - Network Inspection

**Verktyg:**
- Browser Network tab
- Preserve log (viktigt vid redirects!)

**Kolla:**
1. **Request Headers** - Är Content-Type korrekt?
2. **Request Payload** - Är JSON välformaterad?
3. **Response Status** - 200 OK, 400 Bad Request, 401 Unauthorized, 500 Internal?
4. **Response Body** - Vad svarade servern?

**Vanliga problem:**
- ❌ Payload är tom (glömt `JSON.stringify()`?)
- ❌ Content-Type är inte `application/json`
- ❌ Response är tom (API:t crashade utan att svara)

#### 3. API Layer - Server-Side Debugging

**Verktyg:**
- Server console logs (`console.log` i API routes)
- Terminal där `npm run dev` körs

**Debug-pattern för API routes:**

```typescript
export async function POST(request: Request) {
  console.log("🔵 API POST /api/endpoint - Start")

  try {
    // Auth
    const session = await auth()
    console.log("🔵 Session:", { userId: session.user.id, userType: session.user.userType })

    // Parse JSON
    let body
    try {
      body = await request.json()
      console.log("🔵 Request body:", body)
    } catch (jsonError) {
      console.error("❌ JSON parsing failed:", jsonError)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Validate
    const validated = schema.parse(body)
    console.log("🔵 Validated data:", validated)

    // Database
    const result = await prisma.model.create({ data: validated })
    console.log("✅ Created:", result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ API Error:", error)

    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      console.error("❌ Validation errors:", error.issues)
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }

    return new Response("Internal error", { status: 500 })
  }
}
```

**Vad ska du se i terminal?**
- `🔵 API POST /api/endpoint - Start` - Requesten nådde servern
- `🔵 Session: { userId: '...', userType: 'customer' }` - Auth funkar
- `🔵 Request body: { ... }` - JSON parsades OK
- `🔵 Validated data: { ... }` - Zod-validering passerade
- `✅ Created: { id: '...', ... }` - Databasen skapade objektet

**Om något saknas** - där är problemet!

#### 4. Database Layer - Prisma Studio & Logs

**Verktyg:**
- `npm run db:studio` (Prisma Studio på localhost:5555)
- Prisma query logs

**Kolla:**
1. Skapades objektet i databasen?
2. Har det rätt data?
3. Finns relaterade objekt (foreign keys)?

**Aktivera Prisma query logging:**
```typescript
// src/lib/prisma.ts
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],  // Logga alla queries
})
```

**Vanliga databasproblem:**
- ❌ Foreign key constraint failure (relaterat objekt finns inte)
- ❌ Unique constraint violation (duplicerad data)
- ❌ NULL constraint violation (required field saknas)

### Exempel: Dialog som inte stängs (verkligt fall från Equinet)

**Symptom:** Bokningsdialog stannar öppen i 30s efter submit.

**Debug-process:**

1. **UI Layer:**
   - ✅ Console visar "Skickar bokning..."
   - ❌ Ingen success/error message
   - ❌ Dialog stängs inte

2. **Client Layer (Network tab):**
   - ✅ Request skickas till `/api/bookings`
   - ❌ Response body är **TOM** (inte ens error JSON!)
   - ❌ Response status: 200 (men ingen data??)

3. **API Layer (Server console):**
   - ✅ "API POST /api/bookings - Start"
   - ❌ **Ingenting mer** (crashade på rad 2!)
   - **Hittade problemet:** `await request.json()` kastade error pga tom body

4. **Lösning:**
   - Lade till try-catch runt `request.json()`
   - Nu returneras alltid en response (antingen data eller error)
   - Klienten får svar → kan stänga dialog

**Lärdom:** Jobba systematiskt från UI → DB istället för att gissa. Varje lager ger ledtrådar till nästa!

### Quick Reference: Debugging Checklist

När något inte fungerar:

1. [ ] Kolla browser console - finns errors?
2. [ ] Kolla Network tab - skickades requesten? vad svarade servern?
3. [ ] Kolla server terminal - loggas något? var slutar loggarna?
4. [ ] Lägg till debug-logging där loggarna slutar
5. [ ] Kolla Prisma Studio - finns datan i databasen?
6. [ ] Fixa problemet i det lagret där det upptäcktes
7. [ ] Testa igen från början

**Förvänta dig INTE att gissa rätt direkt - debugga systematiskt!**

---

## 💾 Disk Space Management & Git Best Practices

### Problem: Git Push Kan Faila vid Lågt Diskutrymme

**Symptom:**
```bash
error: pack-objects died of signal 10 (SIGBUS)
fatal: the remote end hung up unexpectedly
```

**Root Cause:**
- Disken är >90% full
- Git försöker komprimera objekt i minnet
- Inte tillräckligt med plats för temporary files
- Signal 10 (SIGBUS) = memory/IO error

### Lösning 1: Disable Compression (Snabbfix)

```bash
# Tillfälligt disable compression för push
git config core.compression 0

# Pusha
git push

# (Optional) Återställ compression efter push
git config --unset core.compression
```

**Varför det funkar:**
- Skippar minnes-intensiv komprimering
- Snabbare push (men större datamängd skickas)
- Använd bara när disken är nästan full!

### Lösning 2: Frigör Diskutrymme (Långsiktig lösning)

#### Checka diskutrymme först

```bash
# Mac/Linux
df -h .

# Exempel output:
# Filesystem      Size   Used  Avail Capacity
# /dev/disk3s1   228Gi  193Gi   12Gi    94%    ← PROBLEM! <15GB fritt
```

**Varningsgränser:**
- 🟢 >20GB fritt: Allt OK
- 🟡 10-20GB fritt: Håll utkik
- 🔴 <10GB fritt: Cleanup ASAP!
- 🚨 <5GB fritt: Risk för git/build failures!

#### Cleanup-kommandon (kör i denna ordning)

```bash
# 1. NPM cache (kan spara 1-2GB)
npm cache clean --force

# 2. Next.js build cache (kan spara 500MB-2GB)
rm -rf .next

# 3. Node modules cache (om du har många projekt)
rm -rf node_modules/.cache

# 4. Playwright browsers (kan spara 1-3GB om inte används)
npx playwright uninstall --all

# 5. (Försiktig!) Gamla Git objects
git gc --prune=now --aggressive  # OBS: Kan också faila vid lågt diskutrymme!

# 6. Checka igen
df -h .
```

#### Hitta stora filer/mappar

```bash
# Hitta top 10 största mappar i current directory
du -sh * | sort -hr | head -10

# Hitta stora filer (>100MB)
find . -type f -size +100M -exec ls -lh {} \; 2>/dev/null

# Vanliga stora mappar i Node.js-projekt:
# - node_modules/ (kan vara 500MB-2GB)
# - .next/ (100MB-500MB)
# - test-results/ (E2E screenshots kan vara stora)
# - coverage/ (test coverage reports)
```

### Best Practice: Pre-Push Disk Check

**Lägg till i ditt workflow:**

```bash
# Innan git push - kolla alltid diskutrymme
alias git-push-safe='df -h . && read -p "Fortsätt med push? (y/n) " -n 1 -r && echo && [[ $REPLY =~ ^[Yy]$ ]] && git push'

# Använd:
git-push-safe
```

**Eller skapa pre-push hook:**

```bash
# .git/hooks/pre-push
#!/bin/bash

available=$(df -k . | tail -1 | awk '{print $4}')
available_gb=$((available / 1024 / 1024))

if [ $available_gb -lt 10 ]; then
  echo "⚠️  WARNING: Only ${available_gb}GB free disk space!"
  echo "Consider running cleanup before push:"
  echo "  npm cache clean --force"
  echo "  rm -rf .next"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

exit 0
```

### Lärdomar från Equinet (2025-11-15)

**Problem:**
- Disk 94% full (12GB fritt)
- `git push` failade med signal 10
- `git gc` failade också (behöver diskutrymme för temporary files!)

**Lösning:**
1. `git config core.compression 0` - lyckad push!
2. Cleanup efter push (npm cache, .next, playwright)
3. Frigjorde 3GB → 15GB tillgängligt

**Lärdomar:**
- ✅ Checka diskutrymme INNAN stora operationer (git push, npm install, build)
- ✅ Håll >15GB fritt för säker utveckling
- ✅ `git gc` är INTE en lösning vid lågt diskutrymme (behöver plats själv!)
- ✅ Disable compression är en safe workaround för akuta lägen
- ✅ Cleanup regelbundet (npm cache, .next) - inte bara när det är för sent

### Quick Reference: Disk Space Troubleshooting

```bash
# 1. Checka status
df -h .

# 2. Om <15GB fritt - kör cleanup
npm cache clean --force && rm -rf .next

# 3. Om git push failar med signal 10
git config core.compression 0
git push
git config --unset core.compression

# 4. Hitta stora filer
du -sh * | sort -hr | head -10

# 5. Efter cleanup - verifiera
df -h .
```

---

## 🔄 Senaste Ändringar i Arbetsflödet

### 2025-11-15
- **Next.js 15.5.0 Upgrade - Löste E2E-blockerande bug**
  - Identifierade att Next.js 15.0.3 manifest bug blockerade ALL E2E-testning
  - Uppgraderade till 15.5.0 som fixade problemet helt
  - Dev server startar nu snabbare (1.5s vs långsammare i 15.0.3)
  - Alla 35 E2E-tester passerar nu stabilt (100% pass rate)
- **Dokumenterade Iteration 5 i E2E-sektionen**
  - Framework-buggar kan blockera hela arbetsflödet - undersök upgrades först
  - Test på separat branch före merge = säkrare än workarounds
  - Kod-först approach fortsätter fungera utmärkt (1-2 iterationer)
- **Background Process Hygiene**
  - Lärdomar om att döda gamla processer innan nya startas
  - Förhindrar port-konflikter och resursproblem

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
