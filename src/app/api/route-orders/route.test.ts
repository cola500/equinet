import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET } from './route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'

// Helper to generate future dates (avoids hardcoded dates becoming invalid)
function getFutureDates(daysFromNow: number = 5, spanDays: number = 5) {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() + daysFromNow)
  const dateTo = new Date(dateFrom)
  dateTo.setDate(dateTo.getDate() + spanDays)
  return {
    dateFrom: dateFrom.toISOString().split('T')[0],
    dateTo: dateTo.toISOString().split('T')[0],
    dateFromObj: dateFrom,
    dateToObj: dateTo,
  }
}

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    routeOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    routeStop: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    // $transaction executes callback with prisma itself as the tx client
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
  }
  return { prisma: mockPrisma }
})

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

describe('POST /api/route-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Customer-initiated orders (existing functionality)', () => {
    it('should create customer route order with valid data', async () => {
      // Arrange
      const { dateFrom, dateTo, dateFromObj, dateToObj } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer123', userType: 'customer' },
      } as never)

      const mockRouteOrder = {
        id: 'order123',
        customerId: 'customer123',
        serviceType: 'Hovslagning',
        address: 'Storgatan 1',
        latitude: 57.930,
        longitude: 12.532,
        numberOfHorses: 2,
        dateFrom: dateFromObj,
        dateTo: dateToObj,
        priority: 'normal',
        status: 'pending',
        announcementType: 'customer_initiated',
      }

      vi.mocked(prisma.routeOrder.create).mockResolvedValue(mockRouteOrder as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: 'Hovslagning',
          address: 'Storgatan 1',
          latitude: 57.930,
          longitude: 12.532,
          numberOfHorses: 2,
          dateFrom,
          dateTo,
          priority: 'normal',
          contactPhone: '0701234567',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.id).toBe('order123')
      expect(data.customerId).toBe('customer123')
    })

    it('should return 403 when provider tries to create customer order', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'provider123', userType: 'provider' },
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: 'Hovslagning',
          address: 'Storgatan 1',
          latitude: 57.930,
          longitude: 12.532,
          dateFrom,
          dateTo,
          priority: 'normal',
          contactPhone: '0701234567',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.error).toContain('kunder')
    })
  })

  describe('Provider-announced orders (municipality + services)', () => {
    it('should create announcement with valid services and municipality', async () => {
      // Arrange
      const { dateFrom, dateTo, dateFromObj, dateToObj } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as never)

      // Provider owns these services
      vi.mocked(prisma.service.findMany).mockResolvedValue([
        { id: 'a0000000-0000-4000-a000-000000000001', name: 'Hovslagning', providerId: 'provider123' },
        { id: 'b0000000-0000-4000-b000-000000000002', name: 'Verkning', providerId: 'provider123' },
      ] as never)

      const mockAnnouncement = {
        id: 'announcement123',
        providerId: 'provider123',
        serviceType: 'Hovslagning, Verkning',
        municipality: 'Alingsås',
        dateFrom: dateFromObj,
        dateTo: dateToObj,
        announcementType: 'provider_announced',
        status: 'open',
      }

      vi.mocked(prisma.routeOrder.create).mockResolvedValue(mockAnnouncement as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-b000-000000000002'],
          dateFrom,
          dateTo,
          municipality: 'Alingsås',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.id).toBe('announcement123')
      expect(data.providerId).toBe('provider123')
      expect(data.municipality).toBe('Alingsås')
      expect(data.announcementType).toBe('provider_announced')
    })

    it('should return 400 for invalid municipality', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001'],
          dateFrom,
          dateTo,
          municipality: 'Fantasistad',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Ogiltig kommun')
    })

    it('should return 400 when serviceIds is empty', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: [],
          dateFrom,
          dateTo,
          municipality: 'Göteborg',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Valideringsfel')
    })

    it('should return 400 when serviceId does not belong to provider', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as never)

      // Only 1 of 2 serviceIds belongs to provider
      vi.mocked(prisma.service.findMany).mockResolvedValue([
        { id: 'a0000000-0000-4000-a000-000000000001', name: 'Hovslagning', providerId: 'provider123' },
      ] as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001', 'c0000000-0000-4000-a000-000000000099'],
          dateFrom,
          dateTo,
          municipality: 'Göteborg',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('tillhör inte dig')
    })

    it('should return 400 when municipality is missing', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001'],
          dateFrom,
          dateTo,
          // municipality missing
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Valideringsfel')
    })

    it('should return 403 when customer tries to create provider announcement', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer123', userType: 'customer' },
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001'],
          dateFrom,
          dateTo,
          municipality: 'Göteborg',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.error).toContain('leverantörer')
    })

    it('should return 404 when provider profile not found', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001'],
          dateFrom,
          dateTo,
          municipality: 'Göteborg',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toContain('Leverantörsprofil')
    })

    it('should include specialInstructions when provided', async () => {
      // Arrange
      const { dateFrom, dateTo, dateFromObj, dateToObj } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as never)

      vi.mocked(prisma.service.findMany).mockResolvedValue([
        { id: 'a0000000-0000-4000-a000-000000000001', name: 'Hovslagning', providerId: 'provider123' },
      ] as never)

      vi.mocked(prisma.routeOrder.create).mockResolvedValue({
        id: 'announcement123',
        providerId: 'provider123',
        serviceType: 'Hovslagning',
        municipality: 'Alingsås',
        specialInstructions: 'Ring innan',
        dateFrom: dateFromObj,
        dateTo: dateToObj,
        announcementType: 'provider_announced',
        status: 'open',
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001'],
          dateFrom,
          dateTo,
          municipality: 'Alingsås',
          specialInstructions: 'Ring innan',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.specialInstructions).toBe('Ring innan')
    })

    it('should set serviceType to comma-separated service names (backward compat)', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as never)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as never)

      vi.mocked(prisma.service.findMany).mockResolvedValue([
        { id: 'a0000000-0000-4000-a000-000000000001', name: 'Hovslagning', providerId: 'provider123' },
        { id: 'b0000000-0000-4000-b000-000000000002', name: 'Verkning', providerId: 'provider123' },
      ] as never)

      vi.mocked(prisma.routeOrder.create).mockResolvedValue({
        id: 'announcement123',
        providerId: 'provider123',
      } as never)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceIds: ['a0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-b000-000000000002'],
          dateFrom,
          dateTo,
          municipality: 'Göteborg',
        }),
      })

      // Act
      await POST(request)

      // Assert - verify that serviceType is set to comma-separated names
      expect(prisma.routeOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceType: 'Hovslagning, Verkning',
          }),
        })
      )
    })
  })
})

describe('GET /api/route-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return provider announcements for authenticated provider', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
    } as never)

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      {
        id: 'announcement1',
        providerId: 'provider123',
        serviceType: 'Hovslagning',
        municipality: 'Alingsås',
        announcementType: 'provider_announced',
        routeStops: [
          { id: 'stop1', locationName: 'Alingsås', stopOrder: 1 }
        ]
      }
    ] as never)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders?announcementType=provider_announced'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('announcement1')
  })

  it('should return 404 when provider profile not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders?announcementType=provider_announced'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toContain('Leverantörsprofil')
  })

  it('should return 400 for invalid query parameters', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as never)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders' // No params
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('Ogiltiga')
  })
})
