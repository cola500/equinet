# Epic: BDD Transformation - Code Clarity & Domain-Driven Design

> **Epic Goal**: Transformera Equinet till true BDD med domain-driven design där business intent är kristallklar för både människor och AI-agenter.

---

## 📊 Epic Overview

**Status**: Planerad
**Priority**: High (Enabler för framtida utveckling)
**Effort**: 43-54 timmar (5.4-6.8 arbetsdagar)
**Timeline**: 7-9 veckor (incremental releases)
**Team Input**: Tech-Architect, Test-Lead, Data-Architect, Quality-Gate

---

## 🎯 Business Value

**Problem**:
- Business logic spridd över 19 API routes (svårt att hitta regler)
- 43 magic strings gör kod oklar
- 11 API routes saknar tester (risk för buggar)
- 537-radig komponent blandar concerns
- AI-agenter blir förvirrade av otydlig intent

**Lösning**:
- Domain layer centraliserar business logic
- BDD-tester dokumenterar beteende i klartext
- Feature-baserad struktur gör kod lättnavigerad
- Explicit business rules (UrgentOrderRule, BookingConflictChecker)

**Outcome**:
- 80% snabbare onboarding för nya utvecklare
- 70% färre buggar i business logic (tack vare tester)
- 50% snabbare att lägga till nya business rules
- AI-agenter förstår kod utan confusion

---

## 📐 Architecture Vision

### Före
```
app/api/bookings/route.ts (352 rader)
├── Auth logic
├── JSON parsing
├── Zod validation
├── Overlap detection (33 rader inline)
├── Service validation
├── Prisma transaction
└── Error handling

Magic strings överallt: "pending", "confirmed", "urgent"
Business rules dolda i if-satser
Ingen testning av komplex logik
```

### Efter
```
Domain Layer (src/domain/booking/)
├── types/
│   ├── BookingStatus.ts (enum + lifecycle methods)
│   ├── TimeSlot.ts (value object med overlap logic)
│   └── BookingDate.ts (value object med validation)
├── entities/
│   └── Booking.ts (aggregate root med business methods)
├── services/
│   └── BookingConflictChecker.ts (conflict detection)
└── rules/
    └── NoOverlapRule.ts (explicit business rule)

API Layer (tunn orchestration)
app/api/bookings/route.ts (87 rader)
├── Auth
├── Parse & validate
├── Anropa domain service
└── Error mapping

Tests
tests/features/bookings/
├── customer-creates-booking.test.ts (BDD Given-When-Then)
├── provider-views-bookings.test.ts
└── booking-conflict-detection.test.ts
```

---

## 🏗️ Enablers (Infrastructure Tasks)

Dessa måste implementeras FÖRST innan vi kan börja med refaktorering.

---

### E-1: BDD Test Infrastructure (Sprint 0, Week 1)

**Goal**: Skapa återanvändbara BDD test helpers och fixtures

**Why**: Utan detta blir varje test 200+ rader duplicerad kod

**Tasks**:
- [x] E-1.1: Create `tests/bdd-helpers/given.ts` (15+ setup helpers) ✅
- [x] E-1.2: Create `tests/bdd-helpers/when.ts` (8+ action helpers) ✅
- [x] E-1.3: Create `tests/bdd-helpers/then.ts` (10+ assertion helpers) ✅
- [x] E-1.4: Create test fixtures (bookings, services, providers) ✅
- [x] E-1.5: Create example BDD test (`customer-views-bookings.test.ts`) ✅
- [ ] E-1.6: Update vitest.config.ts med coverage thresholds
- [x] E-1.7: Create BDD documentation (strategy, quick-reference) ✅

**Acceptance Criteria**:
- [ ] BDD helpers för Given-When-Then struktur
- [ ] Fixtures för vanliga testscenarier
- [ ] 1 komplett exempel-test som referens
- [ ] Coverage thresholds: ≥70% overall, ≥80% API routes
- [ ] Documentation: Strategy + Quick Reference

**Deliverables**:
- `/tests/bdd-helpers/` (given, when, then)
- `/tests/fixtures/` (bookings, services, providers)
- `/tests/features/bookings/customer-views-bookings.test.ts`
- `/docs/bdd-transformation-strategy.md`
- `/docs/bdd-quick-reference.md`

**Effort**: 8h (1 dag) - ✅ **COMPLETED**
**Owner**: Test-Lead
**Risk**: 🟢 Låg

---

### E-2: Domain Layer Foundation (Sprint 0, Week 1-2)

**Goal**: Skapa grundläggande domain infrastructure (base classes, patterns)

**Why**: Alla domain models bygger på detta

**Tasks**:
- [ ] E-2.1: Create `src/domain/shared/base/Entity.ts`
- [ ] E-2.2: Create `src/domain/shared/base/ValueObject.ts`
- [ ] E-2.3: Create `src/domain/shared/base/AggregateRoot.ts`
- [ ] E-2.4: Create `src/domain/shared/types/Result.ts` (Result pattern)
- [ ] E-2.5: Create `src/domain/shared/types/Guard.ts` (validation utilities)
- [ ] E-2.6: Create `src/domain/shared/errors/DomainError.ts`
- [ ] E-2.7: Write unit tests för alla base classes

**Acceptance Criteria**:
- [ ] Base classes med TypeScript generics
- [ ] Result pattern för error handling (no exceptions)
- [ ] Guard utilities för common validations
- [ ] 100% test coverage för base classes
- [ ] Documentation med usage examples

**Deliverables**:
- `/src/domain/shared/` (6 files)
- Unit tests för shared domain infrastructure

**Effort**: 6h
**Owner**: Data-Architect + Tech-Architect
**Dependencies**: Inga
**Risk**: 🟢 Låg

---

### E-3: Repository Pattern Infrastructure (Sprint 0, Week 2)

**Goal**: Abstrahera Prisma bakom repository interface

**Why**: Domain layer måste vara oberoende av database implementation

**Tasks**:
- [ ] E-3.1: Create `src/infrastructure/persistence/BaseRepository.ts`
- [ ] E-3.2: Create repository interfaces för varje domain
  - [ ] BookingRepository interface
  - [ ] RouteRepository interface
  - [ ] RouteOrderRepository interface
  - [ ] ProviderRepository interface
  - [ ] ServiceRepository interface
- [ ] E-3.3: Create Prisma implementations
  - [ ] PrismaBookingRepository
  - [ ] PrismaRouteRepository
  - [ ] etc.
- [ ] E-3.4: Create mock implementations för testing
- [ ] E-3.5: Write integration tests (mot SQLite test DB)

**Acceptance Criteria**:
- [ ] Repository interfaces definierade
- [ ] Prisma implementations med toDomain/toPrisma mappers
- [ ] Mock implementations för unit testing
- [ ] Integration tests passerar
- [ ] No Prisma imports utanför infrastructure layer

**Deliverables**:
- `/src/infrastructure/persistence/` (repositories)
- Integration tests för varje repository

**Effort**: 10h
**Owner**: Data-Architect
**Dependencies**: E-2 (behöver domain base classes)
**Risk**: 🟡 Medel (ny abstraktion)

---

### E-4: Ubiquitous Language Glossary (Sprint 0, Week 1)

**Goal**: Dokumentera business terminology som används i domain layer

**Why**: Teamet måste prata samma språk som koden

**Tasks**:
- [ ] E-4.1: Interview stakeholders om business terms
- [ ] E-4.2: Create `docs/UBIQUITOUS_LANGUAGE.md`
- [ ] E-4.3: Document Booking domain terms
- [ ] E-4.4: Document Route/RouteOrder domain terms
- [ ] E-4.5: Document Provider/Service domain terms
- [ ] E-4.6: Share med team för review

**Acceptance Criteria**:
- [ ] Glossary med 50+ business terms
- [ ] Examples för varje term
- [ ] Mappning till code concepts
- [ ] Team har reviewat och godkänt

**Deliverables**:
- `/docs/UBIQUITOUS_LANGUAGE.md`

**Effort**: 4h
**Owner**: Tech-Architect + Product Owner
**Dependencies**: Inga
**Risk**: 🟢 Låg

---

### E-5: CI/CD Quality Gates (Sprint 0, Week 2)

**Goal**: Automatisera quality checks i CI pipeline

**Why**: Förhindra regression och enforcea standards

**Tasks**:
- [ ] E-5.1: Create GitHub Action för test coverage enforcement
- [ ] E-5.2: Create GitHub Action för TypeScript strict check
- [ ] E-5.3: Create GitHub Action för circular dependency detection
- [ ] E-5.4: Setup Codecov för PR comments
- [ ] E-5.5: Configure branch protection rules
- [ ] E-5.6: Create pre-commit hook template

**Acceptance Criteria**:
- [ ] CI blockerar merge om coverage < 70%
- [ ] CI blockerar merge om TypeScript errors
- [ ] CI blockerar merge om circular dependencies
- [ ] Codecov visar coverage diff i PR
- [ ] Pre-commit hook körs lokalt

**Deliverables**:
- `.github/workflows/quality-gates.yml`
- `.git/hooks/pre-commit`

**Effort**: 5h
**Owner**: Quality-Gate
**Dependencies**: E-1 (behöver test infrastructure)
**Risk**: 🟢 Låg

---

## 📦 Implementation Sprints

---

## Sprint 1: Foundation + User Management (Week 1-2)

**Goal**: Setup infrastructure + testa 2 enkla API routes

**Why**: Build foundation, learn BDD patterns, quick wins

---

### Task Group 1.1: Complete Enablers

**Tasks**:
- [ ] Complete E-1 (BDD Test Infrastructure) - 8h ✅ **DONE**
- [ ] Complete E-2 (Domain Layer Foundation) - 6h
- [ ] Complete E-3 (Repository Pattern) - 10h
- [ ] Complete E-4 (Ubiquitous Language) - 4h
- [ ] Complete E-5 (CI/CD Quality Gates) - 5h

**Total Effort**: 33h (redan 8h klart = 25h kvar)
**Success Criteria**: Alla enablers completed, dokumentation klar

---

### Task Group 1.2: User Profile Testing (P0 - Kritisk)

**Goal**: Implementera BDD-tester för user profile management

**API Route**: `GET /api/profile`, `PUT /api/profile`

**Tasks**:
- [ ] T-1.2.1: Write BDD test: "Customer views their profile"
- [ ] T-1.2.2: Write BDD test: "Customer updates their profile"
- [ ] T-1.2.3: Write BDD test: "Customer tries to update with invalid data"
- [ ] T-1.2.4: Refactor API route om nödvändigt för testbarhet
- [ ] T-1.2.5: Verify E2E tests passerar

**Acceptance Criteria**:
- [ ] 3+ BDD scenarios för profile routes
- [ ] Coverage ≥80% för profile routes
- [ ] Given-When-Then struktur
- [ ] Återanvänder BDD helpers från E-1

**Deliverables**:
- `tests/features/profile/customer-views-profile.test.ts`
- `tests/features/profile/customer-updates-profile.test.ts`

**Effort**: 2h
**Owner**: Test-Lead
**Dependencies**: E-1
**Risk**: 🟢 Låg

---

### Task Group 1.3: Provider Profile Testing (P0 - Kritisk)

**Goal**: Implementera BDD-tester för provider profile management

**API Route**: `GET /api/provider/profile`, `PUT /api/provider/profile`

**Tasks**:
- [ ] T-1.3.1: Write BDD test: "Provider views their profile"
- [ ] T-1.3.2: Write BDD test: "Provider updates business information"
- [ ] T-1.3.3: Write BDD test: "Provider cannot update other provider's profile"

**Acceptance Criteria**:
- [ ] 3+ BDD scenarios för provider profile
- [ ] Coverage ≥80%
- [ ] Authorization tests included

**Deliverables**:
- `tests/features/profile/provider-views-profile.test.ts`
- `tests/features/profile/provider-updates-profile.test.ts`

**Effort**: 2h
**Owner**: Test-Lead
**Dependencies**: E-1
**Risk**: 🟢 Låg

---

**Sprint 1 Total Effort**: 29h (3.6 dagar)
**Sprint 1 Deliverables**:
- ✅ Complete BDD infrastructure
- ✅ Domain layer foundation
- ✅ 2 API routes fully tested (profile management)
- ✅ Coverage increase: +10%

---

## Sprint 2: Booking Domain (Week 3-4)

**Goal**: Refaktorera booking domain till DDD + BDD

**Why**: Booking är kärnfunktionen, innehåller komplex logic (overlap detection)

---

### Task Group 2.1: Booking Domain Model

**Goal**: Skapa rich domain model för bookings

**Tasks**:
- [ ] T-2.1.1: Create `BookingStatus` value object (enum + lifecycle methods)
- [ ] T-2.1.2: Create `TimeSlot` value object (overlap detection logic)
- [ ] T-2.1.3: Create `BookingDate` value object (future validation)
- [ ] T-2.1.4: Create `HorseInfo` value object
- [ ] T-2.1.5: Create `Booking` entity (aggregate root)
- [ ] T-2.1.6: Write unit tests för alla value objects (100% coverage)
- [ ] T-2.1.7: Write unit tests för Booking entity

**Acceptance Criteria**:
- [ ] 4 value objects med business logic
- [ ] Booking aggregate root med domain methods
- [ ] 100% unit test coverage för domain layer
- [ ] 0 dependencies på Prisma/infrastructure

**Deliverables**:
- `/src/domain/booking/types/` (4 value objects)
- `/src/domain/booking/entities/Booking.ts`
- Unit tests för booking domain

**Effort**: 6h
**Owner**: Data-Architect
**Dependencies**: E-2
**Risk**: 🟡 Medel

---

### Task Group 2.2: Booking Services & Rules

**Goal**: Extrahera business logic från API routes

**Tasks**:
- [ ] T-2.2.1: Create `BookingConflictChecker` service
  - Migrera overlap logic från `app/api/bookings/route.ts:154-187`
- [ ] T-2.2.2: Create `NoOverlapRule` business rule
- [ ] T-2.2.3: Create `FutureDateRule` business rule
- [ ] T-2.2.4: Create `StatusTransitionRule` business rule
- [ ] T-2.2.5: Write unit tests för alla services och rules

**Acceptance Criteria**:
- [ ] BookingConflictChecker med overlap detection
- [ ] 3+ explicit business rules
- [ ] 100% test coverage för services
- [ ] API route logic reducerad med 50%

**Deliverables**:
- `/src/domain/booking/services/BookingConflictChecker.ts`
- `/src/domain/booking/rules/` (3 rule classes)

**Effort**: 4h
**Owner**: Data-Architect
**Dependencies**: T-2.1
**Risk**: 🟡 Medel

---

### Task Group 2.3: Booking Repository

**Goal**: Implementera repository pattern för bookings

**Tasks**:
- [ ] T-2.3.1: Create `BookingRepository` interface
- [ ] T-2.3.2: Create `PrismaBookingRepository` implementation
- [ ] T-2.3.3: Create `BookingMapper` (domain ↔ Prisma)
- [ ] T-2.3.4: Create `MockBookingRepository` för testing
- [ ] T-2.3.5: Write integration tests för repository

**Acceptance Criteria**:
- [ ] Repository interface med alla CRUD operations
- [ ] Prisma implementation med toDomain/toPrisma mappers
- [ ] Mock implementation för unit tests
- [ ] Integration tests passerar

**Deliverables**:
- `/src/infrastructure/persistence/booking/` (repository + mapper)

**Effort**: 4h
**Owner**: Data-Architect
**Dependencies**: T-2.1, E-3
**Risk**: 🟡 Medel

---

### Task Group 2.4: Booking BDD Tests

**Goal**: Skapa comprehensive BDD test suite för booking API

**Tasks**:
- [ ] T-2.4.1: Write BDD test: "Customer creates booking for available time slot"
- [ ] T-2.4.2: Write BDD test: "Customer cannot book overlapping time slot"
- [ ] T-2.4.3: Write BDD test: "Customer cannot book past dates"
- [ ] T-2.4.4: Write BDD test: "Provider views pending bookings"
- [ ] T-2.4.5: Write BDD test: "Provider confirms booking"
- [ ] T-2.4.6: Write BDD test: "Customer cancels booking"

**Acceptance Criteria**:
- [ ] 6+ BDD scenarios för booking domain
- [ ] Coverage ≥80% för booking API routes
- [ ] Uses domain layer (not direct Prisma)
- [ ] All E2E tests still pass

**Deliverables**:
- `tests/features/bookings/` (6+ test files)

**Effort**: 6h
**Owner**: Test-Lead
**Dependencies**: T-2.1, T-2.2, T-2.3, E-1
**Risk**: 🟢 Låg

---

### Task Group 2.5: Refactor Booking API Routes

**Goal**: Refaktorera API routes till tunn orchestration layer

**Tasks**:
- [ ] T-2.5.1: Refactor `POST /api/bookings` att använda domain services
- [ ] T-2.5.2: Refactor `GET /api/bookings` att använda repository
- [ ] T-2.5.3: Refactor `PUT /api/bookings/[id]` att använda domain
- [ ] T-2.5.4: Refactor `DELETE /api/bookings/[id]` att använda domain
- [ ] T-2.5.5: Ta bort gamla inline business logic
- [ ] T-2.5.6: Verify alla E2E tests passerar (CRITICAL!)

**Acceptance Criteria**:
- [ ] API routes <100 rader vardera
- [ ] No business logic i routes (endast orchestration)
- [ ] No Prisma imports i route files
- [ ] **INGA breaking changes** - alla E2E tests gröna
- [ ] Performance ≤110% av baseline

**Deliverables**:
- Refactored `/app/api/bookings/` routes

**Effort**: 5h
**Owner**: Tech-Architect
**Dependencies**: T-2.1, T-2.2, T-2.3
**Risk**: 🔴 Hög (critical path - ingen regression allowed!)

---

**Sprint 2 Total Effort**: 25h (3.1 dagar)
**Sprint 2 Deliverables**:
- ✅ Booking domain layer komplett
- ✅ Booking API routes refaktorerade
- ✅ 6+ BDD test scenarios för booking
- ✅ Coverage increase: +15%

---

## Sprint 3: Route Planning & Availability (Week 5-6)

**Goal**: Testa route planning + provider availability

**Why**: P1 priority routes med komplex business logic

---

### Task Group 3.1: Provider Availability Testing

**Goal**: BDD-tester för provider availability API

**API Route**: `GET /api/providers/[id]/availability`

**Tasks**:
- [ ] T-3.1.1: Write BDD test: "Customer views provider weekly schedule"
- [ ] T-3.1.2: Write BDD test: "Provider updates business hours"
- [ ] T-3.1.3: Write BDD test: "Booking respects provider closed days"

**Acceptance Criteria**:
- [ ] 3+ scenarios för availability
- [ ] Coverage ≥80%

**Deliverables**:
- `tests/features/availability/`

**Effort**: 1.5h
**Owner**: Test-Lead
**Dependencies**: E-1
**Risk**: 🟢 Låg

---

### Task Group 3.2: Route Planning Testing

**Goal**: BDD-tester för route planning functionality

**API Routes**:
- `POST /api/routes`
- `GET /api/routes/[id]`
- `PUT /api/routes/[id]`
- `DELETE /api/routes/[id]`
- `PUT /api/routes/[id]/stops/[stopId]`

**Tasks**:
- [ ] T-3.2.1: Write BDD test: "Provider creates new route"
- [ ] T-3.2.2: Write BDD test: "Provider adds stops to route"
- [ ] T-3.2.3: Write BDD test: "System calculates route distance"
- [ ] T-3.2.4: Write BDD test: "System estimates arrival times"
- [ ] T-3.2.5: Write BDD test: "Provider marks route as completed"
- [ ] T-3.2.6: Write BDD test: "Provider updates stop order"

**Acceptance Criteria**:
- [ ] 6+ scenarios för route planning
- [ ] Coverage ≥80% för all 5 route endpoints
- [ ] Tests dokumenterar distance/time calculation logic

**Deliverables**:
- `tests/features/routes/` (6+ test files)

**Effort**: 5h
**Owner**: Test-Lead
**Dependencies**: E-1
**Risk**: 🟡 Medel (komplex domain)

---

**Sprint 3 Total Effort**: 6.5h (0.8 dagar)
**Sprint 3 Deliverables**:
- ✅ 5 route planning endpoints testade
- ✅ 1 availability endpoint testad
- ✅ Coverage increase: +20% (nu ~65% total)

---

## Sprint 4: Route Orders (Week 7)

**Goal**: Testa route order management

**Why**: P2 priority, contains 48-hour urgent rule

---

### Task Group 4.1: Route Order Domain Model (Optional)

**Goal**: Skapa domain model för route orders (om tid finns)

**Tasks**:
- [ ] T-4.1.1: Create `Priority` value object (urgent/normal)
- [ ] T-4.1.2: Create `DateRange` value object
- [ ] T-4.1.3: Create `UrgentOrderRule` (48-hour validation)
- [ ] T-4.1.4: Create `DateRangeRule` (30-day span validation)

**Acceptance Criteria**:
- [ ] Explicit business rules för urgent orders
- [ ] 100% unit test coverage

**Deliverables**:
- `/src/domain/route-order/` (value objects + rules)

**Effort**: 3h
**Owner**: Data-Architect
**Dependencies**: E-2
**Risk**: 🟢 Låg
**Priority**: Optional (kan skippas om tidsbrist)

---

### Task Group 4.2: Route Order Testing

**Goal**: BDD-tester för route order management

**API Routes**:
- `POST /api/route-orders`
- `GET /api/route-orders/available`
- `GET /api/route-orders/my-orders`

**Tasks**:
- [ ] T-4.2.1: Write BDD test: "Customer creates normal priority route order"
- [ ] T-4.2.2: Write BDD test: "Customer creates urgent order within 48h"
- [ ] T-4.2.3: Write BDD test: "System rejects urgent order beyond 48h"
- [ ] T-4.2.4: Write BDD test: "System rejects date span > 30 days"
- [ ] T-4.2.5: Write BDD test: "Provider views available route orders"

**Acceptance Criteria**:
- [ ] 5+ scenarios för route orders
- [ ] Coverage ≥80%
- [ ] 48-hour rule explicitly tested
- [ ] 30-day span rule explicitly tested

**Deliverables**:
- `tests/features/route-orders/` (5+ test files)

**Effort**: 4h
**Owner**: Test-Lead
**Dependencies**: E-1, (optional: T-4.1)
**Risk**: 🟢 Låg

---

**Sprint 4 Total Effort**: 7h (0.9 dagar)
**Sprint 4 Deliverables**:
- ✅ 3 route order endpoints testade
- ✅ Business rules (48h, 30-day) explicitly tested
- ✅ Coverage: ~70% (threshold reached!)

---

## Sprint 5: Test Refactoring & Component Cleanup (Week 8-9)

**Goal**: Refaktorera befintliga tester till BDD + cleanup components

**Why**: Konsolidera patterns, improve readability

---

### Task Group 5.1: Refactor Existing API Tests to BDD

**Goal**: Konvertera befintliga API route tests till Given-When-Then

**Tasks**:
- [ ] T-5.1.1: Refactor `tests/api/services.test.ts` → BDD structure
- [ ] T-5.1.2: Refactor `tests/api/bookings.test.ts` → BDD structure (om inte redan gjort i Sprint 2)
- [ ] T-5.1.3: Refactor remaining API tests → BDD structure
- [ ] T-5.1.4: Remove old test utilities, use BDD helpers

**Acceptance Criteria**:
- [ ] All API tests use Given-When-Then
- [ ] No old test patterns remaining
- [ ] Coverage maintained or improved
- [ ] Test execution time <30s

**Deliverables**:
- Refactored test files in `tests/features/`

**Effort**: 4h
**Owner**: Test-Lead
**Dependencies**: E-1, Sprint 1-4 completed
**Risk**: 🟢 Låg

---

### Task Group 5.2: Refactor E2E Tests Naming

**Goal**: Uppdatera E2E test naming till BDD-stil

**Tasks**:
- [ ] T-5.2.1: Rename E2E tests: `{feature}.spec.ts` → `{actor}-{action}.spec.ts`
- [ ] T-5.2.2: Add Feature/Scenario descriptions till E2E tests
- [ ] T-5.2.3: Ensure all E2E tests use data-testid

**Acceptance Criteria**:
- [ ] E2E tests har beskrivande namn
- [ ] Feature/Scenario struktur i E2E
- [ ] All E2E tests still pass (CRITICAL!)

**Deliverables**:
- Refactored E2E test files

**Effort**: 2h
**Owner**: Test-Lead
**Dependencies**: Inga
**Risk**: 🟡 Medel (E2E är fragila)

---

### Task Group 5.3: Component Refactoring (Booking Page)

**Goal**: Bryt ner monolitisk CustomerBookingsPage

**Tasks**:
- [ ] T-5.3.1: Extract `BookingList` component
- [ ] T-5.3.2: Extract `BookingListItem` component
- [ ] T-5.3.3: Extract `BookingFilters` component
- [ ] T-5.3.4: Extract `CancelBookingDialog` component
- [ ] T-5.3.5: Extract business logic → `useBookingManagement` hook
- [ ] T-5.3.6: Add data-testid to all interactive elements

**Acceptance Criteria**:
- [ ] CustomerBookingsPage <100 rader
- [ ] 5+ extracted components
- [ ] Business logic i custom hooks
- [ ] E2E tests still pass

**Deliverables**:
- `/src/features/booking/components/customer/` (extracted components)

**Effort**: 6h
**Owner**: Tech-Architect
**Dependencies**: Inga
**Risk**: 🟡 Medel

---

**Sprint 5 Total Effort**: 12h (1.5 dagar)
**Sprint 5 Deliverables**:
- ✅ All tests use BDD structure
- ✅ E2E tests refactored
- ✅ CustomerBookingsPage modulariserad
- ✅ Coverage: ≥75%

---

## Sprint 6: Documentation & Consolidation (Week 9)

**Goal**: Finalize docs, cleanup, production-ready

**Why**: Komplett epic med full documentation

---

### Task Group 6.1: Update Project Documentation

**Goal**: Uppdatera CLAUDE.md och README med BDD patterns

**Tasks**:
- [ ] T-6.1.1: Add BDD section till CLAUDE.md
  - BDD workflow
  - Test templates
  - Domain layer structure
  - Common patterns
- [ ] T-6.1.2: Update README.md med refactoring changes
- [ ] T-6.1.3: Create Architecture Decision Record (ADR)
  - ADR-001: Why DDD over anemic models
  - ADR-002: Why BDD test structure
- [ ] T-6.1.4: Create developer onboarding guide

**Acceptance Criteria**:
- [ ] CLAUDE.md har comprehensive BDD guide
- [ ] README uppdaterad
- [ ] 2+ ADRs dokumenterade
- [ ] Onboarding guide för nya developers

**Deliverables**:
- Updated `CLAUDE.md`
- Updated `README.md`
- `/docs/adr/` (2 ADRs)
- `/docs/DEVELOPER_ONBOARDING.md`

**Effort**: 4h
**Owner**: Tech-Architect
**Dependencies**: All sprints completed
**Risk**: 🟢 Låg

---

### Task Group 6.2: Code Cleanup

**Goal**: Ta bort dead code, konsolidera patterns

**Tasks**:
- [ ] T-6.2.1: Remove old test utilities (ersatta av BDD helpers)
- [ ] T-6.2.2: Remove magic strings (search codebase for hardcoded "pending", etc.)
- [ ] T-6.2.3: Consolidate validation schemas (move till domain layer)
- [ ] T-6.2.4: Remove unused imports
- [ ] T-6.2.5: Run linter och fix alla warnings

**Acceptance Criteria**:
- [ ] 0 magic strings i codebase
- [ ] 0 unused imports
- [ ] 0 linting warnings
- [ ] 0 TypeScript errors

**Deliverables**:
- Clean codebase

**Effort**: 3h
**Owner**: Quality-Gate
**Dependencies**: All sprints
**Risk**: 🟢 Låg

---

### Task Group 6.3: Performance Validation

**Goal**: Verifiera att refactoring inte introducerat performance regression

**Tasks**:
- [ ] T-6.3.1: Run baseline performance tests
- [ ] T-6.3.2: Compare mot pre-refactor metrics
- [ ] T-6.3.3: Optimize om performance regression >10%
- [ ] T-6.3.4: Document performance metrics

**Acceptance Criteria**:
- [ ] API response time ≤110% av baseline
- [ ] Bundle size ≤110% av baseline
- [ ] Test execution time <30s (unit), <2min (E2E)

**Deliverables**:
- Performance report

**Effort**: 2h
**Owner**: Performance-Guardian
**Dependencies**: All sprints
**Risk**: 🟢 Låg

---

### Task Group 6.4: Final Quality Gate

**Goal**: Verifiera att epic uppfyller alla DoD criteria

**Tasks**:
- [ ] T-6.4.1: Run full test suite (unit + E2E)
- [ ] T-6.4.2: Verify coverage ≥80%
- [ ] T-6.4.3: Verify 0 TypeScript errors
- [ ] T-6.4.4: Verify build successfull
- [ ] T-6.4.5: Manual smoke testing
- [ ] T-6.4.6: Security review (om domain-sensitive logic ändrats)

**Acceptance Criteria**:
- [ ] 100% test pass rate
- [ ] Coverage ≥80%
- [ ] Production build successful
- [ ] No critical bugs
- [ ] Security review passed (if applicable)

**Deliverables**:
- Quality gate report

**Effort**: 2h
**Owner**: Quality-Gate
**Dependencies**: All tasks completed
**Risk**: 🟢 Låg

---

**Sprint 6 Total Effort**: 11h (1.4 dagar)
**Sprint 6 Deliverables**:
- ✅ Complete documentation
- ✅ Clean codebase
- ✅ Performance validated
- ✅ Epic DONE!

---

## 📊 Epic Summary

### Total Effort Breakdown

| Sprint | Focus | Effort | Status |
|--------|-------|--------|--------|
| Sprint 0 (Enablers) | Infrastructure | 25h | Partially complete (8h done) |
| Sprint 1 | User Management | 4h | Planned |
| Sprint 2 | Booking Domain | 25h | Planned |
| Sprint 3 | Routes & Availability | 6.5h | Planned |
| Sprint 4 | Route Orders | 7h | Planned |
| Sprint 5 | Test & Component Refactor | 12h | Planned |
| Sprint 6 | Documentation & Cleanup | 11h | Planned |
| **TOTAL** | | **90.5h (11.3 dagar)** | |

### Coverage Progression

| Phase | Coverage | API Routes Tested |
|-------|----------|-------------------|
| Baseline | ~50% | 8/19 (42%) |
| After Sprint 1 | ~55% | 10/19 (53%) |
| After Sprint 2 | ~60% | 14/19 (74%) |
| After Sprint 3 | ~70% | 19/19 (100%) ✅ |
| After Sprint 4 | ~75% | 19/19 |
| After Sprint 5 | ~80% | 19/19 |
| **Final** | **≥80%** | **19/19 (100%)** |

### Success Metrics

| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| Test Coverage | 50% | ≥80% | 🎯 |
| API Routes Tested | 8/19 | 19/19 | 🎯 |
| Magic Strings | 43 | 0 | 🎯 |
| Largest Component | 537 lines | <100 lines | 🎯 |
| Business Rules Documented | 20% | 100% | 🎯 |
| Domain Layer Tests | 0% | ≥90% | 🎯 |

---

## 🎯 Definition of Done (Epic Level)

Epic är **COMPLETED** när:

### Code Quality
- [x] BDD test infrastructure deployed ✅
- [ ] 100% API routes har BDD tests (19/19)
- [ ] Test coverage ≥80% overall
- [ ] 0 magic strings i codebase
- [ ] 0 TypeScript errors
- [ ] 0 circular dependencies
- [ ] All components <200 lines

### Architecture
- [ ] Domain layer implementerat (≥1 domain)
- [ ] Repository pattern på plats
- [ ] API routes är tunn orchestration (<100 lines)
- [ ] Business logic centraliserad i domain layer

### Testing
- [ ] All unit tests pass (100%)
- [ ] All E2E tests pass (100%)
- [ ] BDD Given-When-Then struktur
- [ ] Test execution <30s (unit), <2min (E2E)

### Documentation
- [x] BDD strategy dokumenterad ✅
- [x] BDD quick reference skapad ✅
- [ ] CLAUDE.md uppdaterad med BDD patterns
- [ ] Ubiquitous language glossary skapad
- [ ] 2+ Architecture Decision Records
- [ ] Developer onboarding guide

### Performance
- [ ] API response time ≤110% baseline
- [ ] Bundle size ≤110% baseline
- [ ] No user-facing regressions

### Business Continuity
- [ ] **INGA breaking changes**
- [ ] All user flows fungerar
- [ ] Production deploy successful

---

## 🚨 Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Performance regression** | Hög | Medel | Measure baseline, optimize mappers, performance tests |
| **Breaking API contracts** | Kritisk | Låg | E2E tests as regression safety, backwards compatibility required |
| **Test coverage drop** | Hög | Medel | Dual track testing, no delete before new tests pass |
| **Team learning curve** | Medel | Hög | Pair programming, workshops, comprehensive docs |
| **Scope creep** | Medel | Medel | Strict epic boundaries, MVP focus |

---

## 📅 Timeline & Milestones

```
Week 1-2: Sprint 0 (Enablers)
  ├─ Milestone 1: BDD infrastructure ready ✅
  ├─ Milestone 2: Domain foundation ready
  └─ Milestone 3: CI/CD quality gates active

Week 2: Sprint 1 (User Management)
  └─ Milestone 4: First 2 API routes tested with BDD

Week 3-4: Sprint 2 (Booking Domain)
  ├─ Milestone 5: Booking domain model complete
  ├─ Milestone 6: Booking API refactored
  └─ Milestone 7: Coverage ≥60%

Week 5-6: Sprint 3 (Routes)
  └─ Milestone 8: 100% API coverage reached! 🎉

Week 7: Sprint 4 (Route Orders)
  └─ Milestone 9: Coverage ≥70% (threshold!)

Week 8-9: Sprint 5 (Refactoring)
  └─ Milestone 10: All tests BDD, components modular

Week 9: Sprint 6 (Finalization)
  └─ Milestone 11: Epic DONE, production deploy! 🚀
```

---

## 🎬 Nästa Steg

### Immediate (Denna veckan)
1. [ ] Review epic plan med teamet
2. [ ] Godkänn approach och timeline
3. [ ] Complete remaining enablers (E-2 till E-5)
4. [ ] Create GitHub Epic + milestones
5. [ ] Schedule team BDD workshop (2h)

### Next Week (Sprint 1)
1. [ ] Implement first BDD tests (`/api/profile`)
2. [ ] Team review av test tillsammans
3. [ ] Start Sprint 2 planning

### Continuous
- Daily standup: Update på sprint progress
- Weekly: Coverage trend review
- Per sprint: Retrospective + learnings

---

## 📚 Resources

**Documentation** (Already Created):
- [x] `/docs/bdd-transformation-strategy.md` - Full strategy ✅
- [x] `/docs/bdd-quick-reference.md` - Daily reference ✅
- [x] `/docs/bdd-epic-tasks.md` - Task breakdown ✅
- [x] `/features/BDD-REFACTOR-QUALITY-STRATEGY.md` - Quality gates ✅

**Code** (Partially Created):
- [x] `/tests/bdd-helpers/` - Given/When/Then helpers ✅
- [x] `/tests/fixtures/` - Test data builders ✅
- [x] `/tests/features/bookings/customer-views-bookings.test.ts` - Example ✅

**To Create**:
- [ ] `/docs/UBIQUITOUS_LANGUAGE.md`
- [ ] `/docs/DEVELOPER_ONBOARDING.md`
- [ ] `/docs/adr/` (Architecture Decision Records)
- [ ] `/src/domain/` (Domain layer)

---

## 🤝 Team Assignments

| Role | Responsibilities | Sprints |
|------|------------------|---------|
| **Tech-Architect** | Domain design, API refactoring, architecture decisions | All |
| **Test-Lead** | BDD test implementation, test strategy, quality | All |
| **Data-Architect** | Domain modeling, repository pattern, Prisma mapping | Sprint 2-4 |
| **Quality-Gate** | DoD verification, release management, CI/CD | Sprint 6 |
| **Performance-Guardian** | Performance validation, optimization | Sprint 6 |
| **Security-Reviewer** | Security audit (if domain-sensitive logic changes) | Sprint 2, 6 |

---

**Epic Owner**: Tech-Architect
**Epic Created**: 2025-11-18
**Epic Status**: 🟡 In Progress (8h/90.5h = 8.8% complete)

---

*"Make the implicit explicit. Make the complex simple. Make the intent obvious."*
— Domain-Driven Design Principles
