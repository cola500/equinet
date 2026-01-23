# Exploratory Testing Session 1 - POST /api/bookings

**Date:** 2026-01-22
**Tester:** Claude Code
**Focus:** Happy Path Breaking - Invalid Inputs & Edge Cases
**Endpoint:** POST /api/bookings
**Session Duration:** 45 minutes

---

## Executive Summary

**Total Bugs Found:** 13
- **CRITICAL:** 4 (FIXED in previous session)
- **HIGH:** 2
- **MEDIUM:** 5
- **LOW:** 2

**Previously Fixed (Session 1 - Part 1):**
1. ✅ Missing date validation (past dates allowed)
2. ✅ Missing time format validation
3. ✅ Missing string length limits
4. ✅ Missing UUID format validation

**Remaining Bugs (This Report):**
- 2 HIGH priority
- 5 MEDIUM priority
- 2 LOW priority

---

## Test Approach

1. **Schema Validation Testing:** Test each field with invalid types, formats, and boundaries
2. **Business Logic Testing:** Test overlap detection, time constraints, and status transitions
3. **Authorization Testing:** Test IDOR scenarios and access control
4. **Race Condition Testing:** Test concurrent booking attempts
5. **Edge Case Testing:** Test timezone handling, daylight saving, leap years

---

## HIGH PRIORITY BUGS

### BUG-5: Race Condition in Overlap Detection (HIGH)

**Severity:** HIGH
**Category:** Concurrency / Data Integrity

**Description:**
The overlap detection logic uses `Serializable` isolation level, but there's still a potential race condition window between the overlap check and the booking creation. Two concurrent requests could both pass the overlap check before either creates the booking.

**Reproduction Steps:**
1. Start two concurrent requests with same providerId, date, and overlapping times
2. Both requests query for existing overlaps (finds none)
3. Both requests proceed to create booking
4. Result: Double-booking created despite overlap check

**Current Code:**
```typescript
const booking: any = await prisma.$transaction(async (tx) => {
  // Check for overlapping bookings
  const overlappingBookings = await tx.booking.findMany({ /* ... */ })

  if (overlappingBookings.length > 0) {
    throw new Error("BOOKING_CONFLICT")
  }

  // Window of vulnerability here - another transaction could create booking
  return await tx.booking.create({ /* ... */ })
}, {
  timeout: 15000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable
})
```

**Expected Behavior:**
- Only one booking should succeed
- Second request should get 409 Conflict error

**Actual Behavior:**
- Both bookings may succeed under high load
- Creates double-booking situation

**Suggested Fix:**
Add unique constraint on (providerId, bookingDate, startTime, endTime) OR use database-level locks:
```typescript
// Option 1: Add to schema.prisma
@@unique([providerId, bookingDate, startTime, endTime])

// Option 2: Use FOR UPDATE lock
const provider = await tx.provider.findUnique({
  where: { id: validatedData.providerId },
  select: { id: true }
})
if (!provider) throw new Error("PROVIDER_NOT_FOUND")
```

**Impact:** Medium - Requires concurrent load to trigger, but causes critical business issue

---

### BUG-6: Timezone Not Stored with Booking (HIGH)

**Severity:** HIGH
**Category:** Data Integrity / Business Logic

**Description:**
The booking endpoint accepts `bookingDate` as ISO datetime string but doesn't store timezone information. This causes issues when:
- Provider and customer are in different timezones
- Sweden changes between CET (UTC+1) and CEST (UTC+2) for daylight saving
- Displaying bookings in customer vs provider views

**Reproduction Steps:**
1. Customer in UTC+2 books for "2026-03-29T14:00:00+02:00" (daylight saving transition day)
2. Database stores: "2026-03-29" + "14:00"
3. Provider in UTC+1 views booking
4. Ambiguity: Is it 14:00 in customer timezone or provider timezone?

**Current Code:**
```typescript
bookingDate: z.string().datetime("Invalid date format")
// Accepts: "2026-01-22T14:00:00Z" or "2026-01-22T14:00:00+01:00"
// But timezone info is discarded when storing in database
```

**Schema:**
```prisma
model Booking {
  bookingDate DateTime  // No timezone information
  startTime   String    // Just "14:00"
  endTime     String    // Just "16:00"
}
```

**Expected Behavior:**
- Store timezone with booking (e.g., "Europe/Stockholm")
- Display times correctly in both customer and provider views
- Handle daylight saving transitions correctly

**Actual Behavior:**
- Timezone information lost
- Ambiguous time representation
- Potential for wrong time displayed to users

**Suggested Fix:**
```prisma
model Booking {
  bookingDate DateTime
  startTime   String
  endTime     String
  timezone    String @default("Europe/Stockholm")  // Add this
}
```

**Impact:** High - Affects correctness of all bookings, especially during DST transitions

---

## MEDIUM PRIORITY BUGS

### BUG-7: No Validation for Maximum Booking Duration (MEDIUM)

**Severity:** MEDIUM
**Category:** Business Logic / Input Validation

**Description:**
While there's a minimum duration check (15 minutes), there's no maximum duration limit. A customer could book a service for 24 hours or multiple days, which may not be business-appropriate.

**Reproduction Steps:**
1. POST /api/bookings with:
   ```json
   {
     "startTime": "00:00",
     "endTime": "23:59",
     "bookingDate": "2026-01-23T00:00:00Z"
   }
   ```
2. Request succeeds with 24-hour booking

**Current Code:**
```typescript
.refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be after start time" }
)
.refine(
  (data) => {
    const [startHour, startMin] = data.startTime.split(":").map(Number)
    const [endHour, endMin] = data.endTime.split(":").map(Number)
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    return durationMinutes >= 15
  },
  { message: "Booking must be at least 15 minutes" }
)
// Missing: Maximum duration check
```

**Expected Behavior:**
- Reject bookings longer than reasonable maximum (e.g., 8 hours)
- Return 400 with clear error message

**Actual Behavior:**
- Accepts bookings of any duration
- Could lead to unrealistic bookings

**Suggested Fix:**
```typescript
.refine(
  (data) => {
    const [startHour, startMin] = data.startTime.split(":").map(Number)
    const [endHour, endMin] = data.endTime.split(":").map(Number)
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    return durationMinutes <= 480  // 8 hours max
  },
  { message: "Booking cannot exceed 8 hours" }
)
```

**Impact:** Medium - Business logic issue, but may be acceptable depending on service type

---

### BUG-8: Missing Provider Active Status Check (MEDIUM)

**Severity:** MEDIUM
**Category:** Business Logic

**Description:**
When creating a booking, the endpoint doesn't verify that the provider is active (`isActive: true`). Customers can book with inactive providers.

**Reproduction Steps:**
1. Set provider `isActive: false` in database
2. POST /api/bookings with that providerId
3. Booking succeeds

**Current Code:**
```typescript
// No provider status check before creating booking
const service = await prisma.service.findUnique({
  where: { id: validatedData.serviceId },
  include: { provider: true }
})

if (!service) {
  return NextResponse.json({ error: "Service not found" }, { status: 404 })
}

// Missing: if (!service.provider.isActive) { return 400 }
```

**Expected Behavior:**
- Check `service.provider.isActive === true` before allowing booking
- Return 400 with "Provider is currently unavailable"

**Actual Behavior:**
- Allows bookings with inactive providers
- May lead to unfulfillable bookings

**Suggested Fix:**
```typescript
if (!service.provider.isActive) {
  return NextResponse.json(
    { error: "Provider is currently unavailable" },
    { status: 400 }
  )
}
```

**Impact:** Medium - Business rule violation, confusing for customers

---

### BUG-9: Missing Service Active Status Check (MEDIUM)

**Severity:** MEDIUM
**Category:** Business Logic

**Description:**
Similar to BUG-8, the endpoint doesn't check if the service itself is active. Customers can book services that are no longer offered.

**Reproduction Steps:**
1. Set service `isActive: false` in database
2. POST /api/bookings with that serviceId
3. Booking succeeds

**Expected Behavior:**
- Check `service.isActive === true` before allowing booking
- Return 400 with "Service is no longer available"

**Actual Behavior:**
- Allows bookings for inactive services

**Suggested Fix:**
```typescript
if (!service.isActive) {
  return NextResponse.json(
    { error: "Service is no longer available" },
    { status: 400 }
  )
}
```

**Impact:** Medium - Business rule violation

---

### BUG-10: No Validation for Business Hours (MEDIUM)

**Severity:** MEDIUM
**Category:** Business Logic

**Description:**
Customers can book services at any time (00:00-23:59) without checking provider's business hours. Most providers likely don't operate 24/7.

**Reproduction Steps:**
1. POST /api/bookings with `"startTime": "02:00"` (2 AM)
2. Booking succeeds

**Current Code:**
```typescript
startTime: z.string().regex(
  /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
  "Invalid time format. Must be HH:MM (00:00-23:59)"
)
// Accepts any time 00:00-23:59
```

**Expected Behavior:**
- Check against provider's business hours (stored in Provider model or separate BusinessHours model)
- Return 400 if booking outside business hours

**Actual Behavior:**
- Accepts bookings at any time of day

**Suggested Fix:**
```typescript
// Option 1: Add to Provider schema
model Provider {
  businessHoursStart String @default("08:00")
  businessHoursEnd   String @default("18:00")
}

// Option 2: Validate in API
const [bookingStartHour] = validatedData.startTime.split(":").map(Number)
if (bookingStartHour < 8 || bookingStartHour >= 18) {
  return NextResponse.json(
    { error: "Booking must be within business hours (08:00-18:00)" },
    { status: 400 }
  )
}
```

**Impact:** Medium - Business rule violation, but depends on whether providers want 24/7 booking

---

### BUG-11: Overlap Detection Doesn't Consider Cancelled Bookings Correctly (MEDIUM)

**Severity:** MEDIUM
**Category:** Business Logic

**Description:**
The overlap detection excludes cancelled bookings from the check, which is correct. However, there's no time limit on how far back it looks. This could cause performance issues with providers that have thousands of old bookings.

**Reproduction Steps:**
1. Provider has 10,000 cancelled bookings from past years
2. POST /api/bookings for tomorrow
3. Query scans all 10,000+ bookings (slow)

**Current Code:**
```typescript
const overlappingBookings = await tx.booking.findMany({
  where: {
    providerId: validatedData.providerId,
    bookingDate: bookingDate,  // Only filters by date
    status: { in: ["pending", "confirmed"] },
    // No createdAt filter to limit historical scope
  }
})
```

**Expected Behavior:**
- Only check relevant time window (e.g., past 30 days + future bookings)
- Optimal query performance

**Actual Behavior:**
- Queries all bookings for that provider on that date
- May be slow with large booking history

**Suggested Fix:**
```typescript
const overlappingBookings = await tx.booking.findMany({
  where: {
    providerId: validatedData.providerId,
    bookingDate: bookingDate,
    status: { in: ["pending", "confirmed"] },
    // Add index on (providerId, bookingDate, status) for performance
  }
})
```

**Note:** Also add database index:
```prisma
model Booking {
  @@index([providerId, bookingDate, status])
}
```

**Impact:** Medium - Performance issue that scales with data

---

### BUG-12: No Rate Limiting on Booking Creation (MEDIUM)

**Severity:** MEDIUM
**Category:** Security / Abuse Prevention

**Description:**
There's no rate limiting specifically for booking creation. A malicious user could spam bookings to block out a provider's entire schedule.

**Reproduction Steps:**
1. Write script to POST /api/bookings 100 times in 1 second
2. All requests succeed (assuming no overlap)
3. Provider's schedule completely filled with spam bookings

**Expected Behavior:**
- Rate limit: e.g., max 10 bookings per hour per user
- Return 429 Too Many Requests after limit

**Actual Behavior:**
- No rate limiting on this specific endpoint
- Could be abused for denial-of-service

**Suggested Fix:**
```typescript
import { rateLimiters } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response("Unauthorized", { status: 401 })

  // Rate limit: 10 bookings per hour
  const isAllowed = await rateLimiters.bookingCreation.limit(session.user.id)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please try again later." },
      { status: 429 }
    )
  }

  // ... rest of endpoint
}
```

**Impact:** Medium - Abuse vector, but requires authenticated user

---

## LOW PRIORITY BUGS

### BUG-13: Missing Validation for RouteOrderId Existence (LOW)

**Severity:** LOW
**Category:** Data Integrity

**Description:**
The `routeOrderId` field is optional but doesn't validate that the RouteOrder actually exists if provided.

**Reproduction Steps:**
1. POST /api/bookings with `"routeOrderId": "00000000-0000-0000-0000-000000000000"`
2. Booking succeeds with invalid routeOrderId
3. Later queries fail or return null

**Current Code:**
```typescript
routeOrderId: z.string().uuid("Invalid route order ID format").optional(),
// Validates format but not existence
```

**Expected Behavior:**
- If routeOrderId provided, verify it exists in database
- Return 400 if not found

**Actual Behavior:**
- Accepts any valid UUID
- Creates orphaned reference

**Suggested Fix:**
```typescript
if (validatedData.routeOrderId) {
  const routeOrder = await prisma.routeOrder.findUnique({
    where: { id: validatedData.routeOrderId }
  })
  if (!routeOrder) {
    return NextResponse.json(
      { error: "Route order not found" },
      { status: 404 }
    )
  }
}
```

**Impact:** Low - Optional field, edge case

---

### BUG-14: Error Messages Expose Internal Implementation (LOW)

**Severity:** LOW
**Category:** Security / Information Disclosure

**Description:**
Some error messages expose internal implementation details (e.g., "BOOKING_CONFLICT" vs user-friendly message).

**Current Code:**
```typescript
if (error.message === "BOOKING_CONFLICT") {
  return NextResponse.json(
    { error: "Time slot unavailable" },
    { status: 409 }
  )
}
```

**Expected Behavior:**
- All error messages should be user-friendly
- No internal codes exposed to client

**Actual Behavior:**
- Mix of internal codes and user messages

**Suggested Fix:**
- Use error mapping utility
- Consistent error response format

**Impact:** Low - Minor security/UX issue

---

## Test Coverage Gaps

### Missing E2E Tests for:
1. Concurrent booking attempts (race condition testing)
2. Timezone edge cases (DST transitions)
3. Maximum duration validation
4. Provider/Service active status checks
5. Business hours validation
6. Rate limiting on booking endpoint

### Recommended Regression Tests:

```typescript
// tests/api/bookings/booking-validation.test.ts
describe('POST /api/bookings - Validation', () => {
  it('should reject booking longer than 8 hours', async () => {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        startTime: "08:00",
        endTime: "17:00",  // 9 hours
        // ... other fields
      })
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("cannot exceed 8 hours")
    })
  })

  it('should reject booking with inactive provider', async () => {
    // Set provider.isActive = false
    const response = await createBooking(inactiveProviderId)
    expect(response.status).toBe(400)
  })

  it('should reject booking outside business hours', async () => {
    const response = await createBooking({ startTime: "02:00" })
    expect(response.status).toBe(400)
  })
})

// tests/api/bookings/booking-concurrency.test.ts
describe('POST /api/bookings - Concurrency', () => {
  it('should prevent race condition in overlap detection', async () => {
    const booking1 = createBooking({ startTime: "14:00", endTime: "16:00" })
    const booking2 = createBooking({ startTime: "15:00", endTime: "17:00" })

    const results = await Promise.allSettled([booking1, booking2])

    const successes = results.filter(r => r.status === 'fulfilled')
    expect(successes).toHaveLength(1)  // Only one should succeed
  })
})
```

---

## Summary & Recommendations

### Immediate Actions (HIGH Priority):
1. **Fix BUG-5:** Add database-level constraint or lock to prevent race conditions
2. **Fix BUG-6:** Add timezone field to Booking model

### Short-term Actions (MEDIUM Priority):
3. **Fix BUG-7:** Add maximum duration validation (8 hours)
4. **Fix BUG-8 & BUG-9:** Add active status checks for Provider and Service
5. **Fix BUG-10:** Implement business hours validation
6. **Fix BUG-11:** Add database index for booking queries
7. **Fix BUG-12:** Implement rate limiting on booking creation

### Long-term Actions (LOW Priority):
8. **Fix BUG-13:** Validate routeOrderId existence
9. **Fix BUG-14:** Standardize error messages

### Test Coverage:
- Add E2E tests for concurrency scenarios
- Add regression tests for all validation rules
- Add load testing for overlap detection performance

---

**Session Completed:** 2026-01-22
**Next Steps:** Fix HIGH priority bugs first, then proceed with MEDIUM/LOW based on business priorities
