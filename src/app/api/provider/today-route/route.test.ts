import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { getAuthUser } from '@/lib/auth-dual'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const TEST_UUIDS = {
  providerUser: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  customer1: '55555555-5555-4555-8555-555555555555',
  service1: '66666666-6666-4666-8666-666666666666',
}

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}))

const makeRequest = (params = '') =>
  new NextRequest(`http://localhost:3000/api/provider/today-route${params}`)

const sampleBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  startTime: '08:00',
  endTime: '09:00',
  customer: {
    firstName: 'Anna',
    lastName: 'Svensson',
    latitude: 57.7,
    longitude: 11.97,
    address: 'Storgatan 1, Alingsås',
  },
  service: { name: 'Hovslagning' },
  ...overrides,
})

describe('GET /api/provider/today-route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getAuthUser).mockResolvedValue({
      id: TEST_UUIDS.providerUser, email: '', userType: 'provider', isAdmin: false,
      providerId: TEST_UUIDS.provider, stableId: null, authMethod: 'supabase' as const,
    })

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      latitude: 57.71,
      longitude: 11.98,
    } as never)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([] as never)
  })

  it('should return 401 when session is null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'customer-user', email: '', userType: 'customer', isAdmin: false,
      providerId: null, stableId: null, authMethod: 'supabase' as const,
    })

    const response = await GET(makeRequest())
    expect(response.status).toBe(403)
  })

  it('should return 404 when provider profile is missing', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null as never)

    const response = await GET(makeRequest())
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Leverantörsprofil hittades inte')
  })

  it('should return 400 for an invalid date parameter', async () => {
    const response = await GET(makeRequest('?date=not-a-date'))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return the day stops shaped for the map, sorted by start time', async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      sampleBooking({ id: 'b1', startTime: '08:00', endTime: '09:00' }),
      sampleBooking({
        id: 'b2',
        startTime: '11:00',
        endTime: '12:00',
        customer: {
          firstName: 'Erik',
          lastName: 'Berg',
          latitude: 57.8,
          longitude: 12.1,
          address: 'Ekvägen 4, Vårgårda',
        },
        service: { name: 'Tandvård' },
      }),
    ] as never)

    const response = await GET(makeRequest('?date=2026-06-07'))
    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.date).toBe('2026-06-07')
    expect(data.startLocation).toEqual({ lat: 57.71, lon: 11.98 })
    expect(data.stops).toHaveLength(2)
    expect(data.stops[0]).toEqual({
      id: 'b1',
      startTime: '08:00',
      endTime: '09:00',
      serviceType: 'Hovslagning',
      address: 'Storgatan 1, Alingsås',
      latitude: 57.7,
      longitude: 11.97,
      customer: { firstName: 'Anna', lastName: 'Svensson' },
    })
    expect(data.stops[1].id).toBe('b2')
    expect(data.stops[1].serviceType).toBe('Tandvård')
  })

  it('should only query active bookings for the provider on the given date', async () => {
    await GET(makeRequest('?date=2026-06-07'))

    const callArg = vi.mocked(prisma.booking.findMany).mock.calls[0][0] as {
      where: { providerId: string; status: { in: string[] }; bookingDate: { gte: Date; lte: Date } }
      orderBy: { startTime: string }
    }
    expect(callArg.where.providerId).toBe(TEST_UUIDS.provider)
    expect(callArg.where.status.in).toEqual(['pending', 'confirmed'])
    expect(callArg.orderBy).toEqual({ startTime: 'asc' })
  })

  // Regression: bookings are stored at LOCAL midnight (e.g. seed/demo data), not
  // UTC midnight. An exact `bookingDate` equality misses them across the timezone
  // boundary. The query must use a full-day range so a booking on the requested
  // local day is found regardless of how its timestamp was constructed.
  it('matches bookings on the requested local day via a full-day range', async () => {
    await GET(makeRequest('?date=2026-06-07'))

    const where = vi.mocked(prisma.booking.findMany).mock.calls[0][0].where as {
      bookingDate: { gte: Date; lte: Date }
    }
    expect(where.bookingDate.gte).toBeInstanceOf(Date)
    expect(where.bookingDate.lte).toBeInstanceOf(Date)

    const localMidnight = new Date('2026-06-07T00:00:00')
    const localEndOfDay = new Date('2026-06-07T23:59:59')
    expect(where.bookingDate.gte.getTime()).toBeLessThanOrEqual(localMidnight.getTime())
    expect(where.bookingDate.lte.getTime()).toBeGreaterThanOrEqual(localEndOfDay.getTime())
  })

  it('should default to today and return an empty list without bookings', async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(data.stops).toEqual([])
  })

  it('should return null startLocation when the provider lacks coordinates', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      latitude: null,
      longitude: null,
    } as never)

    const response = await GET(makeRequest('?date=2026-06-07'))
    const data = await response.json()
    expect(data.startLocation).toBeNull()
  })
})
