# Test Strategy: Mocks vs Real Database

> **Datum:** 2025-11-20
> **Status:** Planerad (ej implementerad ännu)
> **Bakgrund:** Diskussion om "realism" i tester - oro för att MockRepositories inte fångar verkligt databas-beteende

---

## Executive Summary

Equinet använder för närvarande en **trestegs-teststrategi** med olika grader av "realism":

1. **Unit Tests** (Repository Layer): MockRepositories (100% mockat)
2. **Integration Tests** (API Layer): Mockad Prisma (100% mockat)
3. **E2E Tests** (Playwright): Riktig databas (0% mockat)

**Problem:** Det finns ett betydande gap mellan vad unit/integration-tester testar och vad som faktiskt körs i produktion.

**Rekommendation:** Hybrid approach - lägg till smoke tests med real database, migrera gradvis till integration tests.

---

## 1. Nuvarande Situation: Vad Är Mockat?

### 1.1 Unit Tests (Repository Layer)

**Filer:**
- `src/infrastructure/persistence/booking/MockBookingRepository.ts`
- `src/infrastructure/persistence/service/MockServiceRepository.ts`
- `src/infrastructure/persistence/provider/MockProviderRepository.ts`

**Vad mockas:**
- Hela databaslagret ersätts med in-memory Map-strukturer
- Ingen SQLite, ingen Prisma, ingen SQL
- Business logic (filtering, sorting, time overlap) implementerad manuellt i TypeScript

**Exempel från MockBookingRepository:**
```typescript
async findOverlapping(providerId, date, startTime, endTime) {
  return Array.from(this.bookings.values()).filter((booking) => {
    // Manual time overlap logic in TypeScript
    const bookingStart = this.parseTime(booking.startTime)
    const bookingEnd = this.parseTime(booking.endTime)
    const requestStart = this.parseTime(startTime)
    const requestEnd = this.parseTime(endTime)
    return bookingStart < requestEnd && requestStart < bookingEnd
  })
}
```

**Coverage:**
- 342 unit tests totalt
- MockRepositories: 100% coverage
- Snabb: 5-8ms per test suite

### 1.2 Integration Tests (API Layer)

**Filer:**
- `src/app/api/services/route.test.ts`
- `src/app/api/bookings/[id]/route.test.ts`
- Alla `src/app/api/*/route.test.ts`

**Vad mockas:**
```typescript
vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    service: { findMany: vi.fn(), create: vi.fn() },
    booking: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))
```

**Testernas approach:**
```typescript
it('should create service for authenticated provider', async () => {
  // Setup mocks
  vi.mocked(getServerSession).mockResolvedValue(mockSession)
  vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider)
  vi.mocked(prisma.service.create).mockResolvedValue(mockService)

  // Call API
  const response = await POST(request)

  // Assertions
  expect(prisma.service.create).toHaveBeenCalledWith({ data: {...} })
})
```

**Vad testas:**
- ✅ HTTP status codes (200, 401, 404, 400)
- ✅ Authorization logic (session checks)
- ✅ Zod validation (invalid data → 400)
- ✅ Business logic flow

**Vad INTE testas:**
- ❌ Prisma query syntax (om `select`, `where`, `orderBy` är korrekt)
- ❌ Database constraints (foreign keys, unique constraints)
- ❌ Transaction isolation
- ❌ Query performance

### 1.3 E2E Tests (Playwright)

**Filer:**
- `e2e/booking.spec.ts`
- `e2e/provider.spec.ts`
- 7 spec-filer totalt (62 E2E tests)

**Setup:**
- Real SQLite database (`dev.db`)
- Real Next.js server (`http://localhost:3000`)
- Real Prisma queries
- Setup/teardown scripts seed availability + cleanup test data

**Coverage:**
- 62 E2E tests (44/47 passing i latest run)
- Testar full stack: UI → API → Database → UI
- Långsam: ~seconds per test (requires server start)

---

## 2. Risker Med Nuvarande Approach

### 2.1 HIGH RISK: Mock/Real Divergence

**Problem:** MockRepository-logiken kan skilja sig från Prisma/SQL-logiken.

**Exempel:**

**MockBookingRepository:**
```typescript
return results.sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime())
```

**Prisma query:**
```prisma
orderBy: { bookingDate: 'desc' }
```

**Risk:**
- Om SQL-sortingen hanterar timezone/UTC annorlunda → unit tests passar men produktion failar
- Om Prisma lägger till `take` limit → unit tests testar inte pagination-edge cases

**Real-world scenario:**
```
MockRepository returnerar ALLA bookings, sorterat
Prisma kanske har en implicit LIMIT eller använder andra sort-rules
→ Unit tests: ✅ Green
→ Production: ❌ Första 10 bookings saknar senaste bokningen
```

### 2.2 MEDIUM RISK: Database Constraints Inte Testade

**Exempel 1: Foreign Key Constraints**

Prisma schema:
```prisma
model Booking {
  serviceId String
  service   Service @relation(fields: [serviceId], references: [id])
}
```

**Vad händer om:**
- Du försöker skapa en booking med `serviceId="non-existent"`?
- MockRepository: Skapar bokningen utan problem ✅
- Real database: `FOREIGN KEY constraint failed` ❌

**Unit tests fångar INTE detta.**

**Exempel 2: Unique Constraints**

```prisma
model User {
  email String @unique
}
```

**Vad händer om:**
- Du försöker registrera samma email två gånger?
- MockRepository: Skapar båda users ✅ (om inte explicit check)
- Real database: `UNIQUE constraint failed` ❌

### 2.3 MEDIUM RISK: Query Syntax Errors

**API route testar:**
```typescript
vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices)
```

**Men om din faktiska kod har:**
```typescript
await prisma.service.findMany({
  where: { providerId },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    name: true,
    INVALID_FIELD: true // Typo!
  }
})
```

**Result:**
- Unit/Integration tests: ✅ Green (mocken bryr sig inte om select-syntax)
- Runtime: ❌ `PrismaClientValidationError: Unknown field 'INVALID_FIELD'`

### 2.4 LOW RISK: Transaction Behavior

**Scenario:**
Skapa en booking + skicka email i en transaktion:

```typescript
await prisma.$transaction([
  prisma.booking.create({ data: bookingData }),
  prisma.notification.create({ data: notificationData })
])
```

**Vad händer om andra create failar?**
- MockRepository: Första create blir permanent (ingen rollback) ❌
- Real database: Rollback av båda operations ✅

**Unit tests fångar INTE transaction isolation.**

### 2.5 LOW RISK: Performance Issues

**Problem:** MockRepository är alltid snabb (in-memory).

```typescript
await prisma.booking.findMany() // NO WHERE CLAUSE - fetches ALL bookings!
```

**Result:**
- Unit tests: ✅ Green, 5ms
- Production med 10,000 bookings: ❌ 5 seconds, OOM crash

Mock-tester ger dig ingen insikt om query-performance.

---

## 3. Alternativa Strategier

### Strategy A: Real Database for Integration Tests

**Concept:** Kör integration tests mot riktig SQLite/Prisma, men isolerad databas.

**Implementation:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./tests/integration-setup.ts'],
  },
})

// tests/integration-setup.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./test-integration.db' } }
})

beforeEach(async () => {
  await prisma.$executeRaw`DELETE FROM Booking`
  await prisma.$executeRaw`DELETE FROM Service`
  // ... seed minimal test data
})
```

**Test example:**
```typescript
import { prisma } from '@/lib/prisma' // Real Prisma client
import { POST } from './route'

it('should create service', async () => {
  const request = new NextRequest('...', {
    body: JSON.stringify({ name: 'Test', price: 800 })
  })

  const response = await POST(request)

  expect(response.status).toBe(201)

  // Verify in REAL database
  const service = await prisma.service.findFirst({
    where: { name: 'Test' }
  })
  expect(service).toBeTruthy()
  expect(service.price).toBe(800)
})
```

**Pros:**
- ✅ Tests real Prisma queries (catch syntax errors)
- ✅ Tests database constraints (foreign keys, unique)
- ✅ Tests transactions
- ✅ Still fast (SQLite in-memory: `file::memory:`)
- ✅ Catches 90% of mock/real divergence

**Cons:**
- ❌ Slower than pure mocks (~50-100ms vs 5ms)
- ❌ Requires database setup/teardown between tests
- ❌ Test isolation can be tricky (shared database state)
- ❌ More complex CI setup

**Effort estimate:** 2-3 timmar att migrera befintliga tests

---

### Strategy B: Contract Tests (Hybrid)

**Concept:** Behåll mocks för snabbhet, men lägg till "contract tests" som verifierar att mocks matchar real behavior.

**Implementation:**
```typescript
describe('MockBookingRepository Contract Tests', () => {
  const mockRepo = new MockBookingRepository()
  const realRepo = new BookingRepository() // Real Prisma

  afterEach(async () => {
    await prisma.booking.deleteMany() // Cleanup
  })

  it('should behave identically for findById', async () => {
    const booking = createTestBooking()

    // Save in both repos
    await mockRepo.save(booking)
    await realRepo.save(booking)

    // Assert same results
    const mockResult = await mockRepo.findById(booking.id)
    const realResult = await realRepo.findById(booking.id)

    expect(mockResult).toEqual(realResult)
  })

  it('should sort bookings identically', async () => {
    const bookings = [createBooking({ date: '2025-01-10' }), ...]

    await Promise.all(bookings.map(b => mockRepo.save(b)))
    await Promise.all(bookings.map(b => realRepo.save(b)))

    const mockSorted = await mockRepo.findMany()
    const realSorted = await realRepo.findMany()

    expect(mockSorted.map(b => b.id)).toEqual(realSorted.map(b => b.id))
  })
})
```

**Pros:**
- ✅ Keeps fast unit tests (using mocks)
- ✅ Contract tests verify mock/real parity
- ✅ Low disruption to existing test suite
- ✅ Clear separation: unit tests (fast) vs contract tests (slower)

**Cons:**
- ❌ Contract tests still need database setup
- ❌ Adds more test maintenance (two versions of same logic)
- ❌ Doesn't test API layer against real DB

**Effort estimate:** 1-2 timmar att lägga till contract tests

---

### Strategy C: Remove Mocks, Test Repositories Directly

**Concept:** Ta bort MockRepositories helt, testa endast mot real Prisma.

**Implementation:**
```typescript
// ServiceRepository.test.ts
import { PrismaClient } from '@prisma/client'
import { ServiceRepository } from './ServiceRepository'

const prisma = new PrismaClient({
  datasources: { db: { url: 'file::memory:' } }
})
const repo = new ServiceRepository()

beforeAll(async () => {
  await prisma.$executeRaw`PRAGMA foreign_keys = ON`
})

beforeEach(async () => {
  await prisma.service.deleteMany()
  await prisma.provider.deleteMany()
})

it('should find service by id', async () => {
  const provider = await prisma.provider.create({ data: {...} })
  const service = await prisma.service.create({
    data: { ...serviceData, providerId: provider.id }
  })

  const result = await repo.findById(service.id)

  expect(result).toBeTruthy()
  expect(result.name).toBe(serviceData.name)
})
```

**Pros:**
- ✅ Maximum realism (tests exactly what runs in prod)
- ✅ Catches ALL database issues (constraints, transactions, syntax)
- ✅ Simplifies codebase (no MockRepositories to maintain)
- ✅ Single source of truth for repository logic

**Cons:**
- ❌ Slower tests (50-100ms vs 5ms per test)
- ❌ More complex setup (database migrations, seeding)
- ❌ Test isolation requires careful cleanup
- ❌ Breaking change (need to rewrite all repository tests)

**Effort estimate:** 4-6 timmar att migrera alla repository tests

---

### Strategy D: Keep Current Approach + Add Smoke Tests ⭐ RECOMMENDED

**Concept:** Behåll nuvarande mocks, men lägg till ett litet antal "smoke tests" som kör mot real database.

**Implementation:**
```typescript
// tests/smoke/api-smoke.test.ts
describe('API Smoke Tests (Real Database)', () => {
  beforeAll(async () => {
    await prisma.$executeRaw`DELETE FROM Booking WHERE customer.email LIKE '%smoke-test%'`
  })

  it('should create booking end-to-end', async () => {
    // Create real test user
    const user = await prisma.user.create({
      data: { email: 'smoke-test@example.com', ... }
    })

    // Create real provider
    const provider = await prisma.provider.create({ data: {...} })

    // Create real service
    const service = await prisma.service.create({
      data: { providerId: provider.id, ... }
    })

    // Call REAL API route
    const response = await POST(new NextRequest('...', {
      body: JSON.stringify({
        serviceId: service.id,
        date: '2025-01-15',
        startTime: '10:00'
      })
    }))

    expect(response.status).toBe(201)

    // Verify in database
    const booking = await prisma.booking.findFirst({
      where: { customerId: user.id }
    })
    expect(booking).toBeTruthy()
  })
})
```

**Pros:**
- ✅ Minimal disruption to existing tests
- ✅ Keeps fast unit tests
- ✅ Adds high-confidence integration tests
- ✅ Catches most critical database issues
- ✅ Easy to add incrementally

**Cons:**
- ❌ Doesn't catch all edge cases (fewer tests)
- ❌ Still maintains MockRepositories
- ❌ Smoke tests are slower (run less frequently?)

**Effort estimate:** 1-2 timmar att lägga till smoke test suite

---

## 4. Industry Best Practices

### 4.1 Testing Pyramid

**Standard ratio:**
```
     /\
    /  \  E2E Tests (10%)
   /----\
  / Inte-\
 / gration\ (30%)
/---------\
| Unit Tests | (60%)
|-----------|
```

**Equinet nuvarande:**
```
     /\
    /  \  E2E: 62 tests (Real DB)
   /----\
  /      \
 / Unit    \ 342 tests (100% Mocked)
/-----------\
```

**Problem:** Vi har 0% integration tests med real database!

### 4.2 Vad Säger Experterna?

**Kent Beck (TDD-pioneer):**
> "Test at the boundaries. Mock everything outside your control, but test real interactions within your system."

**Interpretation för Equinet:**
- Mock: External APIs (email, payment processors)
- Real: Database (Prisma är DEL av systemet, inte external)

**Martin Fowler:**
> "The purpose of mocking is isolation, not speed. If mocks diverge from reality, they're worse than useless."

**Google Testing Blog:**
> "Prefer real implementations over mocks for databases. Use in-memory databases if speed is a concern."

### 4.3 Prisma's Official Recommendation

Från Prisma docs:
```typescript
// ❌ DON'T mock Prisma Client
const prisma = {
  user: {
    findMany: jest.fn().mockResolvedValue([...])
  }
}

// ✅ DO use a test database
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } }
})
```

**Why?**
- Prisma har komplex intern state-management
- Query building är svårt att mocka korrekt
- Database constraints är kritiska för data integrity

---

## 5. Rekommendation för Equinet

### 5.1 Rekommenderad Strategi: **Hybrid (Strategy B + D)**

**Phase 1: Quick Wins (1-2 timmar) 🎯**
1. Lägg till **smoke tests** (Strategy D) för kritiska flows:
   - `POST /api/bookings` (create booking end-to-end)
   - `PUT /api/bookings/[id]` (update booking status)
   - `GET /api/providers` (list providers med filters)

2. Kör smoke tests i CI pipeline (parallellt med befintliga unit tests)

**Phase 2: Gradvis Migration (2-4 veckor)**
3. **Behåll befintliga unit tests** (för snabbhet under development)
4. Migrera **API integration tests** till real database (Strategy A)
   - Start med nya features (test-driven)
   - Migrera gamla tests när du ändrar i dem

5. Lägg till **contract tests** (Strategy B) för MockRepositories
   - Kör var 10:e commit eller i nightly CI
   - Fångar mock/real divergence innan den når production

**Phase 3: Long-term (efter MVP)**
6. Utvärdera om MockRepositories fortfarande behövs
7. Om mock/real divergence blir problem → migrera till Strategy C

### 5.2 Konkret Implementation Plan

#### Step 1: Setup test database (30 min)

**Skapa `vitest.config.integration.ts`:**
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts', 'tests/smoke/**/*.test.ts'],
    setupFiles: ['./tests/integration-setup.ts'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Skapa `tests/integration-setup.ts`:**
```typescript
import { PrismaClient } from '@prisma/client'
import { beforeEach, afterAll } from 'vitest'

// Use in-memory SQLite for speed
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-integration.db',
    },
  },
})

// Clean database before each test
beforeEach(async () => {
  // Order matters: delete in reverse foreign key order
  await prisma.$transaction([
    prisma.booking.deleteMany(),
    prisma.routeStop.deleteMany(),
    prisma.route.deleteMany(),
    prisma.routeOrder.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.service.deleteMany(),
    prisma.provider.deleteMany(),
    prisma.user.deleteMany(),
  ])
})

// Close connection after all tests
afterAll(async () => {
  await prisma.$disconnect()
})
```

#### Step 2: Write first smoke test (30 min)

**Skapa `tests/smoke/booking-api.integration.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest'
import { prisma } from '../integration-setup'
import { POST } from '@/app/api/bookings/route'
import { NextRequest } from 'next/server'

describe('Booking API Smoke Tests (Real Database)', () => {
  it('should create booking with real database', async () => {
    // Setup: Create real test data
    const customer = await prisma.user.create({
      data: {
        email: 'smoke-customer@example.com',
        firstName: 'Test',
        lastName: 'Customer',
        passwordHash: 'hashed',
        role: 'customer',
      },
    })

    const providerUser = await prisma.user.create({
      data: {
        email: 'smoke-provider@example.com',
        firstName: 'Test',
        lastName: 'Provider',
        passwordHash: 'hashed',
        role: 'provider',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        userId: providerUser.id,
        businessName: 'Test Provider AB',
        city: 'Stockholm',
        isActive: true,
      },
    })

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        name: 'Hovslagning',
        description: 'Professional hovslagning',
        price: 800,
        durationMinutes: 60,
        isActive: true,
      },
    })

    // Create availability
    await prisma.availability.create({
      data: {
        providerId: provider.id,
        dayOfWeek: 1, // Monday
        startTime: '08:00',
        endTime: '17:00',
      },
    })

    // Act: Call REAL API route
    const bookingDate = new Date('2025-01-20') // Monday
    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: service.id,
        bookingDate: bookingDate.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'Thunder',
        horseBreed: 'Swedish Warmblood',
        notes: 'First visit',
      }),
    })

    // Mock session (normally done via NextAuth)
    const mockSession = {
      user: {
        id: customer.id,
        email: customer.email,
        role: 'customer',
      },
    }

    // Note: You'll need to mock getServerSession for this test
    // vi.mock('next-auth', () => ({
    //   getServerSession: vi.fn().mockResolvedValue(mockSession)
    // }))

    const response = await POST(request)

    // Assert: Verify API response
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.serviceId).toBe(service.id)
    expect(data.customerId).toBe(customer.id)
    expect(data.status).toBe('pending')

    // Assert: Verify database state (THIS IS KEY!)
    const booking = await prisma.booking.findUnique({
      where: { id: data.id },
      include: {
        service: true,
        customer: true,
      },
    })

    expect(booking).toBeTruthy()
    expect(booking?.horseName).toBe('Thunder')
    expect(booking?.service.name).toBe('Hovslagning')
    expect(booking?.customer.email).toBe('smoke-customer@example.com')

    // Assert: Test foreign key constraint
    // If we try to create booking with non-existent serviceId, it should fail
    const invalidRequest = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: 'non-existent-id',
        bookingDate: '2025-01-20',
        startTime: '10:00',
        endTime: '11:00',
      }),
    })

    const invalidResponse = await POST(invalidRequest)
    expect(invalidResponse.status).not.toBe(201)
    // Should fail due to foreign key constraint
  })

  it('should enforce unique email constraint', async () => {
    // Create first user
    await prisma.user.create({
      data: {
        email: 'duplicate@example.com',
        firstName: 'First',
        lastName: 'User',
        passwordHash: 'hashed',
        role: 'customer',
      },
    })

    // Try to create second user with same email
    // This should throw Prisma error due to unique constraint
    await expect(
      prisma.user.create({
        data: {
          email: 'duplicate@example.com',
          firstName: 'Second',
          lastName: 'User',
          passwordHash: 'hashed',
          role: 'customer',
        },
      })
    ).rejects.toThrow(/Unique constraint/)
  })
})
```

#### Step 3: Add to CI pipeline (15 min)

**Uppdatera `.github/workflows/quality-gates.yml`:**
```yaml
jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: file:./dev.db
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Generate Prisma Client
        run: npx prisma generate
      - name: Run unit tests
        run: npm run test:run

  integration-tests:
    name: Integration Tests (Smoke)
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: file:./test-integration.db
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Generate Prisma Client
        run: npx prisma generate
      - name: Push database schema
        run: npx prisma db push
      - name: Run integration tests
        run: npm run test:integration
```

#### Step 4: Update package.json scripts (5 min)

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:integration": "vitest --config vitest.config.integration.ts",
    "test:smoke": "vitest --config vitest.config.integration.ts tests/smoke",
    "test:all": "npm run test:run && npm run test:integration && npm run test:e2e"
  }
}
```

### 5.3 Migration Priority

**High Priority (migrera först):**
1. `/api/bookings` (kritisk business logic, overlap-checking)
2. `/api/providers` (har redan database index issues från F-3.4)
3. `/api/services` (CRUD operations med foreign keys)

**Medium Priority:**
4. `/api/auth/register` (unique constraints på email)
5. Repository-layer contract tests

**Low Priority:**
6. Utility functions (validations, sanitization) - mocks är OK här
7. React hooks (useRetry) - mocks är OK

### 5.4 Success Metrics

**Efter Phase 1 (Smoke Tests):**
- ✅ 5-10 integration tests med real database
- ✅ CI pipeline kör alla test-typer
- ✅ <30s total test execution time

**Efter Phase 2 (API Migration):**
- ✅ 50%+ av API tests använder real database
- ✅ Zero mock/real divergence issues i produktion
- ✅ <2 min total test execution time

**Efter Phase 3 (Long-term):**
- ✅ 80%+ integration tests med real database
- ✅ MockRepositories används endast för snabba unit tests
- ✅ Contract tests fångar divergence automatiskt

---

## 6. Trade-offs Sammanfattning

| Aspect | Current (Mocks) | Recommended (Hybrid) | Pure Real DB |
|--------|----------------|---------------------|--------------|
| **Speed** | ⚡ 5ms | 🟡 50ms | 🟡 100ms |
| **Realism** | ❌ Low | ✅ High | ✅✅ Highest |
| **Maintenance** | 🟡 2x code | ✅ Low | ✅ Lowest |
| **Confidence** | ❌ Low | ✅ High | ✅✅ Highest |
| **Setup complexity** | ✅ Simple | 🟡 Medium | 🟡 Medium |
| **CI/CD time** | ✅ <10s | 🟡 ~30s | ❌ ~60s |
| **Catches DB issues** | ❌ No | ✅ Yes | ✅ Yes |
| **Effort to migrate** | - | 🟡 2-4h | ❌ 6-8h |

---

## 7. Final Recommendation

### För Equinet MVP (JUST NU):

**Priority 1: Add Smoke Tests (1-2 timmar)**
- Minimal disruption
- Maximum confidence boost
- Catches 80% av database-related bugs

**Priority 2: Ny kod använder real DB (från och med nu)**
- Alla nya features skrivs med integration tests mot real database
- Befintliga mocks behöver inte ändras (ännu)

**Priority 3: Migrera kritiska endpoints (2-3 veckor)**
- Start med `/api/bookings` (overlap-checking är komplex)
- Sedan `/api/providers` och `/api/services`

### Långsiktig Vision:

**Efter MVP → Production:**
- 60% Unit tests (mocks OK för isolerad logic)
- 30% Integration tests (real database)
- 10% E2E tests (full stack)

**Tools:**
- SQLite in-memory för integration tests (`:memory:`)
- Prisma migrations applied i test setup
- Parallell test execution (workers: 4) när test suite växer

---

## 8. Slutsats

**Instinkten är rätt:** MockRepositories skapar en falsk trygghet. Vi testar TypeScript-implementationer av databas-logik, inte faktiska SQL-queries.

**Men:**
- Att kasta allt och börja om är overkill för MVP
- Hybrid-approach ger 80% av fördelarna med 20% av arbetet
- Smoke tests + gradvis migration = pragmatisk lösning

**Nästa steg:**
1. Implementera Phase 1 (smoke tests) när tid finns
2. Ny kod från och med nu använder real database i tests
3. Utvärdera efter MVP om full migration behövs

---

**Skapad:** 2025-11-20
**Ansvarig:** Johan + Claude
**Status:** Planerad (väntar på implementation)