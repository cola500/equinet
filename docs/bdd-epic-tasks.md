# BDD Transformation Epic - Task Breakdown

**Epic**: Transform Equinet test suite from TDD to BDD
**Goal**: 100% API coverage, ≥80% overall coverage, business-language tests
**Estimated effort**: 4 sprints (8 weeks)

---

## Sprint 1: Foundation + Quick Wins (Week 1-2)

### Epic 1.1: BDD Infrastructure Setup

**Story**: As a developer, I need BDD helpers and fixtures so I can write behavior-driven tests efficiently.

**Tasks**:
- [x] Create `tests/` directory structure
- [x] Implement `tests/bdd-helpers/given.ts` (setup helpers)
- [x] Implement `tests/bdd-helpers/when.ts` (action helpers)
- [x] Implement `tests/bdd-helpers/then.ts` (assertion helpers)
- [x] Create `tests/fixtures/bookings.ts` (booking fixtures)
- [x] Create `tests/fixtures/services.ts` (service fixtures)
- [x] Create `tests/fixtures/providers.ts` (provider fixtures)
- [ ] Update `vitest.config.ts` to include `tests/` directory
- [ ] Update `tsconfig.json` to include `tests/` in paths
- [ ] Write BDD Quick Reference guide
- [ ] Update CLAUDE.md with BDD section

**Acceptance Criteria**:
- [ ] All BDD helpers implemented and documented
- [ ] Base fixtures cover common scenarios (user types, booking statuses)
- [ ] Example test file demonstrates full BDD pattern
- [ ] Documentation complete and reviewed

**Estimat**: 8h

---

### Epic 1.2: User Profile Management (P0)

**Story**: As a user, I need to view and update my profile, and the system must validate my changes.

**API Routes to test**:
- `GET /api/profile` - Fetch current user profile
- `PUT /api/profile` - Update user profile

**BDD Scenarios**:

**Feature: Customer manages their profile**
- Scenario: Authenticated customer retrieves their profile
  - Should return profile with email, name, phone
- Scenario: Customer updates name and phone
  - Should update profile and return updated data
- Scenario: Customer submits invalid profile data
  - Should return validation error for missing required fields
- Scenario: Unauthenticated user attempts to access profile
  - Should deny access with 401 Unauthorized

**Feature: Provider manages their profile**
- Scenario: Authenticated provider retrieves their profile
  - Should return profile with user type 'provider'
- Scenario: Provider updates their information
  - Should update profile successfully

**Tasks**:
- [ ] Create `tests/features/profile/customer-manages-profile.test.ts`
- [ ] Implement scenario: Customer retrieves profile (GET)
- [ ] Implement scenario: Customer updates profile (PUT)
- [ ] Implement scenario: Validation errors (missing fields)
- [ ] Implement scenario: Unauthenticated access denied
- [ ] Implement scenario: Invalid JSON in request body
- [ ] Verify 100% coverage for `/api/profile`

**Acceptance Criteria**:
- [ ] All scenarios passing
- [ ] Coverage ≥100% for `/api/profile` route
- [ ] BDD structure followed (Given-When-Then)
- [ ] Fixtures reused (no inline mocks)

**Estimat**: 2h

---

### Epic 1.3: Provider Profile Management (P0)

**Story**: As a provider, I need to manage my business profile so customers can find me.

**API Routes to test**:
- `GET /api/provider/profile` - Fetch provider business profile
- `PUT /api/provider/profile` - Update provider business profile

**BDD Scenarios**:

**Feature: Provider manages business profile**
- Scenario: Provider retrieves business profile
  - Should return business name, description, city
- Scenario: Provider updates business information
  - Should update business name and description successfully
- Scenario: Customer attempts to access provider profile endpoint
  - Should deny access (only providers can access)
- Scenario: Unauthenticated user attempts access
  - Should deny access with 401 Unauthorized

**Tasks**:
- [ ] Create `tests/features/profile/provider-manages-business-profile.test.ts`
- [ ] Implement scenario: Provider retrieves business profile (GET)
- [ ] Implement scenario: Provider updates business info (PUT)
- [ ] Implement scenario: Authorization check (only providers)
- [ ] Implement scenario: Unauthenticated access denied
- [ ] Verify 100% coverage for `/api/provider/profile`

**Acceptance Criteria**:
- [ ] All scenarios passing
- [ ] Coverage ≥100% for `/api/provider/profile` route
- [ ] Authorization logic tested
- [ ] Business language used in test names

**Estimat**: 2h

---

### Sprint 1 Success Criteria

- [ ] BDD infrastructure complete and documented
- [ ] 2 new API routes at 100% coverage (profile, provider profile)
- [ ] Team trained on BDD approach (workshop conducted)
- [ ] Example tests reviewed and approved
- [ ] Overall coverage increased by ~10%

---

## Sprint 2: Core Features (Week 3-4)

### Epic 2.1: Provider Availability (P1)

**Story**: As a customer, I need to check provider availability so I can book at convenient times.

**API Routes to test**:
- `GET /api/providers/[id]/availability` - Fetch provider availability

**BDD Scenarios**:

**Feature: Customer checks provider availability**
- Scenario: Customer requests availability for active provider
  - Should return blocked dates from existing bookings
  - Should return blocked dates from provider schedule
- Scenario: Customer requests availability for non-existent provider
  - Should return 404 Not Found
- Scenario: Availability excludes past dates
  - Should only show future availability

**Tasks**:
- [ ] Create `tests/features/bookings/customer-checks-availability.test.ts`
- [ ] Create availability fixtures (`blockedDate`, `availableDate`)
- [ ] Implement scenario: Availability returned for valid provider
- [ ] Implement scenario: Blocked dates from bookings
- [ ] Implement scenario: Blocked dates from schedule
- [ ] Implement scenario: 404 for non-existent provider
- [ ] Verify 100% coverage for `/api/providers/[id]/availability`

**Acceptance Criteria**:
- [ ] All scenarios passing
- [ ] Coverage ≥100% for availability route
- [ ] Edge cases tested (past dates, no availability)

**Estimat**: 1.5h

---

### Epic 2.2: Route Planning (P1)

**Story**: As a provider, I need to create optimized routes from multiple orders so I can work efficiently.

**API Routes to test**:
- `POST /api/routes` - Create new route
- `GET /api/routes/[id]` - Fetch route details
- `PUT /api/routes/[id]` - Update route
- `DELETE /api/routes/[id]` - Cancel route

**BDD Scenarios**:

**Feature: Provider creates route**
- Scenario: Provider creates route with valid orders
  - Should create route with calculated distance and duration
  - Should create route stops in correct order
  - Should update order status to 'in_route'
- Scenario: Provider attempts to create route with unavailable orders
  - Should return 400 error
- Scenario: Provider attempts to create route with empty order list
  - Should return validation error
- Scenario: Unauthenticated user attempts to create route
  - Should deny access with 401

**Feature: Provider manages existing route**
- Scenario: Provider retrieves route details
  - Should return route with stops and order information
- Scenario: Provider updates route name and start time
  - Should update successfully
  - Should recalculate stop times when start time changes
- Scenario: Provider attempts to update another provider's route
  - Should deny access (authorization check)
- Scenario: Provider cancels route
  - Should set status to 'cancelled'
  - Should return orders to 'pending' status
- Scenario: Provider attempts to delete in-progress route
  - Should return error (cannot delete active route)

**Tasks**:
- [ ] Create route fixtures (`plannedRoute`, `inProgressRoute`, `completedRoute`)
- [ ] Create route-order fixtures (`pendingRouteOrder`, `inRouteOrder`)
- [ ] Create `tests/features/routes/provider-creates-route.test.ts`
- [ ] Implement all route creation scenarios
- [ ] Create `tests/features/routes/provider-manages-route.test.ts`
- [ ] Implement all route management scenarios
- [ ] Test transaction rollback (route creation failure)
- [ ] Test distance calculation edge cases
- [ ] Verify 100% coverage for all `/api/routes/*` endpoints

**Acceptance Criteria**:
- [ ] All scenarios passing
- [ ] Coverage ≥100% for all route endpoints
- [ ] Transaction logic tested (rollback on failure)
- [ ] Complex business logic verified (distance, time calculations)

**Estimat**: 5h

---

### Epic 2.3: Refactor Existing Bookings Tests

**Story**: As a developer, I want existing booking tests in BDD format so the codebase is consistent.

**Files to refactor**:
- `src/app/api/bookings/route.test.ts` → `tests/features/bookings/customer-manages-bookings.test.ts`
- `src/app/api/bookings/[id]/route.test.ts` → `tests/features/bookings/customer-updates-booking.test.ts`

**Tasks**:
- [ ] Refactor `GET /api/bookings` tests to BDD
  - Use `given.authenticatedCustomer()` instead of mock session
  - Use `given.existingBookings()` instead of prisma mock
  - Use `when.customerFetchesBookings()` instead of direct GET call
  - Use `then.expectSuccess()` instead of raw expect
- [ ] Refactor `POST /api/bookings` tests to BDD
  - Use business language in test names
  - Use fixtures for booking data
- [ ] Refactor `PUT /api/bookings/[id]` tests to BDD
- [ ] Refactor `DELETE /api/bookings/[id]` tests to BDD
- [ ] Delete old test files after verification
- [ ] Update imports in any dependent tests

**Acceptance Criteria**:
- [ ] All refactored tests passing
- [ ] Coverage maintained or improved
- [ ] BDD pattern consistently applied
- [ ] Old test files deleted

**Estimat**: 3h

---

### Sprint 2 Success Criteria

- [ ] 5 more API routes at 100% coverage (availability + 4 route endpoints)
- [ ] 2 legacy test files refactored to BDD
- [ ] Overall coverage ≥65%
- [ ] Complex business logic tested (route planning)
- [ ] Transaction rollback scenarios verified

---

## Sprint 3: Route Orders & Remaining Coverage (Week 5-6)

### Epic 3.1: Route Orders Management

**API Routes to test**:
- `POST /api/route-orders` - Create route order
- `GET /api/route-orders/available` - View available orders
- `GET /api/route-orders/my-orders` - View customer's own orders

**BDD Scenarios**:

**Feature: Customer creates route order**
- Scenario: Customer creates route order with valid data
  - Should create order with pending status
- Scenario: Customer submits invalid location coordinates
  - Should return validation error
- Scenario: Customer submits past date
  - Should return validation error

**Feature: Provider views available route orders**
- Scenario: Provider sees pending orders in their area
  - Should return only pending orders
- Scenario: No available orders exist
  - Should return empty array

**Feature: Customer views their route orders**
- Scenario: Customer sees their own orders
  - Should return all orders sorted by date
- Scenario: Customer has no orders
  - Should return empty array

**Tasks**:
- [ ] Create route-order fixtures
- [ ] Create `tests/features/route-orders/customer-creates-route-order.test.ts`
- [ ] Create `tests/features/route-orders/provider-views-available-orders.test.ts`
- [ ] Create `tests/features/route-orders/customer-views-orders.test.ts`
- [ ] Implement all route-order scenarios
- [ ] Test geographic filtering (if implemented)
- [ ] Verify 100% coverage for all route-order endpoints

**Acceptance Criteria**:
- [ ] All scenarios passing
- [ ] Coverage ≥100% for route-order endpoints
- [ ] Status transitions validated

**Estimat**: 4h

---

### Epic 3.2: Route Stops Management

**API Routes to test**:
- `GET /api/routes/my-routes` - Provider views their routes
- `PUT /api/routes/[id]/stops/[stopId]` - Update route stop status

**BDD Scenarios**:

**Feature: Provider views their routes**
- Scenario: Provider sees all their routes
  - Should return routes sorted by date descending
- Scenario: Provider has no routes
  - Should return empty array

**Feature: Provider updates route stop**
- Scenario: Provider marks stop as completed
  - Should update stop status
  - Should record actual arrival time
- Scenario: Provider attempts to complete already-completed stop
  - Should return error
- Scenario: Provider attempts to update another provider's route stop
  - Should deny access

**Tasks**:
- [ ] Create route-stop fixtures
- [ ] Create `tests/features/routes/provider-views-routes.test.ts`
- [ ] Create `tests/features/routes/provider-updates-route-stop.test.ts`
- [ ] Implement all route-stop scenarios
- [ ] Test status transition validation
- [ ] Verify 100% coverage

**Acceptance Criteria**:
- [ ] All scenarios passing
- [ ] Coverage ≥100% for route-stop endpoints
- [ ] Authorization verified

**Estimat**: 2.5h

---

### Epic 3.3: Refactor Remaining API Tests

**Files to refactor**:
- `src/app/api/auth/register/route.test.ts` → `tests/features/auth/user-registration.test.ts`
- `src/app/api/services/route.test.ts` → `tests/features/services/provider-manages-services.test.ts`
- `src/app/api/services/[id]/route.test.ts` → Same file
- `src/app/api/providers/route.test.ts` → `tests/features/providers/customer-views-providers.test.ts`
- `src/app/api/providers/[id]/route.test.ts` → `tests/features/providers/customer-views-provider-details.test.ts`

**Tasks**:
- [ ] Refactor auth/register tests to BDD
- [ ] Refactor services tests to BDD
- [ ] Refactor providers tests to BDD
- [ ] Delete old test files
- [ ] Verify all tests passing

**Acceptance Criteria**:
- [ ] All refactored tests passing
- [ ] Coverage maintained
- [ ] Consistent BDD pattern

**Estimat**: 4h

---

### Sprint 3 Success Criteria

- [ ] 100% API route coverage achieved (19/19 routes)
- [ ] All API tests in BDD format
- [ ] Overall coverage ≥75%
- [ ] No TDD-style tests remaining (except utilities)

---

## Sprint 4: Consolidation & Documentation (Week 7-8)

### Epic 4.1: E2E Test Naming Refactor

**Story**: As a developer, I want E2E tests to use BDD naming so all tests are consistent.

**Files to update**:
- `e2e/auth.spec.ts`
- `e2e/booking.spec.ts`
- `e2e/provider.spec.ts`
- `e2e/route-planning.spec.ts`
- `e2e/flexible-booking.spec.ts`

**Tasks**:
- [ ] Review E2E tests for BDD alignment
- [ ] Rename scenarios to use business language
- [ ] Add Feature/Scenario structure where missing
- [ ] Update test descriptions to match BDD style

**Acceptance Criteria**:
- [ ] All E2E tests use BDD naming
- [ ] Test structure: Feature → Scenario → Test case
- [ ] Business language used throughout

**Estimat**: 2h

---

### Epic 4.2: Documentation & Training

**Tasks**:
- [ ] Complete BDD section in CLAUDE.md
- [ ] Record BDD training video (10-15 min)
- [ ] Create "BDD Cheat Sheet" (1-page PDF)
- [ ] Create example PR showcasing before/after refactoring
- [ ] Document common BDD anti-patterns
- [ ] Write migration guide (TDD → BDD)

**Acceptance Criteria**:
- [ ] Complete documentation available
- [ ] Training video published
- [ ] Cheat sheet accessible to all developers
- [ ] Example PR linked in docs

**Estimat**: 4h

---

### Epic 4.3: CI/CD & Coverage Enforcement

**Tasks**:
- [ ] Configure Codecov integration
- [ ] Setup coverage thresholds in vitest.config.ts
- [ ] Create GitHub Action for coverage reporting
- [ ] Add coverage badge to README.md
- [ ] Configure PR comments with coverage diff
- [ ] Test CI/CD pipeline with failing coverage

**Acceptance Criteria**:
- [ ] CI fails if coverage drops below 80%
- [ ] PRs show coverage diff
- [ ] Coverage badge visible in README

**Estimat**: 3h

---

### Epic 4.4: Performance Optimization

**Tasks**:
- [ ] Measure test execution time baseline
- [ ] Identify slow tests (>500ms)
- [ ] Optimize fixture creation
- [ ] Consider parallel test execution
- [ ] Document test performance guidelines

**Acceptance Criteria**:
- [ ] Total test execution time <10s
- [ ] No individual test >1s (excluding E2E)
- [ ] Performance guidelines documented

**Estimat**: 2h

---

### Sprint 4 Success Criteria

- [ ] Complete documentation available
- [ ] Training materials published
- [ ] CI/CD enforces coverage thresholds
- [ ] Test performance optimized
- [ ] Overall coverage ≥80%
- [ ] Team confident in BDD approach

---

## Epic Summary

| Epic | Estimat | Coverage Target | Status |
|------|---------|----------------|--------|
| 1.1 Infrastructure | 8h | N/A | ✅ Done |
| 1.2 User Profile | 2h | 100% (2 routes) | ⏳ Todo |
| 1.3 Provider Profile | 2h | 100% (2 routes) | ⏳ Todo |
| 2.1 Availability | 1.5h | 100% (1 route) | ⏳ Todo |
| 2.2 Route Planning | 5h | 100% (4 routes) | ⏳ Todo |
| 2.3 Refactor Bookings | 3h | Maintain | ⏳ Todo |
| 3.1 Route Orders | 4h | 100% (3 routes) | ⏳ Todo |
| 3.2 Route Stops | 2.5h | 100% (2 routes) | ⏳ Todo |
| 3.3 Refactor Remaining | 4h | Maintain | ⏳ Todo |
| 4.1 E2E Naming | 2h | N/A | ⏳ Todo |
| 4.2 Documentation | 4h | N/A | ⏳ Todo |
| 4.3 CI/CD | 3h | N/A | ⏳ Todo |
| 4.4 Performance | 2h | N/A | ⏳ Todo |
| **TOTAL** | **43h** | **100% API** | **5.4 days** |

---

## Next Steps

1. **Review this task breakdown** with the team
2. **Assign Sprint 1 tasks** in your project tracker
3. **Schedule BDD workshop** (Week 1)
4. **Create Epic in GitHub Projects** with all tasks
5. **Start with Epic 1.1** (Infrastructure setup)

---

## Questions?

Ask the test-lead agent for:
- Clarifications on BDD patterns
- Help with complex test scenarios
- Code review of BDD tests
- Performance optimization tips

**Document version**: 1.0
**Last updated**: 2025-11-18
