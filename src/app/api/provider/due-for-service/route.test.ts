import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const TEST_UUIDS = {
  providerUser: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  horse1: '33333333-3333-4333-8333-333333333333',
  horse2: '44444444-4444-4444-8444-444444444444',
  customer1: '55555555-5555-4555-8555-555555555555',
  service1: '66666666-6666-4666-8666-666666666666',
}

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    horseServiceInterval: {
      findMany: vi.fn(),
    },
    customerHorseServiceInterval: {
      findMany: vi.fn(),
    },
  },
}))

const makeRequest = (params = '') =>
  new NextRequest(`http://localhost:3000/api/provider/due-for-service${params}`)

describe('GET /api/provider/due-for-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
    } as never)

    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerHorseServiceInterval.findMany).mockResolvedValue([])
  })

  it('should return 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-user', userType: 'customer' },
    } as never)

    const response = await GET(makeRequest())
    expect(response.status).toBe(403)
  })

  it('should return horses sorted by urgency (overdue first)', async () => {
    const now = new Date()
    // Horse 1: last service 10 weeks ago, interval 6 weeks -> overdue
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    // Horse 2: last service 3 weeks ago, interval 6 weeks -> not due yet
    const threeWeeksAgo = new Date(now)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: tenWeeksAgo,
        updatedAt: tenWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
      {
        id: 'booking-2',
        horseId: TEST_UUIDS.horse2,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: threeWeeksAgo,
        updatedAt: threeWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse2, name: 'Pransen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toHaveLength(2)

    // Overdue horse should be first
    expect(data.items[0].horseName).toBe('Blansen')
    expect(data.items[0].status).toBe('overdue')

    // Not-yet-due horse should be second
    expect(data.items[1].horseName).toBe('Pransen')
    expect(data.items[1].status).toBe('ok')
  })

  it('should mark horses as "upcoming" when within 2 weeks of due date', async () => {
    const now = new Date()
    // Last service 5 weeks ago, interval 6 weeks -> due in 1 week -> upcoming
    const fiveWeeksAgo = new Date(now)
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: fiveWeeksAgo,
        updatedAt: fiveWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(data.items[0].status).toBe('upcoming')
  })

  it('should use horse-specific interval override', async () => {
    const now = new Date()
    // Last service 5 weeks ago, service default 8 weeks, but horse override 4 weeks -> overdue
    const fiveWeeksAgo = new Date(now)
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: fiveWeeksAgo,
        updatedAt: fiveWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 8 },
      },
    ] as never)

    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([
      { horseId: TEST_UUIDS.horse1, serviceId: TEST_UUIDS.service1, providerId: TEST_UUIDS.provider, revisitIntervalWeeks: 4 },
    ] as never)

    const response = await GET(makeRequest())
    const data = await response.json()

    // With 4-week override, 5 weeks ago is overdue
    expect(data.items[0].status).toBe('overdue')
    expect(data.items[0].intervalWeeks).toBe(4)
  })

  it('should filter overdue only', async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const threeWeeksAgo = new Date(now)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: tenWeeksAgo,
        updatedAt: tenWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
      {
        id: 'booking-2',
        horseId: TEST_UUIDS.horse2,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: threeWeeksAgo,
        updatedAt: threeWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse2, name: 'Pransen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const response = await GET(makeRequest('?filter=overdue'))
    const data = await response.json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].horseName).toBe('Blansen')
  })

  it('should filter upcoming only (within 2 weeks)', async () => {
    const now = new Date()
    const fiveWeeksAgo = new Date(now)
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: fiveWeeksAgo,
        updatedAt: fiveWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const response = await GET(makeRequest('?filter=upcoming'))
    const data = await response.json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].status).toBe('upcoming')
  })

  it('should only use the latest booking per horse+service combo', async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    // Two bookings for the same horse + service, should only use the latest
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-old',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: tenWeeksAgo,
        updatedAt: tenWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
      {
        id: 'booking-recent',
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: twoWeeksAgo,
        updatedAt: twoWeeksAgo,
        status: 'completed',
        horse: { id: TEST_UUIDS.horse1, name: 'Blansen' },
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const response = await GET(makeRequest())
    const data = await response.json()

    // Should only have 1 item (deduplicated by horse+service)
    expect(data.items).toHaveLength(1)
    // Should use the most recent booking, so status should be ok (2 weeks ago, interval 6 weeks)
    expect(data.items[0].status).toBe('ok')
  })

  it('should return empty list for provider with no completed bookings', async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toEqual([])
  })

  it('should exclude bookings without a horse', async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: 'booking-no-horse',
        horseId: null,
        serviceId: TEST_UUIDS.service1,
        customerId: TEST_UUIDS.customer1,
        bookingDate: tenWeeksAgo,
        updatedAt: tenWeeksAgo,
        status: 'completed',
        horse: null,
        customer: { id: TEST_UUIDS.customer1, firstName: 'Anna', lastName: 'Svensson' },
        service: { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const response = await GET(makeRequest())
    const data = await response.json()

    // Bookings without a horse are excluded from due-for-service
    expect(data.items).toHaveLength(0)
  })
})
