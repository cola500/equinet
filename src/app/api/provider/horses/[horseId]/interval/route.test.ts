import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT, DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Valid UUIDs for testing
const TEST_UUIDS = {
  providerUser: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  horse: '33333333-3333-4333-8333-333333333333',
  interval: '44444444-4444-4444-8444-444444444444',
  service1: '55555555-5555-4555-8555-555555555555',
  service2: '66666666-6666-4666-8666-666666666666',
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
      count: vi.fn(),
    },
    horseServiceInterval: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
  },
}))

const routeContext = { params: Promise.resolve({ horseId: TEST_UUIDS.horse }) }

const makeRequest = (method: string, body?: object) => {
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(
    `http://localhost:3000/api/provider/horses/${TEST_UUIDS.horse}/interval`,
    init
  )
}

describe('GET /api/provider/horses/[horseId]/interval', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
    } as never)

    // Provider has bookings for this horse (access check)
    vi.mocked(prisma.booking.count).mockResolvedValue(1)
  })

  it('should return 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const response = await GET(makeRequest('GET'), routeContext)
    expect(response.status).toBe(401)
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-user', userType: 'customer' },
    } as never)

    const response = await GET(makeRequest('GET'), routeContext)
    expect(response.status).toBe(403)
  })

  it('should return 403 when provider has no bookings for horse', async () => {
    vi.mocked(prisma.booking.count).mockResolvedValue(0)

    const response = await GET(makeRequest('GET'), routeContext)
    expect(response.status).toBe(403)
  })

  it('should return intervals list and available services', async () => {
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([
      {
        id: TEST_UUIDS.interval,
        serviceId: TEST_UUIDS.service1,
        revisitIntervalWeeks: 8,
        notes: 'Hovproblem',
        service: {
          id: TEST_UUIDS.service1,
          name: 'Hovslagning',
          recommendedIntervalWeeks: 6,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never)

    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
      { id: TEST_UUIDS.service2, name: 'Massage', recommendedIntervalWeeks: 8 },
    ] as never)

    const response = await GET(makeRequest('GET'), routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.intervals).toHaveLength(1)
    expect(data.intervals[0].revisitIntervalWeeks).toBe(8)
    expect(data.intervals[0].notes).toBe('Hovproblem')
    expect(data.intervals[0].service.name).toBe('Hovslagning')
    expect(data.availableServices).toHaveLength(2)
  })

  it('should return empty intervals list when none exist', async () => {
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([])
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: TEST_UUIDS.service1, name: 'Hovslagning', recommendedIntervalWeeks: 6 },
    ] as never)

    const response = await GET(makeRequest('GET'), routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.intervals).toHaveLength(0)
    expect(data.availableServices).toHaveLength(1)
  })
})

describe('PUT /api/provider/horses/[horseId]/interval', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
    } as never)

    vi.mocked(prisma.booking.count).mockResolvedValue(1)
  })

  it('should create/update interval with valid data including serviceId', async () => {
    vi.mocked(prisma.horseServiceInterval.upsert).mockResolvedValue({
      id: TEST_UUIDS.interval,
      horseId: TEST_UUIDS.horse,
      providerId: TEST_UUIDS.provider,
      serviceId: TEST_UUIDS.service1,
      revisitIntervalWeeks: 6,
      notes: 'Nytt intervall',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const response = await PUT(
      makeRequest('PUT', {
        serviceId: TEST_UUIDS.service1,
        revisitIntervalWeeks: 6,
        notes: 'Nytt intervall',
      }),
      routeContext
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.revisitIntervalWeeks).toBe(6)
    expect(data.notes).toBe('Nytt intervall')

    // Verify upsert was called with correct compound key
    expect(prisma.horseServiceInterval.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          horseId_providerId_serviceId: {
            horseId: TEST_UUIDS.horse,
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service1,
          },
        },
      })
    )
  })

  it('should return 400 when serviceId is missing', async () => {
    const response = await PUT(
      makeRequest('PUT', { revisitIntervalWeeks: 6 }),
      routeContext
    )

    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid serviceId (not UUID)', async () => {
    const response = await PUT(
      makeRequest('PUT', { serviceId: 'not-a-uuid', revisitIntervalWeeks: 6 }),
      routeContext
    )

    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid interval (too low)', async () => {
    const response = await PUT(
      makeRequest('PUT', { serviceId: TEST_UUIDS.service1, revisitIntervalWeeks: 0 }),
      routeContext
    )

    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid interval (too high)', async () => {
    const response = await PUT(
      makeRequest('PUT', { serviceId: TEST_UUIDS.service1, revisitIntervalWeeks: 53 }),
      routeContext
    )

    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid JSON', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provider/horses/${TEST_UUIDS.horse}/interval`,
      {
        method: 'PUT',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await PUT(request, routeContext)
    expect(response.status).toBe(400)
  })

  it('should return 403 when provider has no bookings for horse', async () => {
    vi.mocked(prisma.booking.count).mockResolvedValue(0)

    const response = await PUT(
      makeRequest('PUT', { serviceId: TEST_UUIDS.service1, revisitIntervalWeeks: 6 }),
      routeContext
    )

    expect(response.status).toBe(403)
  })

  it('should accept optional notes field', async () => {
    vi.mocked(prisma.horseServiceInterval.upsert).mockResolvedValue({
      id: TEST_UUIDS.interval,
      horseId: TEST_UUIDS.horse,
      providerId: TEST_UUIDS.provider,
      serviceId: TEST_UUIDS.service1,
      revisitIntervalWeeks: 4,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const response = await PUT(
      makeRequest('PUT', { serviceId: TEST_UUIDS.service1, revisitIntervalWeeks: 4 }),
      routeContext
    )

    expect(response.status).toBe(200)
  })
})

describe('DELETE /api/provider/horses/[horseId]/interval', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
    } as never)

    vi.mocked(prisma.booking.count).mockResolvedValue(1)
  })

  it('should delete interval for specific service', async () => {
    vi.mocked(prisma.horseServiceInterval.delete).mockResolvedValue({
      id: TEST_UUIDS.interval,
    } as never)

    const response = await DELETE(
      makeRequest('DELETE', { serviceId: TEST_UUIDS.service1 }),
      routeContext
    )

    expect(response.status).toBe(200)
    expect(prisma.horseServiceInterval.delete).toHaveBeenCalledWith({
      where: {
        horseId_providerId_serviceId: {
          horseId: TEST_UUIDS.horse,
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service1,
        },
      },
    })
  })

  it('should return 400 when serviceId is missing from body', async () => {
    const response = await DELETE(makeRequest('DELETE', {}), routeContext)

    expect(response.status).toBe(400)
  })

  it('should return 404 when interval does not exist', async () => {
    const prismaError = new Error('Record not found')
    ;(prismaError as Record<string, unknown>).code = 'P2025'
    ;(prismaError as Record<string, unknown>).name = 'PrismaClientKnownRequestError'
    vi.mocked(prisma.horseServiceInterval.delete).mockRejectedValue(prismaError)

    const response = await DELETE(
      makeRequest('DELETE', { serviceId: TEST_UUIDS.service1 }),
      routeContext
    )

    expect(response.status).toBe(404)
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-user', userType: 'customer' },
    } as never)

    const response = await DELETE(
      makeRequest('DELETE', { serviceId: TEST_UUIDS.service1 }),
      routeContext
    )
    expect(response.status).toBe(403)
  })
})
