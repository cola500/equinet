# BDD Quick Reference - Equinet

**För fullständig strategi, se**: `docs/bdd-transformation-strategy.md`

---

## TL;DR

- **BDD = Business language** i tester (Given-When-Then)
- **TDD = Technical language** (Arrange-Act-Assert)
- **Vi använder**: Vitest + BDD helpers (INGEN Cucumber)
- **Målet**: 100% API coverage, ≥80% overall

---

## BDD Test Template

```typescript
describe('Feature: [Business Feature]', () => {

  describe('Scenario: [Business Scenario]', () => {
    it('should [business outcome]', async () => {
      // Given [business context]
      const { session } = given.authenticatedCustomer()
      given.existingBookings([pendingBooking()])

      // When [business action]
      const response = when.customerFetchesBookings(session)

      // Then [business expectation]
      await then.expectSuccess(response, {
        status: 200,
        bookingCount: 1
      })
    })
  })
})
```

---

## BDD Checklist

**Before writing:**
- [ ] What is the **business scenario**? (e.g., "Customer views bookings")
- [ ] Can I describe it in **Given-When-Then**?

**While writing:**
- [ ] Test name uses **business language** (no "mock", "POST /api/...")
- [ ] Given: Uses **fixtures** (`given.authenticatedCustomer()`)
- [ ] When: Uses **helper** (`when.customerFetchesBookings()`)
- [ ] Then: Uses **assertion helper** (`then.expectSuccess()`)

**After writing:**
- [ ] Non-developer can understand the test
- [ ] Fixtures are reusable
- [ ] Covers happy path + critical errors

---

## Good vs Bad Examples

### Test Names

✅ **GOOD**: `Authenticated customer retrieves their booking list`
❌ **BAD**: `should return 200 when GET /api/bookings`

### Test Structure

✅ **GOOD (BDD)**:
```typescript
const { session } = given.authenticatedCustomer()
given.existingBookings([confirmedBooking()])
const response = when.customerFetchesBookings(session)
await then.expectSuccess(response, { bookingCount: 1 })
```

❌ **BAD (Technical)**:
```typescript
vi.mocked(getServerSession).mockResolvedValue({ user: { id: '123' }})
vi.mocked(prisma.booking.findMany).mockResolvedValue([{ id: '1' }])
const request = new NextRequest('http://localhost:3000/api/bookings')
const response = await GET(request)
expect(response.status).toBe(200)
```

---

## Available Fixtures

### Users
- `given.authenticatedCustomer(overrides)`
- `given.authenticatedProvider(overrides)`
- `given.unauthenticatedUser()`

### Data
- `given.existingBookings([...])`
- `given.existingProvider(provider)`
- `given.serviceExists(service)`

### Builders
- `pendingBooking(overrides)` → Returns booking object
- `confirmedBooking(overrides)`
- `pastBooking(overrides)`

---

## Common Scenarios

### 1. Authenticated User Fetches Data

```typescript
describe('Scenario: Customer views their bookings', () => {
  it('should return all bookings sorted by date', async () => {
    // Given
    const { session, userId } = given.authenticatedCustomer()
    given.existingBookings([
      pendingBooking({ customerId: userId, date: '2025-11-25' }),
      confirmedBooking({ customerId: userId, date: '2025-11-20' })
    ])

    // When
    const response = when.customerFetchesBookings(session)

    // Then
    await then.expectSuccess(response, {
      status: 200,
      bookingCount: 2,
      firstBookingDate: '2025-11-25' // Newest first
    })
  })
})
```

### 2. Unauthenticated Access

```typescript
describe('Scenario: Unauthenticated user attempts access', () => {
  it('should deny access with 401', async () => {
    // Given
    const { session } = given.unauthenticatedUser()

    // When
    const response = when.customerFetchesBookings(session)

    // Then
    await then.expectUnauthorized(response, {
      errorMessage: 'Unauthorized'
    })
  })
})
```

### 3. Validation Error

```typescript
describe('Scenario: Customer submits invalid booking', () => {
  it('should return validation error for missing fields', async () => {
    // Given
    const { session } = given.authenticatedCustomer()

    // When
    const response = when.customerCreatesBooking(session, {
      providerId: 'provider-123',
      // Missing required fields: serviceId, date
    })

    // Then
    await then.expectValidationError(response, {
      missingFields: ['serviceId', 'bookingDate']
    })
  })
})
```

### 4. Authorization Check

```typescript
describe('Scenario: User attempts to access another user\'s data', () => {
  it('should deny access with 403', async () => {
    // Given
    const { session } = given.authenticatedCustomer({ id: 'customer-123' })
    given.existingBooking({ id: 'booking-1', customerId: 'other-customer' })

    // When
    const response = when.customerUpdatesBooking(session, 'booking-1', {
      status: 'cancelled'
    })

    // Then
    await then.expectForbidden(response, {
      errorMessage: 'Access denied'
    })
  })
})
```

---

## Anti-Patterns to Avoid

### 1. Testing Implementation

❌ **BAD**: `should call prisma.booking.create with correct parameters`
✅ **GOOD**: `should create booking successfully`

### 2. Multiple Behaviors in One Test

❌ **BAD**:
```typescript
it('should handle bookings', async () => {
  // Tests GET, POST, PUT all at once
})
```

✅ **GOOD**:
```typescript
describe('Scenario: Customer views bookings', () => { ... })
describe('Scenario: Customer creates booking', () => { ... })
describe('Scenario: Customer updates booking', () => { ... })
```

### 3. Inline Mocks

❌ **BAD**:
```typescript
vi.mocked(prisma.booking.findMany).mockResolvedValue([{
  id: '1',
  customerId: '123',
  status: 'pending',
  // ... 20 more fields
}])
```

✅ **GOOD**:
```typescript
given.existingBookings([pendingBooking()])
```

### 4. Magic Values

❌ **BAD**: `customerId: 'abc123'`, `price: 800`
✅ **GOOD**: Use fixtures with descriptive names

---

## When to Use TDD vs BDD

### Use BDD (Given-When-Then)
- ✅ API routes (business logic)
- ✅ Business scenarios with multiple actors
- ✅ Integration tests
- ✅ Anything with user-facing behavior

### Use TDD (Arrange-Act-Assert)
- ✅ Pure utility functions (`calculateDistance`, `formatDate`)
- ✅ Math/calculation functions
- ✅ Technical helpers (sanitization, validation)

**Example**:
```typescript
// TDD is fine for pure functions
describe('calculateBookingEndTime', () => {
  it('should calculate end time correctly for 60 minutes', () => {
    const startTime = '2025-11-15T10:00:00.000Z'
    const duration = 60
    const endTime = calculateBookingEndTime(startTime, duration)
    expect(endTime).toBe('2025-11-15T11:00:00.000Z')
  })
})
```

---

## File Structure

```
tests/
├── bdd-helpers/
│   ├── given.ts          # Setup helpers
│   ├── when.ts           # Action helpers
│   └── then.ts           # Assertion helpers
├── fixtures/
│   ├── users.ts          # User fixtures
│   ├── bookings.ts       # Booking fixtures
│   └── services.ts       # Service fixtures
└── features/
    ├── bookings/
    │   ├── customer-views-bookings.test.ts
    │   └── customer-creates-booking.test.ts
    └── profile/
        └── customer-updates-profile.test.ts
```

---

## Running Tests

```bash
# Watch mode (recommended during development)
npm test

# Run all tests once
npm run test:run

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e
```

---

## Need Help?

1. **Read**: `docs/bdd-transformation-strategy.md` (full strategy)
2. **Ask**: test-lead agent in PR comments
3. **Examples**: Look at existing BDD tests in `tests/features/`

---

**Version**: 1.0
**Last updated**: 2025-11-18
