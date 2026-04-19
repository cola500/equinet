/**
 * Integration tests for GET /api/provider/insights
 *
 * Route uses old auth pattern (auth from @/lib/auth-server, not withApiHandler).
 * All in-memory calculations (KPIs, service breakdown, time heatmap,
 * customer retention) run for real — only Prisma and auth/cache are mocked.
 *
 * Coverage-gap (UI, framtida component-test):
 * - KPI-etikett-rendering (Avbokningsgrad, No-show-grad etc.)
 * - Chart-rendering (Populäraste tjänster, tider, Kundretention)
 * - Aktiv-knapp CSS-klass vid periodval
 * - Info-popover-interaktion (redan skip:at i E2E)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockGetCached, mockSetCached } = vi.hoisted(() => ({
  mockPrisma: {
    provider: { findFirst: vi.fn() },
    booking: { findMany: vi.fn() },
  },
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/cache/provider-stats-cache', () => ({
  getCachedProviderInsights: mockGetCached,
  setCachedProviderInsights: mockSetCached,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET } from './route'
import { auth } from '@/lib/auth-server'
import { rateLimiters } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_USER_ID = 'a0000000-0000-4000-a000-000000000001'
const PROVIDER_ID = 'a0000000-0000-4000-a000-000000000002'
const CUSTOMER_ID = 'a0000000-0000-4000-a000-000000000003'
const SERVICE_ID = 'a0000000-0000-4000-a000-000000000004'

function makeRequest(months?: number): NextRequest {
  const url = new URL('http://localhost:3000/api/provider/insights')
  if (months !== undefined) url.searchParams.set('months', String(months))
  return new NextRequest(url.toString())
}

function makeProviderSession() {
  return {
    user: { id: PROVIDER_USER_ID, providerId: PROVIDER_ID },
  }
}

function makeCompletedBooking(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return {
    id: `booking-${daysAgo}`,
    bookingDate: date,
    startTime: '09:00',
    status: 'completed',
    customerId: CUSTOMER_ID,
    isManualBooking: false,
    service: { id: SERVICE_ID, name: 'Hovslagning Standard', price: 800 },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/provider/insights (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(makeProviderSession() as never)
    vi.mocked(rateLimiters.api).mockResolvedValue(true as never)
    mockPrisma.provider.findFirst.mockResolvedValue({ id: PROVIDER_ID })
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockGetCached.mockResolvedValue(null)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no providerId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: PROVIDER_USER_ID, providerId: null },
    } as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false as never)

    const res = await GET(makeRequest())

    expect(res.status).toBe(429)
  })

  it('returns 404 when provider profile not found', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(404)
  })

  it('returns cached data on cache hit', async () => {
    const cachedData = {
      serviceBreakdown: [],
      timeHeatmap: [],
      customerRetention: [],
      kpis: { cancellationRate: 5, noShowRate: 2, averageBookingValue: 750, uniqueCustomers: 10, manualBookingRate: 0 },
    }
    mockGetCached.mockResolvedValue(cachedData)

    const res = await GET(makeRequest(6))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.kpis.cancellationRate).toBe(5)
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled()
  })

  it('returns insights structure with KPIs on happy path', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      makeCompletedBooking(10),
      makeCompletedBooking(20),
    ])

    const res = await GET(makeRequest(6))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.kpis).toBeDefined()
    expect(data.kpis.cancellationRate).toBe(0) // no cancelled bookings
    expect(data.kpis.averageBookingValue).toBe(800)
    expect(data.kpis.uniqueCustomers).toBe(1)
    expect(data.serviceBreakdown).toBeDefined()
    expect(data.timeHeatmap).toBeDefined()
    expect(data.customerRetention).toBeDefined()
  })

  it('computes non-zero cancellation rate when cancelled bookings present', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      makeCompletedBooking(10),
      {
        ...makeCompletedBooking(15),
        id: 'cancelled-1',
        status: 'cancelled',
      },
    ])

    const res = await GET(makeRequest(6))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.kpis.cancellationRate).toBe(50) // 1/2 = 50%
  })

  it('stores result in cache on cache miss', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([makeCompletedBooking(5)])

    await GET(makeRequest(6))

    // cache miss -> setCachedProviderInsights called (fire-and-forget)
    await vi.waitFor(() => {
      expect(mockSetCached).toHaveBeenCalledWith(
        PROVIDER_ID,
        6,
        expect.objectContaining({ kpis: expect.any(Object) })
      )
    })
  })
})
