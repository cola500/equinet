import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks -- boundaries only: DB, auth, rate-limit, feature-flags, logger
// DueForServiceCalculator runs for real (pure domain logic, no side effects)
// ---------------------------------------------------------------------------

const { mockGetAuthUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockPrisma: {
    provider: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    horseServiceInterval: { findMany: vi.fn() },
    customerHorseServiceInterval: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: mockGetAuthUser,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET } from './route'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { rateLimiters } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_USER_ID = 'a0000000-0000-4000-a000-000000000001'
const PROVIDER_ID = 'a0000000-0000-4000-a000-000000000002'
const HORSE_ID = 'a0000000-0000-4000-a000-000000000003'
const SERVICE_ID = 'a0000000-0000-4000-a000-000000000004'
const CUSTOMER_ID = 'a0000000-0000-4000-a000-000000000005'

function makeRequest(filter?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/provider/due-for-service')
  if (filter) url.searchParams.set('filter', filter)
  return new NextRequest(url.toString())
}

function makeProviderAuth() {
  return {
    id: PROVIDER_USER_ID,
    email: 'provider@example.com',
    userType: 'provider',
    isAdmin: false,
    providerId: PROVIDER_ID,
    stableId: null,
    authMethod: 'supabase' as const,
  }
}

/** Completed booking 90 days ago (overdue for 8-week interval) */
function makeOverdueBooking() {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  return {
    horseId: HORSE_ID,
    serviceId: SERVICE_ID,
    bookingDate: ninetyDaysAgo,
    horse: { id: HORSE_ID, name: 'Blansen' },
    customer: { firstName: 'Test', lastName: 'Testsson' },
    service: { id: SERVICE_ID, name: 'Hovslagning Standard', recommendedIntervalWeeks: 8 },
  }
}

/** Completed booking 3 days ago (ok for 8-week interval) */
function makeRecentBooking() {
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  return {
    horseId: 'a0000000-0000-4000-a000-000000000010',
    serviceId: SERVICE_ID,
    bookingDate: threeDaysAgo,
    horse: { id: 'a0000000-0000-4000-a000-000000000010', name: 'Stjärna' },
    customer: { firstName: 'Test', lastName: 'Testsson' },
    service: { id: SERVICE_ID, name: 'Hovslagning Standard', recommendedIntervalWeeks: 8 },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/provider/due-for-service (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(rateLimiters.api).mockResolvedValue(true as never)
    mockGetAuthUser.mockResolvedValue(makeProviderAuth())
    mockPrisma.provider.findUnique.mockResolvedValue({ id: PROVIDER_ID })
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.horseServiceInterval.findMany.mockResolvedValue([])
    mockPrisma.customerHorseServiceInterval.findMany.mockResolvedValue([])
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a provider', async () => {
    mockGetAuthUser.mockResolvedValue({
      ...makeProviderAuth(),
      userType: 'customer',
      providerId: null,
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
  })

  it('returns 404 when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const res = await GET(makeRequest())

    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(429)
  })

  it('returns 404 when provider profile not found', async () => {
    mockPrisma.provider.findUnique.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(404)
  })

  it('returns empty items when no completed bookings', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([])

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toEqual([])
  })

  it('returns overdue horse when last service was 90 days ago with 8-week interval', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([makeOverdueBooking()])

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].horseName).toBe('Blansen')
    expect(data.items[0].status).toBe('overdue')
    expect(data.items[0].serviceName).toBe('Hovslagning Standard')
    expect(data.items[0].intervalWeeks).toBe(8)
    expect(data.items[0].daysUntilDue).toBeLessThan(0) // overdue = negative days
  })

  it('filter=overdue returns only overdue horses', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      makeOverdueBooking(),
      makeRecentBooking(),
    ])

    const res = await GET(makeRequest('overdue'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].horseName).toBe('Blansen')
    expect(data.items[0].status).toBe('overdue')
  })

  it('filter=all returns all horses regardless of status', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      makeOverdueBooking(),
      makeRecentBooking(),
    ])

    const res = await GET(makeRequest('all'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(2)
  })

  it('respects horse-specific interval override when computing status', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([makeOverdueBooking()])
    // Override interval to 20 weeks — horse should now be "ok" (90 days < 20 weeks = 140 days)
    mockPrisma.horseServiceInterval.findMany.mockResolvedValue([
      { horseId: HORSE_ID, serviceId: SERVICE_ID, revisitIntervalWeeks: 20 },
    ])

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].status).toBe('ok')
  })
})
