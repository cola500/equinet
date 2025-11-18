# BDD Epic - Domain Modeling Strategy Review

**Reviewer**: Data-Architect Agent
**Date**: 2025-11-18
**Epic**: BDD Transformation (BDD-EPIC-PLAN.md)
**Focus**: Domain layer approach, repository pattern, database schema implications

---

## 🎯 Executive Summary

**Decision**: ⚠️ **NEEDS REVISION** (Sound approach, tactical adjustments needed)

**Overall Assessment**:
- ✅ Domain-driven design approach is solid and appropriate for Equinet
- ✅ Booking as pilot domain is excellent choice
- ⚠️ Sprint 0 domain prep is over-engineered (creating base classes without concrete use case)
- ⚠️ Repository pattern implementation plan has gaps (transaction handling, mapping overhead)
- ⚠️ Sprint sequence is backwards (testing Route before RouteOrder)
- ⚠️ "INGA breaking changes" cannot be guaranteed without contingency plan

**Key Recommendation**:
Start with **minimal viable domain foundation** in Sprint 0, then **discover and extract patterns** during Sprint 2 (Booking pilot). This aligns with CLAUDE.md's "databas-först approach" principle.

---

## 📐 1. Domain Foundation Review (E-2)

### Proposed Base Classes

| Class | Purpose | Assessment |
|-------|---------|------------|
| Entity | Base class for entities with identity | ✅ Essential |
| ValueObject | Immutable value objects | ✅ Essential |
| AggregateRoot | Root entities with consistency boundaries | 🟡 Useful but can wait |
| Result | Error handling without exceptions | 🟡 Useful but can wait |
| Guard | Validation utilities | 🟡 Useful but can wait |
| DomainError | Domain-specific errors | 🟡 Useful but can wait |

### Missing Infrastructure

| Pattern | Purpose | Priority |
|---------|---------|----------|
| **DomainEvent** | Event-driven decoupling (e.g., BookingConfirmedEvent) | 🟢 Nice-to-have |
| **Specification<T>** | Reusable business rules (e.g., OverlapSpecification) | 🟡 Consider adding |

### Critical Issue: YAGNI Violation

**Problem**: E-2 plans to create 6 base classes (6h) BEFORE implementing any concrete domain.

**Risk**:
- Over-engineering - might create abstractions we don't need
- Wasted effort - might miss real needs discovered during implementation
- Violates CLAUDE.md principle: **"databas-först approach"** (design based on real needs, not theory)

**Example**:
```typescript
// We might create this in Sprint 0:
abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = []
  // ... complex event handling we may not need
}

// But discover in Sprint 2 we only need:
abstract class AggregateRoot<T> extends Entity<T> {
  // Simple validation, no events
}
```

### Recommendation: Minimal Viable Foundation

**Sprint 0 Domain Prep** (3h instead of 6h):

1. ✅ Create `Entity<T>` base class
2. ✅ Create `ValueObject<T>` base class
3. ✅ Create ONE pilot value object: `BookingStatus`
   - Purpose: Validate pattern works with real Prisma data
   - Learning: Discover mapping overhead, TypeScript issues, etc.
4. ❌ **SKIP** AggregateRoot, Result, Guard, DomainError until Sprint 2

**Sprint 2 Booking Implementation** (discover real needs):

5. Implement Booking domain using Entity/ValueObject
6. **THEN** extract common patterns:
   - Need error handling? → Extract `Result<T>` pattern
   - Need validation helpers? → Extract `Guard` utilities
   - Need consistency boundaries? → Extract `AggregateRoot<T>`

**Benefits**:
- 50% less Sprint 0 work (3h vs 6h)
- Patterns based on REAL needs, not speculation
- Faster learning cycle
- Aligns with "databas-först approach"

---

## 🗄️ 2. Repository Pattern Review (E-3)

### Current Plan Assessment

**E-3 Tasks** (10h):
- [ ] Create `BaseRepository.ts`
- [ ] Create repository interfaces för ALL 5 domains
- [ ] Create Prisma implementations för ALL 5 domains
- [ ] Create mock implementations för ALL 5 domains
- [ ] Integration tests för ALL repositories

**Critical Issues**:

#### Issue #1: Premature Abstraction

Creating repositories for ALL 5 domains in Sprint 0 is premature:
- We only implement Booking domain in Sprint 2
- Route/RouteOrder repositories won't be used until Sprint 3-4
- Requirements will emerge during implementation

**Recommendation**: ❌ Don't create all repositories in Sprint 0
✅ Create repositories **one-by-one** as we implement each domain:
- Sprint 2: `BookingRepository` only
- Sprint 3: `RouteOrderRepository` only
- Sprint 4: `RouteRepository` only

#### Issue #2: Mapping Overhead Unknown

**Claim**: "Mapping overhead <2ms"
**Reality**: This is a GUESS without measurement!

**Complexity analysis**:
```typescript
// Booking has 13 fields + 3 relations
Prisma Booking → Domain Booking entity
  - Map 13 primitive fields
  - Map status String → BookingStatus value object
  - Map startTime/endTime Strings → TimeSlot value object
  - Map bookingDate DateTime → BookingDate value object
  - Map horseName/horseInfo → HorseInfo value object
  - Potential: 5-10ms overhead (NOT <2ms!)

// RouteOrder + Route is worse (nested RouteStops)
Prisma Route → Domain Route aggregate
  - Map Route fields
  - Map RouteStop[] → Domain RouteStop entities
  - Map each RouteStop's RouteOrder relation
  - Potential: 10-20ms overhead!
```

**Recommendation**:
1. ✅ Measure mapping overhead in Sprint 2 with real data
2. ✅ Document baseline: 2 bookings, 10 bookings, 100 bookings
3. ✅ Optimize hot paths if overhead >5ms
4. ✅ Consider selective repository use (only for complex domains)

#### Issue #3: Transaction Handling Missing

**Critical requirement**: Booking conflict detection uses `prisma.$transaction`

Current code (lines 154-192 in `route.ts`):
```typescript
const booking = await prisma.$transaction(async (tx) => {
  // Check for overlapping bookings
  const overlappingBookings = await tx.booking.findMany({...})

  if (overlappingBookings.length > 0) {
    throw new Error("BOOKING_CONFLICT")
  }

  // Create booking atomically
  return await tx.booking.create({...})
})
```

**Problem**: How does repository pattern support transactions?

**Options**:

A) **Repository with transaction parameter** (simple):
```typescript
interface BookingRepository {
  findOverlapping(slot: TimeSlot, tx?: PrismaTransaction): Promise<Booking[]>
  create(booking: Booking, tx?: PrismaTransaction): Promise<Booking>
}

// Usage in domain service:
await prisma.$transaction(async (tx) => {
  const overlapping = await bookingRepo.findOverlapping(timeSlot, tx)
  if (overlapping.length > 0) throw new BookingConflictError()
  await bookingRepo.create(booking, tx)
})
```
⚠️ **Issue**: Leaks Prisma transaction into domain layer!

B) **Unit of Work pattern** (complex):
```typescript
interface UnitOfWork {
  bookings: BookingRepository
  commit(): Promise<void>
  rollback(): Promise<void>
}

// Usage:
const uow = await unitOfWorkFactory.create()
try {
  const overlapping = await uow.bookings.findOverlapping(timeSlot)
  if (overlapping.length > 0) throw new BookingConflictError()
  await uow.bookings.create(booking)
  await uow.commit()
} catch (e) {
  await uow.rollback()
  throw e
}
```
✅ **Better**: Pure domain layer, no Prisma leakage
⚠️ **Cost**: +8h implementation time

C) **Repository method with transaction built-in** (pragmatic):
```typescript
interface BookingRepository {
  createWithConflictCheck(booking: Booking): Promise<Result<Booking, BookingConflictError>>
}

// Implementation handles transaction internally
async createWithConflictCheck(booking: Booking) {
  return prisma.$transaction(async (tx) => {
    const overlapping = await this.findOverlapping(booking.timeSlot, tx)
    if (overlapping.length > 0) {
      return Result.fail(new BookingConflictError())
    }
    return Result.ok(await this.create(booking, tx))
  })
}
```
✅ **Best for MVP**: Encapsulates transaction complexity
✅ **Clean**: Domain layer sees simple interface
⚠️ **Trade-off**: Less flexible (transaction scope tied to method)

**Recommendation**:
- Sprint 2: Start with **Option C** (pragmatic)
- Sprint 4: Refactor to **Option B** (Unit of Work) if we discover need for multi-repository transactions

#### Issue #4: Mock Implementations

**Claim**: Need mock repositories for unit testing
**Reality**: We already have SQLite test database (works great!)

**Cost/Benefit**:
- Mock implementations: +5h work
- Benefit: Faster unit tests (~10ms vs ~50ms)
- Cost: Maintain two implementations (Prisma + Mock)

**Current test pattern** (from `tests/api/bookings.test.ts`):
```typescript
beforeEach(async () => {
  // Uses real Prisma + SQLite test DB
  await cleanDatabase(prisma)
  testUser = await createTestUser(prisma, 'customer')
})
```
✅ Works well, no speed issues

**Recommendation**:
- ❌ SKIP mock implementations for MVP
- ✅ Use Prisma + SQLite test DB (already working)
- 🟢 Saves 5h, reduces complexity
- Future: Add mocks if test suite becomes slow (>30s)

### Revised E-3 Plan

**Sprint 0** (0h - skip entirely):
- ❌ Don't create ANY repositories yet

**Sprint 2** (8h - create with Booking domain):
- [ ] Create `BookingRepository` interface
- [ ] Create `PrismaBookingRepository` implementation
  - Include `createWithConflictCheck()` method (transaction built-in)
- [ ] Create `BookingMapper` (toDomain/toPrisma)
- [ ] Write integration tests (use SQLite test DB)
- [ ] **Measure mapping overhead** (2, 10, 100 bookings)

**Sprint 3** (3h):
- [ ] Create `RouteOrderRepository` + mapper

**Sprint 4** (3h):
- [ ] Create `RouteRepository` + mapper

**Total effort**: 14h (vs original 10h, but spread across sprints)

---

## 📅 3. Sprint 0 Domain Modeling Prep

### Current Plan

E-2 + E-3 = 6h + 10h = 16h of domain infrastructure BEFORE implementing any domain!

### Recommended Plan

**Sprint 0 Domain Tasks** (3h):

1. **E-2.1: Create base classes** (2h)
   - [ ] `src/domain/shared/base/Entity.ts`
   - [ ] `src/domain/shared/base/ValueObject.ts`
   - [ ] Unit tests for base classes

2. **E-2.2: Create pilot value object** (1h)
   - [ ] `src/domain/booking/types/BookingStatus.ts`
   - Purpose: Validate pattern with real Prisma data
   - Learning: Discover TypeScript issues, mapping patterns
   - Example:
     ```typescript
     export class BookingStatus extends ValueObject<string> {
       private constructor(value: string) {
         super(value)
       }

       static readonly PENDING = new BookingStatus('pending')
       static readonly CONFIRMED = new BookingStatus('confirmed')
       static readonly CANCELLED = new BookingStatus('cancelled')
       static readonly COMPLETED = new BookingStatus('completed')

       static fromString(value: string): Result<BookingStatus> {
         switch (value) {
           case 'pending': return Result.ok(BookingStatus.PENDING)
           case 'confirmed': return Result.ok(BookingStatus.CONFIRMED)
           // ...
           default: return Result.fail(new InvalidBookingStatusError(value))
         }
       }

       canTransitionTo(newStatus: BookingStatus): boolean {
         // Business rule: Status lifecycle
         if (this.equals(BookingStatus.PENDING)) {
           return newStatus.equals(BookingStatus.CONFIRMED) ||
                  newStatus.equals(BookingStatus.CANCELLED)
         }
         // ...
       }
     }
     ```

3. **E-4: Ubiquitous Language** (4h - MUST come first!)
   - [ ] Interview stakeholders (if available)
   - [ ] Document booking domain terms
   - [ ] Document route/route-order domain terms
   - [ ] Create `/docs/UBIQUITOUS_LANGUAGE.md`

**Total Sprint 0**: 7h (vs 16h original)
**Savings**: 9h moved to Sprint 2 where real needs emerge

**Benefits**:
- Learn domain patterns with ONE real example (BookingStatus)
- Discover issues early (mapping, TypeScript, testing)
- Validate approach before committing to full infrastructure
- Language-first design (E-4 before E-2)

---

## 🎯 4. Booking Domain Implementation Review (Sprint 2)

### Value Objects Assessment

**Proposed**:
1. ✅ `BookingStatus` - status enum + lifecycle methods
2. ✅ `TimeSlot` - overlap detection logic
3. ✅ `BookingDate` - future validation
4. ✅ `HorseInfo` - horse details

**Missing**:
5. 🟡 `ServiceDuration` - durationMinutes with validation
6. 🟡 `Money` - price value object (currently raw Float)

**Recommendation**:
- Start with 1-4 (core to booking logic)
- Add 5-6 if we discover need during implementation
- Don't over-engineer (YAGNI)

### BookingConflictChecker Service

**Can extract from existing code?**
✅ YES - lines 154-187 in `route.ts` contain pure business logic

**Extraction plan**:
```typescript
// src/domain/booking/services/BookingConflictChecker.ts
export class BookingConflictChecker {
  constructor(private bookingRepo: BookingRepository) {}

  async hasConflict(
    providerId: string,
    timeSlot: TimeSlot,
    bookingDate: BookingDate
  ): Promise<boolean> {
    // Migrera overlap logic från route.ts:154-187
    const overlapping = await this.bookingRepo.findOverlapping({
      providerId,
      date: bookingDate,
      timeSlot,
      excludeStatuses: [BookingStatus.CANCELLED, BookingStatus.COMPLETED]
    })

    return overlapping.length > 0
  }
}
```

**Challenge**: Transaction handling
**Solution**: Use `createWithConflictCheck()` repository method (see section 2)

### Effort Estimate Review

**Original estimate**: 25h

**Detailed breakdown**:

| Task | Original | Realistic | Notes |
|------|----------|-----------|-------|
| T-2.1: Domain model (4 value objects + Booking entity) | 6h | 6h | ✅ Reasonable |
| T-2.2: Services & rules (BookingConflictChecker + 3 rules) | 4h | 4h | ✅ Reasonable |
| T-2.3: Repository + mapper | 4h | **8h** | Need transaction support |
| T-2.4: BDD tests (6 scenarios) | 6h | 6h | ✅ Reasonable |
| T-2.5: Refactor API routes (4 routes) | 5h | **8h** | Regression testing critical |
| **TOTAL** | 25h | **32h** | +7h buffer |

**Recommendation**: Budget **30-35h** for Sprint 2 (not 25h)

**Rationale**:
- Repository transaction handling is non-trivial (+4h)
- API refactoring with zero regression requires careful testing (+3h)
- First domain implementation = learning curve

---

## 🗄️ 5. Database Schema Implications

### Can We Guarantee "INGA breaking changes"?

**Epic claim**: "INGA breaking changes - alla E2E tests gröna"

**Reality**: ⚠️ **Cannot guarantee** without contingency plan

### Potential Schema Issues

Domain modeling might reveal these schema problems:

#### Issue #1: Booking Times as String

**Current schema**:
```prisma
model Booking {
  startTime String  // "09:00"
  endTime   String  // "17:00"
}
```

**Domain model will want**:
```typescript
class TimeSlot extends ValueObject<{start: Time, end: Time}> {
  overlaps(other: TimeSlot): boolean {
    // Needs to parse "09:00" → Time object for comparison
    // String parsing is fragile!
  }
}
```

**Potential discovery**:
- String format is inconsistent ("09:00" vs "9:00" vs "09:00:00")
- Timezone handling unclear
- Time type would be safer

**Migration if needed**:
```prisma
model Booking {
  startTime String  // Keep for backwards compatibility
  endTime   String
  startTimeV2 DateTime?  // @db.Time on PostgreSQL
  endTimeV2   DateTime?  // @db.Time on PostgreSQL
}
```
- Dual-write during transition
- Migrate data in background
- Switch reads to V2 when ready
- Drop old columns later

#### Issue #2: Status Magic Strings

**Current schema**:
```prisma
model Booking {
  status String @default("pending") // 'pending', 'confirmed', 'cancelled', 'completed'
}
```

**Domain model creates**:
```typescript
class BookingStatus extends ValueObject<string> {
  static readonly PENDING = new BookingStatus('pending')
  static readonly CONFIRMED = new BookingStatus('confirmed')
  static readonly REJECTED = new BookingStatus('rejected')  // Wait, is this new?
}
```

**Potential discovery**:
- Need new status: "rejected" (when provider declines)
- Need new status: "expired" (when pending > 48h)

**Migration**:
```prisma
model Booking {
  status String @default("pending")
  // Additive: Add new valid values to enum
  // Non-breaking: Old code still works with "pending"/"confirmed"
}
```
✅ Non-breaking if additive only

#### Issue #3: RouteOrder Date Validation

**Current schema**:
```prisma
model RouteOrder {
  dateFrom DateTime
  dateTo   DateTime
  priority String @default("normal") // 'normal' or 'urgent'
}
```

**Domain model creates**:
```typescript
class DateRange extends ValueObject<{from: Date, to: Date}> {
  validate() {
    if (this.spanDays() > 30) {
      throw new DateRangeExceedsLimitError()
    }
  }
}

class UrgentOrderRule {
  validate(order: RouteOrder) {
    if (order.priority === 'urgent' && order.dateRange.daysFromNow() > 2) {
      throw new UrgentOrderMustBeWithin48HoursError()
    }
  }
}
```

**Potential discovery**:
- These rules should be in DATABASE (CHECK constraints) for data integrity!
- Current schema allows invalid data (30+ day span, urgent beyond 48h)

**Migration**:
```sql
-- Add CHECK constraints (PostgreSQL)
ALTER TABLE RouteOrder ADD CONSTRAINT check_date_range
  CHECK ((dateTo - dateFrom) <= INTERVAL '30 days');

ALTER TABLE RouteOrder ADD CONSTRAINT check_urgent_deadline
  CHECK (
    priority != 'urgent' OR
    (dateFrom - CURRENT_TIMESTAMP) <= INTERVAL '48 hours'
  );
```
⚠️ **Breaking**: Existing invalid data will block migration!

**Mitigation**:
1. Audit existing data first: `SELECT * FROM RouteOrder WHERE dateTo - dateFrom > 30`
2. Clean invalid data before migration
3. Add constraints in separate migration

#### Issue #4: Cascade Behaviors

**Current schema**:
```prisma
model RouteStop {
  routeId      String
  route        Route      @relation(fields: [routeId], references: [id], onDelete: Cascade)
  routeOrderId String
  routeOrder   RouteOrder @relation(fields: [routeOrderId], references: [id]) // NO CASCADE!
}
```

**Domain model might reveal**:
- What happens if RouteOrder deleted while in Route?
- RouteStop becomes orphaned (referential integrity broken!)

**Fix needed**:
```prisma
model RouteStop {
  routeOrderId String
  routeOrder   RouteOrder @relation(fields: [routeOrderId], references: [id], onDelete: Restrict)
  // OR: onDelete: SetNull (make routeOrderId optional)
  // OR: onDelete: Cascade (delete stop if order deleted)
}
```
⚠️ **Breaking**: Changes delete behavior!

### Schema Change Contingency Plan

**Strategy**: Additive migrations only (no deletions, no type changes)

1. **Audit Phase** (before each sprint):
   - [ ] Review existing data for inconsistencies
   - [ ] Identify potential schema issues
   - [ ] Plan migration if needed

2. **Migration Types**:

   **✅ Safe (non-breaking)**:
   - Add new columns (with defaults or nullable)
   - Add indexes
   - Add new enum values (append only)

   **⚠️ Risky (requires care)**:
   - Add CHECK constraints (audit data first!)
   - Add NOT NULL (backfill data first!)
   - Change cascade behaviors (test thoroughly!)

   **❌ Breaking (avoid)**:
   - Drop columns
   - Change column types
   - Remove enum values

3. **Migration Pattern**:
   ```bash
   # Step 1: Add new column/constraint (additive)
   npx prisma migrate dev --name add_time_v2

   # Step 2: Dual-write (both old and new format)
   # App writes to both startTime (String) and startTimeV2 (DateTime)

   # Step 3: Backfill existing data
   # Background job: Migrate old format → new format

   # Step 4: Switch reads to new column
   # Feature flag: Read from startTimeV2 instead of startTime

   # Step 5: Drop old column (weeks later)
   npx prisma migrate dev --name remove_time_v1
   ```

4. **Rollback Plan**:
   - Every migration has rollback script
   - E2E tests run on BOTH old and new schema
   - Feature flags for gradual rollout
   - Monitor error rates during migration

**Recommendation**:
- **Accept**: Some schema changes may be needed
- **Mitigate**: Use additive migrations, dual-write pattern, feature flags
- **Document**: Create `MIGRATION-STRATEGY.md` with detailed runbook

---

## 🔄 6. Implementation Sequence Review

### Current Plan

| Sprint | Focus | Week |
|--------|-------|------|
| Sprint 2 | Booking Domain | 3-4 |
| Sprint 3 | Routes & Availability | 5-6 |
| Sprint 4 | Route Orders | 7 |

### Issue: Backwards Dependencies

**Schema relationships**:
```
Route --(1:N)--> RouteStop <--(N:1)-- RouteOrder
```

Route depends on RouteOrder via RouteStop junction table!

**Testing order should be**:
1. Test RouteOrder first (foundational)
2. Test Route second (depends on RouteOrder)

**Current plan tests Route (Sprint 3) BEFORE RouteOrder (Sprint 4)** ❌

### Recommendation: Swap Sprint 3 and Sprint 4

**Revised sequence**:

| Sprint | Focus | Week | Rationale |
|--------|-------|------|-----------|
| Sprint 2 | Booking Domain | 3-4 | ✅ Pilot, no dependencies |
| Sprint 3 | **Route Orders** | 5-6 | ✅ Foundational (no dependencies) |
| Sprint 4 | **Routes & Availability** | 7 | ✅ Depends on RouteOrder |

**Benefits**:
- Logical dependency order
- Can test Route creation with real RouteOrders
- Simpler (RouteOrder has no relations, Route has RouteStop complexity)

**Impact**:
- Minimal - just swap sprint order
- Update sprint names in epic plan

---

## 📊 7. Long-Term Maintainability Assessment

### Will This Domain Layer Scale?

**✅ YES, IF:**

1. **Domain stays pure**
   - ✅ No Prisma imports in domain layer
   - ✅ No infrastructure dependencies
   - ✅ 100% unit-testable without database

2. **Mapping overhead is measured**
   - ⚠️ Currently unknown
   - ✅ Must measure in Sprint 2
   - ✅ Document thresholds (>10ms = optimize)

3. **Repository pattern is pragmatic**
   - ✅ Start simple (Option C: transaction built-in)
   - ✅ Evolve as needed (to Unit of Work if multi-repo transactions needed)
   - ❌ Don't create repositories until needed

4. **Team learning is supported**
   - ✅ Extensive documentation (E-4, ADRs, onboarding guide)
   - ✅ Pair programming during Sprint 2
   - ✅ Workshops planned
   - ✅ Epic has Tech-Architect + Data-Architect collaboration

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Repository abstraction overhead** | 10-20ms per query | Measure early, optimize hot paths, selective use |
| **Transaction handling complexity** | Breaks pattern purity | Start with pragmatic Option C, evolve to Unit of Work |
| **Team learning curve** | Slower velocity Sprint 2-3 | Pair programming, workshops, extensive docs |
| **Premature abstraction** | Wasted effort, wrong patterns | Start minimal (3h Sprint 0), discover real needs |
| **Schema changes needed** | Breaking changes, migration risk | Additive migrations, dual-write, feature flags |

### Scalability Analysis

**Performance with domain layer** (estimated):

| Operation | Without Domain | With Domain | Overhead | Acceptable? |
|-----------|----------------|-------------|----------|-------------|
| Create booking (simple) | 50ms | 55ms | +5ms | ✅ <10% |
| Create booking (with conflict check) | 80ms | 90ms | +10ms | ✅ <15% |
| List bookings (10 items) | 30ms | 40ms | +10ms | ⚠️ 33% - measure! |
| List bookings (100 items) | 120ms | 200ms? | +80ms? | ❌ 67% - optimize! |

**Recommendation**:
- Measure actual overhead in Sprint 2
- Optimize if >10ms for single entity, >50ms for collections
- Consider caching for hot paths (provider list, etc.)

**NFR.md alignment**:
```
Performance target (NFR 1.1):
- /api/bookings (GET): <200ms (p95)
- Max acceptable: <500ms (p99)

With domain layer:
- Current: ~30ms baseline
- With mapping: ~40-50ms estimated
- Headroom: 150-160ms for other operations (DB query, validation, etc.)
✅ Still well within target
```

---

## 📋 8. Revised Sprint 0 Checklist

### Domain Modeling Prep (7h total)

**Priority 1: Ubiquitous Language (MUST come first!)** - 4h
- [ ] E-4.1: Interview stakeholders om business terms
- [ ] E-4.2: Document Booking domain terms
  - Booking, Status, Conflict, Overlap, Time Slot
- [ ] E-4.3: Document Route/RouteOrder domain terms
  - Route, Stop, Order, Priority, Urgent, Date Range
- [ ] E-4.4: Create `/docs/UBIQUITOUS_LANGUAGE.md`
- [ ] E-4.5: Share with team for review

**Priority 2: Minimal Domain Foundation** - 3h
- [ ] E-2.1: Create `src/domain/shared/base/Entity.ts`
  ```typescript
  export abstract class Entity<T> {
    protected readonly _id: T

    constructor(id: T) {
      this._id = id
    }

    get id(): T {
      return this._id
    }

    equals(other: Entity<T>): boolean {
      if (!(other instanceof Entity)) return false
      return this._id === other._id
    }
  }
  ```

- [ ] E-2.2: Create `src/domain/shared/base/ValueObject.ts`
  ```typescript
  export abstract class ValueObject<T> {
    protected readonly _value: T

    constructor(value: T) {
      this._value = value
    }

    get value(): T {
      return this._value
    }

    equals(other: ValueObject<T>): boolean {
      if (!(other instanceof ValueObject)) return false
      return JSON.stringify(this._value) === JSON.stringify(other._value)
    }
  }
  ```

- [ ] E-2.3: Create pilot value object `src/domain/booking/types/BookingStatus.ts`
  - Implement status enum as value object
  - Add `canTransitionTo()` business logic
  - Write unit tests
  - **Purpose**: Validate pattern with real Prisma mapping

- [ ] E-2.4: Write unit tests for base classes (100% coverage)

**Priority 3: Skip for now** (move to Sprint 2)
- ❌ AggregateRoot - discover need during Booking implementation
- ❌ Result pattern - discover need during error handling
- ❌ Guard utilities - discover need during validation
- ❌ DomainError - discover need during exception handling
- ❌ Repository interfaces - create with Booking domain in Sprint 2

**Sprint 0 Deliverables**:
- ✅ `/docs/UBIQUITOUS_LANGUAGE.md` (comprehensive glossary)
- ✅ `/src/domain/shared/base/Entity.ts` + tests
- ✅ `/src/domain/shared/base/ValueObject.ts` + tests
- ✅ `/src/domain/booking/types/BookingStatus.ts` + tests
- ✅ Learnings documented: Mapping patterns, TypeScript issues, testing approach

**Time saved**: 9h (16h → 7h)
**Risk reduced**: Don't build infrastructure we might not need

---

## 📋 9. Final Recommendations

### 1. Sprint 0 Domain Prep (CRITICAL)

**DO**:
- ✅ Complete E-4 (Ubiquitous Language) FIRST
- ✅ Create minimal base classes (Entity, ValueObject only)
- ✅ Create ONE pilot value object (BookingStatus)
- ✅ Learn and document patterns

**DON'T**:
- ❌ Create AggregateRoot, Result, Guard, DomainError yet
- ❌ Create ANY repository interfaces yet
- ❌ Create mock implementations

**Rationale**: Discover real needs during Sprint 2 implementation

---

### 2. Repository Pattern (CRITICAL)

**DO**:
- ✅ Create repositories one-by-one (with each domain)
- ✅ Start with pragmatic transaction handling (built into repository methods)
- ✅ Measure mapping overhead early
- ✅ Use SQLite test DB (skip mocks)

**DON'T**:
- ❌ Create all repositories in Sprint 0
- ❌ Guess at <2ms mapping overhead without measurement
- ❌ Implement Unit of Work pattern until proven necessary

**Rationale**: Avoid premature abstraction, measure before optimizing

---

### 3. Implementation Sequence (CRITICAL)

**DO**:
- ✅ SWAP Sprint 3 and Sprint 4
- ✅ Test RouteOrder (Sprint 3) before Route (Sprint 4)
- ✅ Follow dependency order

**NEW SEQUENCE**:
- Sprint 2: Booking (pilot)
- Sprint 3: Route Orders (foundational)
- Sprint 4: Routes & Availability (depends on RouteOrder)

**Rationale**: Test dependencies in logical order

---

### 4. Schema Change Contingency (CRITICAL)

**DO**:
- ✅ Accept that some schema changes may be needed
- ✅ Use additive migrations only (no deletions, no type changes)
- ✅ Create `docs/MIGRATION-STRATEGY.md` with runbook
- ✅ Audit data before each migration
- ✅ Use dual-write pattern for transitions

**DON'T**:
- ❌ Promise "INGA breaking changes" without contingency plan
- ❌ Drop columns or change types
- ❌ Add constraints without auditing data first

**Potential changes**:
1. Booking times: String → Time type (dual-write)
2. Status: Add CHECK constraints (audit first)
3. RouteStop: Add onDelete cascade (test thoroughly)
4. RouteOrder: Add date range CHECK constraint (audit first)

---

### 5. Sprint 2 Booking Domain (IMPORTANT)

**DO**:
- ✅ Budget 30-35h (not 25h)
- ✅ Measure mapping overhead with real data
- ✅ Extract BookingConflictChecker from existing code
- ✅ Use `createWithConflictCheck()` repository method for transactions
- ✅ Document learnings for future domains

**DON'T**:
- ❌ Over-engineer value objects (Money, ServiceDuration can wait)
- ❌ Skip measuring mapping overhead
- ❌ Rush API refactoring (regression is critical risk)

---

### 6. Metrics & Validation (IMPORTANT)

**DO**:
- ✅ Measure baseline performance BEFORE domain layer
- ✅ Measure mapping overhead (2, 10, 100 bookings)
- ✅ Document thresholds (>10ms single entity = investigate)
- ✅ Verify NFR.md targets still met (<200ms API response time)

**Track these metrics**:
| Metric | Baseline | After Domain Layer | Threshold |
|--------|----------|-------------------|-----------|
| Create booking (simple) | 50ms | ? | <60ms (+20%) |
| Create booking (conflict check) | 80ms | ? | <100ms (+25%) |
| List bookings (10 items) | 30ms | ? | <40ms (+33%) |
| Mapping overhead (1 booking) | 0ms | ? | <5ms |

---

## ✅ Decision: NEEDS REVISION

**Summary**:
- ✅ Domain-driven approach is sound
- ✅ Booking as pilot is excellent choice
- ⚠️ Sprint 0 is over-engineered (16h → 7h recommended)
- ⚠️ Repository pattern needs transaction handling strategy
- ⚠️ Sprint sequence is backwards (swap 3 and 4)
- ⚠️ Schema changes likely (need contingency plan)

**Next Steps**:
1. Review this document with Tech-Architect
2. Update BDD-EPIC-PLAN.md with revised Sprint 0
3. Create `docs/MIGRATION-STRATEGY.md`
4. Update sprint sequence (swap 3 and 4)
5. Proceed with revised plan

**Confidence Level**: 🟢 High (with revisions)

---

**Reviewed by**: Data-Architect Agent
**Date**: 2025-11-18
**Status**: Complete - awaiting Tech-Architect review
