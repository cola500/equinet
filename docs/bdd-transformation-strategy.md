# BDD Transformation Strategy - Equinet Test Suite

**Skapad av**: test-lead agent
**Datum**: 2025-11-18
**Status**: Draft för review

---

## Executive Summary

Denna strategi beskriver transformationen från TDD (Technical Test-Driven Development) till BDD (Behavior-Driven Development) för Equinet-projektet. Målet är att skapa tester som speglar affärsscenarier med ubiquitous language, samtidigt som vi uppnår 100% API-coverage och ≥80% overall coverage.

### Nuläge
- **12 unit/integration tests** (AAA-pattern, tekniskt språk)
- **7 E2E tests** (Playwright, bra coverage)
- **11 untested API routes** (45% av API:t saknar tester)
- **Coverage**: ~50% (uppskattning baserat på testade routes)

### Målbild
- **100% API route coverage** (19/19 routes testade)
- **≥80% overall coverage** (enligt NFR.md)
- **BDD-struktur** (Given-When-Then med business language)
- **Feature-baserad testorganisation**
- **Reusable test fixtures** för business scenarios

---

## 1. BDD Test Framework

### 1.1 Given-When-Then Structure

Vi använder **Vitest** (ingen Cucumber) med BDD-struktur. Varför?
- ✅ Lägre komplexitet - Cucumber tillför overhead för Equinet-storleken
- ✅ TypeScript-native - bättre typ-säkerhet
- ✅ Snabbare exekvering - ingen Gherkin-parsing
- ✅ Befintlig Vitest-setup - ingen migration

**BDD-template för API routes:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { testScenario, given, when, then } from '@/tests/bdd-helpers'
import { authenticatedCustomer, authenticatedProvider } from '@/tests/fixtures/users'
import { pendingBooking, confirmedBooking } from '@/tests/fixtures/bookings'

describe('Feature: Customer views their bookings', () => {

  describe('Scenario: Authenticated customer retrieves booking list', () => {
    it('should return all customer bookings sorted by date', async () => {
      // Given an authenticated customer with multiple bookings
      const { session, userId } = given.authenticatedCustomer()
      given.existingBookings([
        pendingBooking({ customerId: userId, date: '2025-11-20' }),
        confirmedBooking({ customerId: userId, date: '2025-11-25' })
      ])

      // When the customer requests their bookings
      const response = when.customerFetchesBookings(session)

      // Then they should see all their bookings in descending order
      await then.expectSuccess(response, {
        status: 200,
        bookingCount: 2,
        firstBookingDate: '2025-11-25' // Nyaste först
      })
    })
  })

  describe('Scenario: Unauthenticated user attempts to view bookings', () => {
    it('should deny access with 401 Unauthorized', async () => {
      // Given an unauthenticated user
      const { session } = given.unauthenticatedUser()

      // When they attempt to fetch bookings
      const response = when.customerFetchesBookings(session)

      // Then access should be denied
      await then.expectUnauthorized(response, {
        errorMessage: 'Unauthorized'
      })
    })
  })

  describe('Scenario: Provider views bookings for their services', () => {
    it('should return only bookings for provider services', async () => {
      // Given an authenticated provider with bookings
      const { session, providerId } = given.authenticatedProvider()
      given.existingBookings([
        confirmedBooking({ providerId }),
        confirmedBooking({ providerId: 'other-provider' }) // Should NOT see
      ])

      // When the provider requests their bookings
      const response = when.providerFetchesBookings(session)

      // Then they should see only their bookings
      await then.expectSuccess(response, {
        status: 200,
        bookingCount: 1,
        allBelongToProvider: providerId
      })
    })
  })
})
```

**Jämförelse: TDD vs BDD**

| Aspekt | TDD (Nuvarande) | BDD (Målbild) |
|--------|----------------|---------------|
| Test name | `should return bookings for authenticated customer` | `Authenticated customer retrieves booking list` |
| Structure | Arrange-Act-Assert | Given-When-Then |
| Language | Technical (`mockSession`, `prisma.booking.findMany`) | Business (`authenticated customer`, `existing bookings`) |
| Focus | Implementation | Behavior |
| Reusability | Low (inline mocks) | High (fixtures & helpers) |

---

### 1.2 Test Fixtures & Builders

**Fixtures representerar business entities:**

```typescript
// tests/fixtures/users.ts
import { vi } from 'vitest'

export const authenticatedCustomer = (overrides = {}) => ({
  session: {
    user: {
      id: 'customer-123',
      userType: 'customer',
      email: 'customer@example.com',
      ...overrides
    }
  },
  userId: overrides.id || 'customer-123',
  setupMocks: () => {
    vi.mocked(getServerSession).mockResolvedValue(this.session as any)
  }
})

export const authenticatedProvider = (overrides = {}) => ({
  session: {
    user: {
      id: 'provider-user-123',
      userType: 'provider',
      providerId: 'provider-123',
      ...overrides
    }
  },
  providerId: overrides.providerId || 'provider-123',
  setupMocks: () => {
    vi.mocked(getServerSession).mockResolvedValue(this.session as any)
  }
})

export const unauthenticatedUser = () => ({
  session: null,
  setupMocks: () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
  }
})
```

```typescript
// tests/fixtures/bookings.ts
export const pendingBooking = (overrides = {}) => ({
  id: 'booking-123',
  customerId: 'customer-123',
  providerId: 'provider-123',
  serviceId: 'service-123',
  bookingDate: new Date('2025-11-20'),
  startTime: '10:00',
  endTime: '11:00',
  status: 'pending',
  horseName: 'Thunder',
  ...overrides,
  // Include relations
  provider: {
    id: overrides.providerId || 'provider-123',
    businessName: 'Test Hovslagare',
    user: { firstName: 'John', lastName: 'Doe' }
  },
  service: {
    id: overrides.serviceId || 'service-123',
    name: 'Hovslagning',
    price: 800
  }
})

export const confirmedBooking = (overrides = {}) =>
  pendingBooking({ ...overrides, status: 'confirmed' })

export const pastBooking = (overrides = {}) =>
  pendingBooking({
    ...overrides,
    bookingDate: new Date('2025-10-01'),
    status: 'completed'
  })
```

---

### 1.3 BDD Test Helpers

**Helper functions för Given-When-Then:**

```typescript
// tests/bdd-helpers/given.ts
import { vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import * as fixtures from '@/tests/fixtures'

export const given = {
  authenticatedCustomer: (overrides = {}) => {
    const user = fixtures.authenticatedCustomer(overrides)
    user.setupMocks()
    return user
  },

  authenticatedProvider: (overrides = {}) => {
    const user = fixtures.authenticatedProvider(overrides)
    user.setupMocks()
    return user
  },

  unauthenticatedUser: () => {
    const user = fixtures.unauthenticatedUser()
    user.setupMocks()
    return user
  },

  existingBookings: (bookings: any[]) => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue(bookings as any)
  },

  existingProvider: (provider: any) => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(provider as any)
  },

  noExistingProvider: () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)
  },

  serviceExists: (service: any) => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(service as any)
  },

  serviceDoesNotExist: () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)
  }
}
```

```typescript
// tests/bdd-helpers/when.ts
import { NextRequest } from 'next/server'
import { GET, POST, PUT, DELETE } from '@/app/api/[route]/route'

export const when = {
  customerFetchesBookings: async (session: any) => {
    const request = new NextRequest('http://localhost:3000/api/bookings')
    return await GET(request)
  },

  customerCreatesBooking: async (session: any, bookingData: any) => {
    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    })
    return await POST(request)
  },

  customerUpdatesProfile: async (session: any, profileData: any) => {
    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    })
    return await PUT(request)
  },

  providerCreatesRoute: async (session: any, routeData: any) => {
    const request = new NextRequest('http://localhost:3000/api/routes', {
      method: 'POST',
      body: JSON.stringify(routeData)
    })
    return await POST(request)
  }
}
```

```typescript
// tests/bdd-helpers/then.ts
import { expect } from 'vitest'

export const then = {
  expectSuccess: async (response: Response, assertions: {
    status: number
    bookingCount?: number
    firstBookingDate?: string
    allBelongToProvider?: string
  }) => {
    expect(response.status).toBe(assertions.status)
    const data = await response.json()

    if (assertions.bookingCount !== undefined) {
      expect(data).toHaveLength(assertions.bookingCount)
    }

    if (assertions.firstBookingDate) {
      expect(data[0].bookingDate).toContain(assertions.firstBookingDate)
    }

    if (assertions.allBelongToProvider) {
      expect(data.every((b: any) => b.providerId === assertions.allBelongToProvider)).toBe(true)
    }

    return data
  },

  expectUnauthorized: async (response: Response, assertions: {
    errorMessage: string
  }) => {
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe(assertions.errorMessage)
  },

  expectValidationError: async (response: Response, assertions: {
    errorMessage?: string
    missingFields?: string[]
  }) => {
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Validation')

    if (assertions.missingFields) {
      assertions.missingFields.forEach(field => {
        expect(JSON.stringify(data.details)).toContain(field)
      })
    }
  },

  expectCreated: async (response: Response, assertions: {
    id?: string
    status?: string
  }) => {
    expect(response.status).toBe(201)
    const data = await response.json()

    if (assertions.id) {
      expect(data.id).toBe(assertions.id)
    }

    if (assertions.status) {
      expect(data.status).toBe(assertions.status)
    }

    return data
  }
}
```

---

### 1.4 Test Organization

**Feature-baserad struktur:**

```
tests/
├── setup.ts                        # Vitest setup
├── bdd-helpers/
│   ├── index.ts                    # Export all helpers
│   ├── given.ts                    # Setup helpers
│   ├── when.ts                     # Action helpers
│   └── then.ts                     # Assertion helpers
├── fixtures/
│   ├── index.ts
│   ├── users.ts                    # User fixtures (customer, provider)
│   ├── bookings.ts                 # Booking fixtures
│   ├── services.ts                 # Service fixtures
│   ├── routes.ts                   # Route fixtures
│   └── route-orders.ts             # Route order fixtures
└── features/
    ├── bookings/
    │   ├── customer-views-bookings.test.ts
    │   ├── customer-creates-booking.test.ts
    │   ├── provider-views-bookings.test.ts
    │   └── provider-updates-booking-status.test.ts
    ├── profile/
    │   ├── customer-updates-profile.test.ts
    │   └── provider-updates-profile.test.ts
    ├── routes/
    │   ├── provider-creates-route.test.ts
    │   ├── provider-views-routes.test.ts
    │   └── provider-updates-route.test.ts
    └── route-orders/
        ├── customer-creates-route-order.test.ts
        ├── provider-views-available-orders.test.ts
        └── provider-accepts-route-order.test.ts
```

**Befintliga tests flyttas:**

```
src/app/api/bookings/route.test.ts → tests/features/bookings/customer-views-bookings.test.ts
src/lib/utils/booking.test.ts → tests/utils/booking-calculations.test.ts (behåller TDD-stil för utilities)
```

---

## 2. Test Coverage Plan

### 2.1 Untested API Routes (11 routes)

**Prioritet baserad på:**
1. **Business criticality** (betalning, bokningar = kritiskt)
2. **User impact** (hur ofta används)
3. **Security sensitivity** (auth, personal data)
4. **Complexity** (komplex logik = högre risk)

| Prio | Route | HTTP Methods | Criticality | Estimat | Epic |
|------|-------|--------------|-------------|---------|------|
| **P0** | `/api/profile` | GET, PUT | HIGH (PII) | 2h | User Management |
| **P0** | `/api/provider/profile` | GET, PUT | HIGH (business data) | 2h | Provider Management |
| **P1** | `/api/providers/[id]/availability` | GET | MEDIUM (booking flow) | 1.5h | Booking Flow |
| **P1** | `/api/routes` | POST | HIGH (complex logic) | 3h | Route Planning |
| **P1** | `/api/routes/[id]` | GET, PUT, DELETE | MEDIUM | 2h | Route Planning |
| **P2** | `/api/route-orders` | POST | MEDIUM | 2h | Route Orders |
| **P2** | `/api/route-orders/available` | GET | MEDIUM | 1h | Route Orders |
| **P2** | `/api/route-orders/my-orders` | GET | MEDIUM | 1h | Route Orders |
| **P3** | `/api/routes/my-routes` | GET | LOW (list) | 1h | Route Planning |
| **P3** | `/api/routes/[id]/stops/[stopId]` | PUT | LOW | 1.5h | Route Planning |

**Total estimat: 18h** (2.5 arbetsdagar för 1 utvecklare)

---

### 2.2 Epic-Based Test Plan

#### Epic 1: User Management (4h)
**Business value**: Användare kan hantera sina profiler

**Features to test:**
- Customer updates profile (name, phone)
- Provider updates profile (business info, city)
- Profile validation (required fields)
- Authorization (can only update own profile)

**Test coverage:**
```
POST /api/profile
  ✓ GET: Authenticated customer retrieves their profile
  ✓ GET: Unauthenticated user is denied access
  ✓ PUT: Customer updates name and phone successfully
  ✓ PUT: Validation error for missing required fields
  ✓ PUT: Invalid JSON returns 400 error

POST /api/provider/profile
  ✓ GET: Authenticated provider retrieves business profile
  ✓ PUT: Provider updates business name and description
  ✓ PUT: Provider cannot access if not provider userType
```

**Acceptance criteria:**
- [ ] 100% coverage of both routes
- [ ] All error paths tested (401, 400, 500)
- [ ] BDD structure with Given-When-Then
- [ ] Reusable fixtures for user profiles

---

#### Epic 2: Route Planning (9.5h)
**Business value**: Providers kan planera rutter för effektiv hovslagning

**Features to test:**
- Provider creates route from multiple orders
- Distance calculation and duration estimation
- Route stop creation with time estimates
- Route status management (planned, in_progress, completed)
- Route updates and cancellations

**Test coverage:**
```
POST /api/routes
  ✓ Provider creates route with valid orders
  ✓ Total distance and duration calculated correctly
  ✓ Route stops created in correct order
  ✓ Order status updated to 'in_route'
  ✓ Validation error for empty order list
  ✓ Error when orders are not available (already in route)
  ✓ Unauthorized when not provider

GET /api/routes/[id]
  ✓ Provider retrieves route details with stops
  ✓ Authorization check (only route owner)
  ✓ 404 when route not found

PUT /api/routes/[id]
  ✓ Provider updates route name and start time
  ✓ Cannot update completed route
  ✓ Recalculates times when start time changes

DELETE /api/routes/[id]
  ✓ Provider cancels route (status = cancelled)
  ✓ Orders return to 'pending' status
  ✓ Cannot delete in_progress route

GET /api/routes/my-routes
  ✓ Provider sees all their routes
  ✓ Routes sorted by date descending
  ✓ Empty list when no routes

PUT /api/routes/[id]/stops/[stopId]
  ✓ Provider marks stop as completed
  ✓ Actual arrival time recorded
  ✓ Status validation (can only complete pending stops)
```

**Acceptance criteria:**
- [ ] 100% coverage of all route endpoints
- [ ] Transaction rollback tested (route creation failure)
- [ ] Distance calculation edge cases (same location, very far)
- [ ] Time calculation edge cases (overnight routes)

---

#### Epic 3: Route Orders (6h)
**Business value**: Kunder kan beställa rutthovslagning

**Features to test:**
- Customer creates route order with location
- Provider views available orders in their area
- Provider views their accepted orders
- Order status transitions

**Test coverage:**
```
POST /api/route-orders
  ✓ Customer creates route order with valid data
  ✓ Location coordinates validated
  ✓ Date must be in future
  ✓ Validation error for missing fields

GET /api/route-orders/available
  ✓ Provider sees only pending orders
  ✓ Orders filtered by geographic proximity (optional)
  ✓ Empty list when no available orders

GET /api/route-orders/my-orders
  ✓ Customer sees their own orders
  ✓ Provider sees orders in their routes
  ✓ Orders sorted by date
```

**Acceptance criteria:**
- [ ] 100% coverage of route-order endpoints
- [ ] Geographic filtering tested (if implemented)
- [ ] Status transitions validated

---

#### Epic 4: Booking Flow Enhancement (1.5h)
**Business value**: Kunder kan se provider-tillgänglighet

**Features to test:**
- Customer checks provider availability
- Blocked dates returned
- Time slots calculated

**Test coverage:**
```
GET /api/providers/[id]/availability
  ✓ Returns availability for valid provider
  ✓ Blocked dates from existing bookings
  ✓ Blocked dates from provider schedule
  ✓ 404 when provider not found
```

---

### 2.3 Refactoring Strategy for Existing Tests

**Approach: Gradual migration (hybrid TDD/BDD)**

**Phase 1: Infrastructure (Sprint 1, Week 1)**
- [ ] Create `tests/` directory structure
- [ ] Implement BDD helpers (given, when, then)
- [ ] Create base fixtures (users, bookings, services)
- [ ] Update vitest.config.ts to include `tests/` directory
- [ ] Document BDD patterns in CLAUDE.md

**Phase 2: Pilot refactoring (Sprint 1, Week 1-2)**
- [ ] Refactor 1 existing test file to BDD as proof-of-concept
  - **Recommended**: `src/app/api/bookings/route.test.ts` → `tests/features/bookings/`
- [ ] Measure metrics (readability, maintainability)
- [ ] Gather team feedback
- [ ] Adjust templates based on learnings

**Phase 3: New tests in BDD (Sprint 1-2)**
- [ ] Write all NEW tests (11 untested routes) in BDD format
- [ ] This validates BDD approach at scale
- [ ] Build up fixture library organically

**Phase 4: Systematic refactoring (Sprint 2-3)**
- [ ] Refactor remaining API route tests to BDD
- [ ] Keep utility tests in TDD format (booking.test.ts, sanitize.test.ts)
  - **Rationale**: Pure functions don't benefit from business language
- [ ] Update E2E tests to use BDD naming (already close to BDD)

**Decision: Rewrite or adapt?**
- **API route tests**: REWRITE to BDD (better clarity, forces rethinking)
- **Utility tests**: KEEP TDD (appropriate for technical functions)
- **E2E tests**: ADAPT (rename scenarios, already behavior-focused)

---

## 3. Quality Gates

### 3.1 Coverage Thresholds

**Vitest coverage config:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Global thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },

      // Per-file thresholds (stricter for critical paths)
      perFile: true,

      // Enforce thresholds on specific directories
      include: [
        'src/app/api/**/*.ts',
        'src/lib/**/*.ts',
      ],

      exclude: [
        'node_modules/',
        'tests/',
        'e2e/',
        '**/*.config.{ts,js}',
        '**/types.ts',
        '.next/',
        'src/app/**/layout.tsx',  // Exclude Next.js layouts
        'src/app/**/page.tsx',    // UI pages tested via E2E
      ],

      // Per-directory thresholds
      watermarks: {
        statements: [70, 80],
        functions: [70, 80],
        branches: [70, 80],
        lines: [70, 80]
      }
    }
  }
})
```

**Directory-specific targets:**

| Directory | Lines | Branches | Functions | Rationale |
|-----------|-------|----------|-----------|-----------|
| `src/app/api/` | ≥80% | ≥75% | ≥80% | Critical business logic |
| `src/lib/utils/` | ≥90% | ≥85% | ≥90% | Pure functions, easy to test |
| `src/lib/` | ≥70% | ≥70% | ≥70% | General utilities |
| `src/hooks/` | ≥70% | ≥70% | ≥70% | React hooks |
| `src/components/` | ≥60% | ≥60% | ≥60% | UI tested via E2E |

---

### 3.2 Pre-Merge Checklist

**Automated checks (GitHub Actions):**

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:coverage
      - name: Check coverage thresholds
        run: npx vitest run --coverage --coverage.thresholds.autoUpdate=false
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma db push
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx tsc --noEmit
```

**Manual checklist (Developer):**

Before creating PR:
- [ ] All tests green (`npm run test:run && npm run test:e2e`)
- [ ] Coverage thresholds met (`npm run test:coverage`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] BDD structure followed (if new tests)
- [ ] Business scenarios documented in test names
- [ ] Fixtures reused (no inline mocks in BDD tests)

---

### 3.3 Regression Prevention

**Strategy:**
1. **Lock coverage baseline**: After reaching 80%, enforce it as minimum
2. **Coverage diff in PR**: Show coverage change vs main branch
3. **Required reviews**: Minimum 1 approval for test changes
4. **Test stability**: E2E tests must pass 3 consecutive runs before merge

**Tools:**
- **Codecov** (or similar): PR comments with coverage diff
- **Vitest watch mode**: Continuous feedback during development
- **Playwright trace**: Automatic on E2E failure

---

## 4. Team Enablement

### 4.1 Training Materials

**BDD Workshop (2h)**

**Agenda:**
1. **Why BDD?** (20 min)
   - TDD vs BDD comparison
   - Ubiquitous language benefits
   - Example: Before/after test refactoring

2. **Hands-on: Refactor a test** (40 min)
   - Take existing TDD test
   - Identify business scenario
   - Convert to Given-When-Then
   - Use fixtures and helpers

3. **Live coding: New feature** (40 min)
   - Write BDD test for `/api/profile` endpoint
   - Show TDD red-green-refactor cycle with BDD structure
   - Discuss edge cases

4. **Q&A + Guidelines** (20 min)
   - Review BDD checklist
   - Common anti-patterns
   - Resources and documentation

**Resources:**
- [ ] BDD Cheat Sheet (1-pager with examples)
- [ ] Video: "BDD vs TDD in Equinet" (10 min screencast)
- [ ] Example PRs: "Before/after" test refactorings
- [ ] CLAUDE.md updated with BDD section

---

### 4.2 BDD Test Writing Checklist

**Before writing a test:**
- [ ] Have I identified the **business scenario**? (e.g., "Customer books a service")
- [ ] Can I describe it in **Given-When-Then**?
- [ ] What is the **business value** being tested?

**While writing:**
- [ ] Test name uses **business language** (no technical terms like "mock", "stub")
- [ ] Given: Setup using **fixtures** (not inline object creation)
- [ ] When: Action uses **helper function** (not direct API call)
- [ ] Then: Assertions use **helper function** (not raw expect statements)
- [ ] Each scenario tests **one business behavior** (not multiple unrelated things)

**After writing:**
- [ ] Test reads like a **specification** (non-developer could understand)
- [ ] Fixtures are **reusable** (defined in `tests/fixtures/`)
- [ ] No **magic values** (use named constants or fixtures)
- [ ] Coverage for **happy path + critical error paths**

**Example:**

✅ **GOOD (BDD)**
```typescript
describe('Scenario: Customer books hovslagning service', () => {
  it('should create confirmed booking when provider auto-accepts', async () => {
    // Given an authenticated customer and an auto-accept provider
    const { session } = given.authenticatedCustomer()
    given.providerWithAutoAccept({ id: 'provider-123' })

    // When customer books the service
    const response = when.customerCreatesBooking(session, {
      providerId: 'provider-123',
      serviceId: 'hovslagning-service',
      date: '2025-11-20'
    })

    // Then booking should be confirmed immediately
    await then.expectCreated(response, { status: 'confirmed' })
  })
})
```

❌ **BAD (Technical TDD)**
```typescript
it('should create booking when POST /api/bookings with valid data', async () => {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: '123' }} as any)
  vi.mocked(prisma.provider.findUnique).mockResolvedValue({ autoAccept: true } as any)

  const request = new NextRequest('http://localhost:3000/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ providerId: '456', ... })
  })

  const response = await POST(request)
  expect(response.status).toBe(201)
})
```

---

### 4.3 Common Anti-Patterns

**Anti-pattern 1: Technical test names**
❌ `should return 200 when GET /api/bookings`
✅ `Authenticated customer retrieves their booking list`

**Anti-pattern 2: Inline mocks in BDD tests**
❌
```typescript
given.authenticatedCustomer()
vi.mocked(prisma.booking.findMany).mockResolvedValue([{ id: '1', ... }])
```
✅
```typescript
given.authenticatedCustomer()
given.existingBookings([confirmedBooking()])
```

**Anti-pattern 3: Testing implementation instead of behavior**
❌ `should call prisma.booking.create with correct parameters`
✅ `Customer creates booking successfully`

**Anti-pattern 4: Multiple unrelated assertions**
❌
```typescript
it('should handle bookings', async () => {
  // Tests both GET and POST in one test
})
```
✅
```typescript
describe('Scenario: Customer views bookings', () => { ... })
describe('Scenario: Customer creates booking', () => { ... })
```

**Anti-pattern 5: Magic values**
❌ `customerId: '123abc'`, `price: 800`
✅ Use fixtures: `confirmedBooking({ customerId: customer.id })`

---

## 5. Implementation Roadmap

### Sprint 1 (Week 1-2): Foundation + Quick Wins

**Epic: BDD Infrastructure**
- [ ] Setup `tests/` directory structure
- [ ] Implement BDD helpers (given, when, then)
- [ ] Create base fixtures (users, bookings)
- [ ] Update vitest.config.ts
- [ ] Write BDD Cheat Sheet
- [ ] Update CLAUDE.md with BDD patterns

**Epic: User Management (P0)**
- [ ] Test `/api/profile` (GET, PUT)
- [ ] Test `/api/provider/profile` (GET, PUT)
- [ ] Validate BDD approach with team

**Success criteria:**
- [ ] BDD infrastructure complete
- [ ] 2 new API routes at 100% coverage
- [ ] Team trained on BDD approach

---

### Sprint 2 (Week 3-4): Core Features

**Epic: Route Planning (P1)**
- [ ] Test `/api/routes` (POST)
- [ ] Test `/api/routes/[id]` (GET, PUT, DELETE)
- [ ] Test `/api/providers/[id]/availability` (GET)

**Epic: Refactor Existing Tests**
- [ ] Refactor `/api/bookings` tests to BDD
- [ ] Refactor `/api/auth/register` tests to BDD

**Success criteria:**
- [ ] 5 more routes at 100% coverage
- [ ] 2 legacy tests refactored to BDD
- [ ] Overall coverage ≥65%

---

### Sprint 3 (Week 5-6): Complete Coverage

**Epic: Route Orders (P2-P3)**
- [ ] Test `/api/route-orders` (POST)
- [ ] Test `/api/route-orders/available` (GET)
- [ ] Test `/api/route-orders/my-orders` (GET)
- [ ] Test `/api/routes/my-routes` (GET)
- [ ] Test `/api/routes/[id]/stops/[stopId]` (PUT)

**Epic: Final Refactoring**
- [ ] Refactor all remaining API route tests to BDD
- [ ] Update E2E test naming to BDD style

**Success criteria:**
- [ ] 100% API route coverage
- [ ] ≥80% overall coverage
- [ ] All tests in BDD format (except utilities)
- [ ] CI/CD enforces coverage thresholds

---

### Sprint 4 (Week 7): Consolidation

**Epic: Documentation & Quality**
- [ ] Complete BDD documentation in CLAUDE.md
- [ ] Record BDD training video
- [ ] Create example PR showcasing BDD refactoring
- [ ] Setup Codecov integration
- [ ] Review and optimize test performance

**Success criteria:**
- [ ] Complete documentation
- [ ] Training materials available
- [ ] CI/CD stable and fast
- [ ] Team confident in BDD approach

---

## 6. Success Metrics

### Quantitative Metrics

| Metric | Baseline | Target | Tracking |
|--------|----------|--------|----------|
| API route coverage | 42% (8/19) | 100% (19/19) | Weekly |
| Overall coverage | ~50% | ≥80% | Weekly |
| Test execution time | ~2s | <5s | Per PR |
| E2E pass rate | 100% | 100% | Per PR |
| Flaky test count | 0 | 0 | Weekly |

### Qualitative Metrics

- **Readability**: Non-developers can understand test scenarios (validated via review)
- **Maintainability**: Changing business logic requires updating 1 test, not 5 (measured via refactoring PRs)
- **Confidence**: Developers feel safe refactoring (survey after 4 weeks)
- **Onboarding**: New developers can write BDD tests within 1 day (measured via training)

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Team resistance to BDD | HIGH | MEDIUM | Pilot with 1 feature, gather feedback, iterate |
| BDD helpers become complex | MEDIUM | MEDIUM | Keep helpers simple, review in PRs, refactor when needed |
| Test execution slows down | MEDIUM | LOW | Monitor test time, optimize fixtures, use parallel execution |
| Coverage targets too ambitious | HIGH | LOW | Start with 70%, increase to 80% gradually |
| Vitest limitations for BDD | LOW | LOW | Vitest is flexible, no Gherkin needed |

---

## 8. Open Questions

1. **Cucumber vs Vitest**: Do we want executable specifications (Gherkin)?
   - **Recommendation**: NO. Vitest + BDD helpers sufficient for Equinet size.

2. **Component testing**: Should UI components use BDD?
   - **Recommendation**: NO. E2E tests cover user scenarios. Unit tests for component logic can stay TDD.

3. **Test data management**: Do we need a test database or continue mocking?
   - **Recommendation**: Continue mocking for speed. Consider test DB for integration tests in Sprint 3+.

4. **Shared fixtures**: Should fixtures live in separate package?
   - **Recommendation**: NO. Keep in `tests/fixtures/` for now. Extract if reused across projects.

5. **Coverage for deprecated features**: Test legacy code before removal?
   - **Recommendation**: NO. Only test if still in production. Document deprecation timeline.

---

## 9. Next Steps

**Immediate actions (This week):**
1. [ ] Review this strategy with team
2. [ ] Approve BDD approach (or request changes)
3. [ ] Create Epic: "BDD Transformation" in project tracker
4. [ ] Assign Sprint 1 tasks
5. [ ] Schedule BDD training workshop

**Contact:**
- **Questions**: Ask test-lead agent
- **Code reviews**: Tag @test-lead in PR comments
- **Training**: Schedule via calendar

---

## Appendix

### A. BDD Resources

- [BDD in Action (book)](https://www.manning.com/books/bdd-in-action)
- [Vitest API](https://vitest.dev/)
- [Given-When-Then (Martin Fowler)](https://martinfowler.com/bliki/GivenWhenThen.html)
- [Ubiquitous Language (DDD)](https://martinfowler.com/bliki/UbiquitousLanguage.html)

### B. Example Fixtures Library

See `/tests/fixtures/` for complete library. Key fixtures:

**Users:**
- `authenticatedCustomer()`
- `authenticatedProvider()`
- `adminUser()`
- `unauthenticatedUser()`

**Bookings:**
- `pendingBooking()`
- `confirmedBooking()`
- `completedBooking()`
- `cancelledBooking()`
- `pastBooking()`

**Services:**
- `hovslagningService()`
- `customService(overrides)`

**Routes:**
- `plannedRoute()`
- `inProgressRoute()`
- `completedRoute()`

**Route Orders:**
- `pendingRouteOrder()`
- `acceptedRouteOrder()`

### C. Test File Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { given, when, then } from '@/tests/bdd-helpers'

// Mock dependencies
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { /* ... */ } }))

describe('Feature: [Business Feature Name]', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Scenario: [Happy Path Business Scenario]', () => {
    it('should [expected business outcome]', async () => {
      // Given [business context]
      const { session } = given.authenticatedCustomer()
      given.existingBookings([...])

      // When [business action]
      const response = when.customerFetchesBookings(session)

      // Then [business expectation]
      await then.expectSuccess(response, { ... })
    })
  })

  describe('Scenario: [Error Scenario]', () => {
    it('should [expected error handling]', async () => {
      // Given [error context]
      // When [error trigger]
      // Then [error expectation]
    })
  })
})
```

---

**Document version**: 1.0
**Last updated**: 2025-11-18
**Next review**: After Sprint 1 completion
