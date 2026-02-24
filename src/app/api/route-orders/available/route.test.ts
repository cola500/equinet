import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth-server'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { rateLimiters } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    routeOrder: {
      findMany: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/geo/distance', () => ({
  calculateDistance: vi.fn().mockReturnValue(12.5),
}))

const mockAuth = vi.mocked(auth)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)
const mockRateLimiters = vi.mocked(rateLimiters)

// Helper: create a provider session
function providerSession(overrides: Record<string, any> = {}) {
  return {
    user: {
      id: 'user-1',
      userType: 'provider',
      providerId: 'provider-1',
      ...overrides,
    },
  } as any
}

// Helper: create a mock route order
function mockRouteOrder(overrides: Record<string, any> = {}) {
  return {
    id: 'order-1',
    serviceType: 'Hovslagning',
    address: 'Storgatan 1, Alingsas',
    latitude: 57.93,
    longitude: 12.53,
    numberOfHorses: 2,
    dateFrom: new Date('2026-03-01'),
    dateTo: new Date('2026-03-05'),
    priority: 'normal',
    status: 'open',
    specialInstructions: null,
    contactPhone: '0701234567',
    announcementType: 'customer_initiated',
    createdAt: new Date('2026-02-20'),
    customer: {
      firstName: 'Anna',
      lastName: 'Svensson',
      phone: '0701234567',
    },
    provider: {
      businessName: null,
    },
    ...overrides,
  }
}

describe('GET /api/route-orders/available', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(providerSession())
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockRateLimiters.api.mockResolvedValue(true)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
    } as any)
  })

  // -------------------------------------------------------
  // 1. Rate limiting
  // -------------------------------------------------------
  it('returns 429 when rate limit is exceeded', async () => {
    // Arrange
    mockRateLimiters.api.mockResolvedValueOnce(false)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(429)
    expect(data.error).toBe('För många förfrågningar. Försök igen om en minut.')

    // Auth should NOT be called when rate limited
    expect(auth).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------
  // 2. Authentication
  // -------------------------------------------------------
  it('returns 401 when not authenticated', async () => {
    // Arrange - auth() throws a Response (middleware pattern)
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)

    // Assert - the thrown Response is returned directly
    expect(response.status).toBe(401)
  })

  // -------------------------------------------------------
  // 3. Feature flag
  // -------------------------------------------------------
  it('returns 404 when route_planning feature flag is disabled', async () => {
    // Arrange
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Ej tillgänglig')
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('route_planning')
  })

  // -------------------------------------------------------
  // 4. Authorization - not a provider
  // -------------------------------------------------------
  it('returns 403 when user is not a provider', async () => {
    // Arrange
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toContain('Endast leverantörer')
  })

  it('returns 403 when provider has no providerId', async () => {
    // Arrange - userType is provider but providerId is missing
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: null },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toContain('Endast leverantörer')
  })

  // -------------------------------------------------------
  // 5. Provider not found
  // -------------------------------------------------------
  it('returns 404 when provider profile is not found', async () => {
    // Arrange
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Leverantör hittades inte')
  })

  // -------------------------------------------------------
  // 6. Happy path: returns available orders
  // -------------------------------------------------------
  it('returns available route orders with distance calculated', async () => {
    // Arrange
    const orders = [
      mockRouteOrder({ id: 'order-1', latitude: 57.93, longitude: 12.53 }),
      mockRouteOrder({ id: 'order-2', latitude: 58.0, longitude: 12.6 }),
    ]
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(orders as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]).toHaveProperty('distanceKm')
    expect(data[0].id).toBeDefined()
    expect(data[0].serviceType).toBeDefined()
  })

  // -------------------------------------------------------
  // 7. serviceType filter
  // -------------------------------------------------------
  it('filters by serviceType query parameter', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder({ serviceType: 'Massage' }),
    ] as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/available?serviceType=Massage'
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(response.status).toBe(200)
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceType: 'Massage',
          status: { in: ['open', 'pending'] },
        }),
      })
    )
  })

  // -------------------------------------------------------
  // 8. priority filter
  // -------------------------------------------------------
  it('filters by priority query parameter', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder({ priority: 'urgent' }),
    ] as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/available?priority=urgent'
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(response.status).toBe(200)
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          priority: 'urgent',
          status: { in: ['open', 'pending'] },
        }),
      })
    )
  })

  it('applies both serviceType and priority filters together', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder({ serviceType: 'Hovslagning', priority: 'urgent' }),
    ] as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/available?serviceType=Hovslagning&priority=urgent'
    )

    // Act
    await GET(request)

    // Assert
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceType: 'Hovslagning',
          priority: 'urgent',
          status: { in: ['open', 'pending'] },
        }),
      })
    )
  })

  // -------------------------------------------------------
  // 9. Empty list returns 200 with []
  // -------------------------------------------------------
  it('returns 200 with empty array when no orders available', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  // -------------------------------------------------------
  // 10. Unexpected error returns 500
  // -------------------------------------------------------
  it('returns 500 on unexpected database error', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockRejectedValue(new Error('DB connection failed'))

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const text = await response.text()

    // Assert
    expect(response.status).toBe(500)
    expect(text).toBe('Internt serverfel')
  })

  it('returns 500 on unexpected non-Error throw', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockRejectedValue('string error')

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)

    // Assert
    expect(response.status).toBe(500)
  })

  // -------------------------------------------------------
  // 11. Response shape validation
  // -------------------------------------------------------
  it('includes all expected fields in response shape', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder(),
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    const order = data[0]
    expect(order).toHaveProperty('id')
    expect(order).toHaveProperty('serviceType')
    expect(order).toHaveProperty('address')
    expect(order).toHaveProperty('latitude')
    expect(order).toHaveProperty('longitude')
    expect(order).toHaveProperty('numberOfHorses')
    expect(order).toHaveProperty('dateFrom')
    expect(order).toHaveProperty('dateTo')
    expect(order).toHaveProperty('priority')
    expect(order).toHaveProperty('status')
    expect(order).toHaveProperty('specialInstructions')
    expect(order).toHaveProperty('contactPhone')
    expect(order).toHaveProperty('announcementType')
    expect(order).toHaveProperty('createdAt')
    expect(order).toHaveProperty('customer')
    expect(order).toHaveProperty('provider')
    expect(order).toHaveProperty('distanceKm')
    // Customer fields
    expect(order.customer).toHaveProperty('firstName')
    expect(order.customer).toHaveProperty('lastName')
    expect(order.customer).toHaveProperty('phone')
    // Provider fields
    expect(order.provider).toHaveProperty('businessName')
  })

  // -------------------------------------------------------
  // 12. Only returns unassigned orders (open/pending status)
  // -------------------------------------------------------
  it('only queries for open and pending orders', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    await GET(request)

    // Assert
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['open', 'pending'] },
        }),
      })
    )
  })

  // -------------------------------------------------------
  // Distance calculation edge cases
  // -------------------------------------------------------
  it('sets distanceKm to null for orders without coordinates', async () => {
    // Arrange
    const { calculateDistance } = await import('@/lib/geo/distance')
    vi.mocked(calculateDistance).mockReturnValue(Infinity)

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder({ id: 'no-coords', latitude: null, longitude: null }),
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data[0].distanceKm).toBeNull()
  })

  it('sorts orders by distance (closest first, null last)', async () => {
    // Arrange
    const { calculateDistance } = await import('@/lib/geo/distance')
    // First call: far, second call: close
    vi.mocked(calculateDistance)
      .mockReturnValueOnce(50.3)
      .mockReturnValueOnce(5.1)

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder({ id: 'far', latitude: 58.5, longitude: 13.0 }),
      mockRouteOrder({ id: 'close', latitude: 57.75, longitude: 12.0 }),
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data[0].id).toBe('close')
    expect(data[0].distanceKm).toBe(5.1)
    expect(data[1].id).toBe('far')
    expect(data[1].distanceKm).toBe(50.3)
  })

  it('rounds distanceKm to one decimal place', async () => {
    // Arrange
    const { calculateDistance } = await import('@/lib/geo/distance')
    vi.mocked(calculateDistance).mockReturnValue(12.456)

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      mockRouteOrder(),
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(data[0].distanceKm).toBe(12.5)
  })

  // -------------------------------------------------------
  // Query structure validation
  // -------------------------------------------------------
  it('uses select (not include) to prevent data leakage', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    await GET(request)

    // Assert
    const callArgs = vi.mocked(prisma.routeOrder.findMany).mock.calls[0][0] as any
    expect(callArgs).toHaveProperty('select')
    expect(callArgs).not.toHaveProperty('include')
  })

  it('limits results to 50 orders', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    await GET(request)

    // Assert
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    )
  })

  it('orders results by createdAt descending', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    await GET(request)

    // Assert
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('looks up provider by session providerId', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    await GET(request)

    // Assert
    expect(prisma.provider.findUnique).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
    })
  })

  it('does not apply serviceType or priority filter when no query params', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/route-orders/available')

    // Act
    await GET(request)

    // Assert
    const callArgs = vi.mocked(prisma.routeOrder.findMany).mock.calls[0][0] as any
    expect(callArgs.where).toEqual({
      status: { in: ['open', 'pending'] },
    })
    expect(callArgs.where.serviceType).toBeUndefined()
    expect(callArgs.where.priority).toBeUndefined()
  })
})
