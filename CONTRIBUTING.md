# Contributing to Equinet

Tack för att du vill bidra till Equinet! Detta dokument beskriver hur du sätter upp din utvecklingsmiljö och följer våra utvecklingsriktlinjer.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Git Workflow](#git-workflow)
- [Pull Requests](#pull-requests)

---

## 🚀 Development Setup

### Prerequisites

- **Node.js**: v20 eller senare
- **npm**: v10 eller senare
- **Git**: För version control
- **VS Code** (rekommenderat): Med följande extensions:
  - ESLint
  - Prettier
  - Prisma
  - Tailwind CSS IntelliSense

### Initial Setup

1. **Klona repo och installera dependencies**
   ```bash
   git clone <repository-url>
   cd equinet
   npm install
   ```

2. **Sätt upp environment variables**
   ```bash
   # Kopiera example-fil
   cp .env.example .env

   # Generera NEXTAUTH_SECRET
   openssl rand -base64 32
   ```

   **Konfigurera DATABASE_URL (Supabase):**
   - Skapa ett gratis projekt på [supabase.com](https://supabase.com)
   - Gå till: Project Settings → Database → Connection string
   - Välj **Session Pooler (IPv4)** (viktigt för lokal utveckling)
   - Kopiera connection string och ersätt i `.env`

   **Öppna `.env` och fyll i:**
   - `DATABASE_URL` - Connection string från Supabase
   - `NEXTAUTH_SECRET` - Det genererade värdet ovan

3. **Skapa databas och seeda testdata**
   ```bash
   # Generera Prisma client
   npx prisma generate

   # Skapa databas från schema
   npx prisma db push

   # Seeda testdata
   npx tsx prisma/seed-test-users.ts
   ```

4. **Verifiera setup**
   ```bash
   # Kör full test suite
   npm run test:run        # Unit tests (ska passa 100%)
   npm run test:e2e        # E2E tests
   npm run typecheck       # TypeScript check (inga errors)

   # Starta dev server
   npm run dev
   ```

   Öppna http://localhost:3000 och logga in med:
   - **Kund**: test@example.com / TestPassword123!
   - **Provider**: provider@example.com / ProviderPass123!

---

## 🔄 Development Workflow

### Daglig Workflow

1. **Starta dev server**
   ```bash
   npm run dev
   ```

2. **Öppna Prisma Studio** (för databas-inspektion)
   ```bash
   npm run db:studio
   ```

3. **Kör tester i watch mode** (parallellt med dev)
   ```bash
   npm test              # Unit tests
   ```

### Efter Schema-ändringar

```bash
# 1. Uppdatera schema.prisma
# 2. Generera Prisma client
npx prisma generate

# 3. Pusha schema till databas
npx prisma db push

# 4. Verifiera ändringar
npm run db:studio
```

### Rensa Cache (vid konstiga fel)

```bash
# Rensa Next.js cache
rm -rf .next

# Rensa Turbopack cache
rm -rf node_modules/.cache

# Restart dev server
npm run dev
```

---

## 🧪 Testing

### Test-Driven Development (TDD)

Vi följer **strict TDD** för all kod:

1. **Skriv test FÖRST** (🔴 Red)
2. **Implementera minimal kod för att testa passerar** (🟢 Green)
3. **Refactorera** (🔵 Refactor)

### Unit Tests

```bash
npm test                    # Watch mode
npm run test:run            # Run once
npm run test:coverage       # Med coverage report
```

**Test-struktur:**
```typescript
describe('Feature/Component', () => {
  it('should do something when condition', () => {
    // Arrange
    const input = { ... }

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe(expected)
  })
})
```

**Coverage-mål:**
- API Routes: ≥80%
- Utilities/Helpers: ≥90%
- Overall: ≥70%

### E2E Tests

```bash
npm run test:e2e            # Run all E2E tests
npx playwright test <file>  # Run specific file
npx playwright test --ui    # Open UI mode
```

**E2E Best Practices:**
- Använd `data-testid` för element som listas/repeteras
- Använd semantic roles där möjligt (`getByRole`)
- Kolla koden FÖRE du skriver test (undvik att gissa selectors)
- Skriv resilient tests (hantera både success och empty states)

### TypeScript Check

```bash
npm run typecheck            # Kör TypeScript check (använder tsconfig.typecheck.json)
```

**OBS:** Använd alltid `npm run typecheck` istället för `npx tsc --noEmit`. Direktanrop till `tsc` kan krascha med "heap out of memory" på grund av testfiler och projektets storlek. `npm run typecheck` använder en separat tsconfig som exkluderar testfiler och aktiverar incremental builds.

**Inga TypeScript-fel är tillåtna före commit!**

---

## 📝 Code Style

### Språk

- **UI/Comments/Docs**: Svenska
- **Code/Variables/Functions**: Engelska
- **Commit messages**: Engelska

### Kodkonventioner

**TypeScript:**
```typescript
// ✅ GOOD: Explicit types, clear naming
interface CreateBookingRequest {
  serviceId: string
  date: Date
  horseName: string
}

async function createBooking(data: CreateBookingRequest): Promise<Booking> {
  // Implementation
}

// ❌ BAD: Any types, unclear naming
async function create(data: any) {
  // Implementation
}
```

**API Routes:**
```typescript
// ✅ GOOD: Full error handling (NextAuth v5 + strukturerad logging)
export async function POST(request: Request) {
  try {
    // 1. Auth check (NextAuth v5: auth() ersätter getServerSession)
    const session = await auth()
    if (!session) return new Response("Unauthorized", { status: 401 })

    // 2. Parse JSON med error handling
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // 3. Validate
    const validated = schema.parse(body)

    // 4. Business logic
    const result = await prisma.model.create({ data: validated })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Error:", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internal error", { status: 500 })
  }
}
```

**Prisma Queries:**
```typescript
// ✅ GOOD: Select only needed fields
const providers = await prisma.provider.findMany({
  select: {
    id: true,
    businessName: true,
    services: {
      select: {
        id: true,
        name: true,
      }
    }
  }
})

// ❌ BAD: Include all relations (over-fetching + säkerhetsproblem)
const providers = await prisma.provider.findMany({
  include: {
    services: true,
    user: true,  // Exponerar email, phone, passwordHash!
  }
})
```

### Next.js 16 Gotchas

**`params` är en Promise:**
I Next.js 16 är `params` i dynamic routes en `Promise` och måste awaitas:

```typescript
// ✅ RÄTT (Next.js 16)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}

// ❌ FEL (Next.js 15 och äldre)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params  // Fungerar inte!
}
```

### Logging

Använd **alltid** den strukturerade loggern istället för `console.*`:

```typescript
import { logger } from "@/lib/logger"

// ✅ RÄTT
logger.info("Booking created", { bookingId, userId })
logger.error("Failed to create booking", error instanceof Error ? error : new Error(String(error)))
logger.security("unauthorized_access", "medium", { userId, resource })

// ❌ FEL
console.log("Booking created")
console.error("Error:", error)
```

### Repository Pattern

Kärndomäner (Booking, Provider, Service) ska använda repository pattern:

```typescript
// ✅ RÄTT: Route använder repository för kärndomän
import { bookingRepository } from "@/infrastructure/BookingRepository"
const booking = await bookingRepository.findById(id)

// ❌ FEL: Route använder Prisma direkt för kärndomän
const booking = await prisma.booking.findUnique({ where: { id } })
```

Stöddomäner (AvailabilityException, AvailabilitySchedule) kan använda Prisma direkt.

### Rate Limiting

Alla API routes ska ha rate limiting via Upstash Redis:

```typescript
import { rateLimiters } from "@/lib/rate-limit"

// I route handler:
const rateLimitResult = await rateLimiters.api(request)
if (!rateLimitResult.success) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 })
}
```

Gränsvärden:
- Register/Login: 5/timme per IP
- Bokningar: 10/timme per användare
- Publika endpoints: 100/timme per IP

### Säkerhet

**ALLTID kontrollera:**
- ✅ Input validation (Zod schemas)
- ✅ Authentication (session check)
- ✅ Authorization (äger användaren resursen?)
- ✅ SQL injection prevention (Prisma hanterar detta)
- ✅ XSS prevention (React hanterar detta, men var försiktig med `dangerouslySetInnerHTML`)
- ✅ Exponera INTE känslig data i API responses

---

## 🌳 Git Workflow

### Feature Branch Workflow

1. **Skapa feature branch**
   ```bash
   git checkout -b feature/beskrivande-namn
   # Exempel: feature/booking-cancellation
   ```

2. **Arbeta på feature med TDD**
   - Skriv tester först
   - Implementera
   - Committa ofta med beskrivande meddelanden

3. **Kör pre-merge checklist**
   ```bash
   npm run test:run        # Alla unit tests måste passa
   npm run test:e2e        # Alla E2E tests måste passa
   npm run typecheck       # Inga TypeScript errors
   npm run build           # Build måste lyckas
   ```

4. **Merge till main** (när alla tester är gröna)
   ```bash
   git checkout main
   git pull
   git merge feature/beskrivande-namn
   ```

5. **Push till remote**
   ```bash
   git push origin main
   ```

### Husky Pre-push Hook

Projektet har en automatisk pre-push hook (via Husky) som körs innan varje `git push`:

```bash
# Hooken kör automatiskt:
npm run check:swedish  # Kontroll av svenska tecken
npm run test:run       # Alla unit tests
npm run typecheck      # TypeScript check
npm run lint           # ESLint check
```

Om något failar avbryts pushen. Du behöver inte köra dessa manuellt innan push - hooken sköter det åt dig. Men det kan vara bra att köra dem under utveckling för att slippa vänta vid push.

### Commit Messages

Följ Conventional Commits-formatet:

```
type(scope): beskrivning

[valfri body]

[valfri footer]
```

**Types:**
- `feat`: Ny feature
- `fix`: Buggfix
- `refactor`: Kod-förbättring utan funktionell ändring
- `test`: Lägga till eller uppdatera tester
- `docs`: Dokumentation
- `chore`: Build/config-ändringar

**Exempel:**
```bash
git commit -m "feat(booking): add cancellation with refund logic"
git commit -m "fix(api): handle JSON parsing errors in POST /api/bookings"
git commit -m "test(provider): increase coverage to 85%"
```

---

## 🔍 Pull Requests (Future: När GitHub branch protection är aktivt)

### PR Checklist

Innan du öppnar en PR, säkerställ att:

- [ ] Alla unit tests passerar (100%)
- [ ] Alla E2E tests passerar (100%)
- [ ] TypeScript check utan errors
- [ ] Build lyckas
- [ ] Coverage ≥70% (check med `npm run test:coverage`)
- [ ] Kod följer style guide
- [ ] Commit messages följer Conventional Commits
- [ ] README uppdaterad (om ny feature)

### PR Template

```markdown
## Beskrivning
Kort beskrivning av ändringen.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Beskriv hur du testade ändringen:
- Unit tests: ...
- E2E tests: ...
- Manual testing: ...

## Checklist
- [ ] Code följer style guide
- [ ] Alla tester passerar
- [ ] Documentation uppdaterad
```

---

## 🆘 Troubleshooting

### Common Issues

**Issue: "Missing required environment variable: DATABASE_URL"**
```bash
# Lösning: Kopiera .env.example till .env
cp .env.example .env
# Redigera .env och fyll i värdena
```

**Issue: "Prisma Client not generated"**
```bash
# Lösning: Generera Prisma client
npx prisma generate
```

**Issue: "Port 3000 already in use"**
```bash
# Lösning: Hitta och döda processen
lsof -ti:3000 | xargs kill -9
```

**Issue: "MaxClientsInSessionMode: max clients reached" (503-fel)**
```bash
# Orsak: Prisma Studio-processer stängs inte automatiskt och äter alla DB-anslutningar
# Lösning: Hitta och döda zombie-processer
ps aux | grep prisma
pkill -f "prisma studio"
```
Tips: Stäng alltid Prisma Studio med Ctrl+C när du är klar. Kontrollera med `ps aux | grep prisma` om appen plötsligt får 503-fel.

**Issue: Tests failar efter schema-ändring**
```bash
# Lösning: Uppdatera mocks/tests för att matcha nytt schema
# 1. Läs ändringen i schema.prisma
# 2. Uppdatera motsvarande API tests
# 3. Uppdatera E2E tests om API-kontrakt ändrats
```

---

## 📚 Resurser

- **Projekt Docs**: README.md (översikt), CLAUDE.md (utvecklingsguide)
- **Tech Stack**:
  - [Next.js Docs](https://nextjs.org/docs)
  - [Prisma Docs](https://www.prisma.io/docs)
  - [NextAuth v5 Docs](https://authjs.dev/)
  - [shadcn/ui](https://ui.shadcn.com)
  - [Vitest Docs](https://vitest.dev/)
  - [Playwright Docs](https://playwright.dev/)

---

## 💬 Frågor?

Om du har frågor, öppna en issue eller kontakta projekt-maintainers.

**Happy coding!** 🚀
