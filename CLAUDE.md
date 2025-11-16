# CLAUDE.md - Utvecklingsguide för Equinet

> **Hur** vi arbetar i projektet. För **vad** som är byggt, se README.md.

## 📌 Projekt

- **Stack**: Next.js 16 (App Router) + TypeScript + Prisma + NextAuth + shadcn/ui
- **Språk**: Svenska (UI/docs), Engelska (kod)
- **Approach**: Databas-först, TDD, Feature branches

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

## 🔄 Key Learnings

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

---

**Skapad av**: Claude Code
**För projektöversikt**: Se README.md
