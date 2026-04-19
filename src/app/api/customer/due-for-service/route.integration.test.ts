import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks -- boundaries only: auth, rate-limit, feature-flags, DB, logger
// DueForServiceService + DueForServiceCalculator run for real
// ---------------------------------------------------------------------------

const { mockGetAuthUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockPrisma: {
    horse: { findFirst: vi.fn() },
    booking: { findMany: vi.fn() },
    horseServiceInterval: { findMany: vi.fn() },
    customerHorseServiceInterval: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: mockGetAuthUser,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
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
import { auth } from '@/lib/auth-server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_USER_ID = 'a0000000-0000-4000-a000-000000000001'
const HORSE_ID = 'a0000000-0000-4000-a000-000000000003'
const SERVICE_ID = 'a0000000-0000-4000-a000-000000000004'

function makeRequest(horseId?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/customer/due-for-service')
  if (horseId) url.searchParams.set('horseId', horseId)
  return new NextRequest(url.toString())
}

function makeCustomerSession() {
  return {
    user: {
      id: CUSTOMER_USER_ID,
      email: 'customer@example.com',
      userType: 'customer',
      isAdmin: false,
      providerId: null,
    },
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
    service: { id: SERVICE_ID, name: 'Hovslagning Standard', recommendedIntervalWeeks: 8 },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/customer/due-for-service (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(rateLimiters.api).mockResolvedValue(true as never)
    vi.mocked(auth).mockResolvedValue(makeCustomerSession() as never)
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.horseServiceInterval.findMany.mockResolvedValue([])
    mockPrisma.customerHorseServiceInterval.findMany.mockResolvedValue([])
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a customer', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        userType: 'provider',
        email: 'p@x.com',
        isAdmin: false,
        providerId: 'prov-1',
      },
    } as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(429)
  })

  it('returns empty items when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toEqual([])
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
    expect(data.items[0].intervalWeeks).toBe(8)
  })

  it('returns 400 for invalid horseId format', async () => {
    const res = await GET(makeRequest('not-a-uuid'))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('hast-ID')
  })

  it('returns 404 when horseId does not belong to customer', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue(null)

    const res = await GET(makeRequest(HORSE_ID))

    expect(res.status).toBe(404)
  })

  it('returns items for specific horse when horseId is valid and owned', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({ id: HORSE_ID })
    mockPrisma.booking.findMany.mockResolvedValue([makeOverdueBooking()])

    const res = await GET(makeRequest(HORSE_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].horseId).toBe(HORSE_ID)
  })
})
