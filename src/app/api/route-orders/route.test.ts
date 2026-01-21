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
vi.mock('@/lib/prisma', () => ({
  prisma: {
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
  },
}))

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
      } as any)

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

      vi.mocked(prisma.routeOrder.create).mockResolvedValue(mockRouteOrder as any)

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
      } as any)

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

  describe('Provider-announced orders (new functionality)', () => {
    it('should create provider announcement with single stop', async () => {
      // Arrange
      const { dateFrom, dateTo, dateFromObj, dateToObj } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as any)

      const mockAnnouncement = {
        id: 'announcement123',
        providerId: 'provider123',
        serviceType: 'Hovslagning',
        address: 'Alingsås',
        latitude: 57.930,
        longitude: 12.532,
        dateFrom: dateFromObj,
        dateTo: dateToObj,
        announcementType: 'provider_announced',
        status: 'open',
      }

      vi.mocked(prisma.routeOrder.create).mockResolvedValue(mockAnnouncement as any)
      vi.mocked(prisma.routeStop.create).mockResolvedValue({
        id: 'stop1',
        routeOrderId: 'announcement123',
        locationName: 'Alingsås centrum',
        stopOrder: 1,
      } as any)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'Hovslagning',
          dateFrom,
          dateTo,
          stops: [
            {
              locationName: 'Alingsås centrum',
              address: 'Storgatan 1, Alingsås',
              latitude: 57.930,
              longitude: 12.532,
            },
          ],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.id).toBe('announcement123')
      expect(data.providerId).toBe('provider123')
      expect(data.announcementType).toBe('provider_announced')
    })

    it('should create provider announcement with multiple stops (1-3)', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as any)

      const mockAnnouncement = {
        id: 'announcement123',
        providerId: 'provider123',
        announcementType: 'provider_announced',
      }

      vi.mocked(prisma.routeOrder.create).mockResolvedValue(mockAnnouncement as any)
      vi.mocked(prisma.routeStop.createMany).mockResolvedValue({ count: 3 } as any)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'Hovslagning',
          dateFrom,
          dateTo,
          stops: [
            {
              locationName: 'Alingsås',
              address: 'Storgatan 1, Alingsås',
              latitude: 57.930,
              longitude: 12.532,
            },
            {
              locationName: 'Sollebrunn',
              address: 'Centrumvägen 5, Sollebrunn',
              latitude: 58.043,
              longitude: 12.555,
            },
            {
              locationName: 'Lerum',
              address: 'Aspvägen 10, Lerum',
              latitude: 57.770,
              longitude: 12.269,
            },
          ],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(prisma.routeStop.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            routeOrderId: 'announcement123',
            locationName: 'Alingsås',
            stopOrder: 1,
          }),
          expect.objectContaining({
            locationName: 'Sollebrunn',
            stopOrder: 2,
          }),
          expect.objectContaining({
            locationName: 'Lerum',
            stopOrder: 3,
          }),
        ]),
      })
    })

    it('should return 400 when provider announcement has no stops', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as any)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'Hovslagning',
          dateFrom,
          dateTo,
          stops: [],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Valideringsfel')
      // Check that validation details mention the stops requirement
      expect(JSON.stringify(data.details)).toContain('stops')
    })

    it('should return 400 when provider announcement has too many stops (>3)', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: 'provider123',
        userId: 'user123',
      } as any)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'Hovslagning',
          dateFrom,
          dateTo,
          stops: [
            { locationName: 'Stop 1', address: 'Address 1', latitude: 57.0, longitude: 12.0 },
            { locationName: 'Stop 2', address: 'Address 2', latitude: 57.1, longitude: 12.1 },
            { locationName: 'Stop 3', address: 'Address 3', latitude: 57.2, longitude: 12.2 },
            { locationName: 'Stop 4', address: 'Address 4', latitude: 57.3, longitude: 12.3 },
          ],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Valideringsfel')
      // Check that validation details mention the stops limit
      expect(JSON.stringify(data.details)).toContain('stops')
    })

    it('should return 403 when customer tries to create provider announcement', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer123', userType: 'customer' },
      } as any)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'Hovslagning',
          dateFrom,
          dateTo,
          stops: [
            { locationName: 'Alingsås', address: 'Storgatan 1', latitude: 57.930, longitude: 12.532 },
          ],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.error).toContain('providers')
    })

    it('should return 404 when provider profile not found', async () => {
      // Arrange
      const { dateFrom, dateTo } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', userType: 'provider' },
      } as any)

      vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/route-orders', {
        method: 'POST',
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'Hovslagning',
          dateFrom,
          dateTo,
          stops: [
            { locationName: 'Alingsås', address: 'Storgatan 1', latitude: 57.930, longitude: 12.532 },
          ],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toContain('Provider')
    })

    it('should create announcement without coordinates (MVP feature)', async () => {
      // Arrange
      const { dateFrom, dateTo, dateFromObj, dateToObj } = getFutureDates()

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'provider1', userType: 'provider' },
      } as any)

      // Mock provider exists
      ;(prisma.provider.findUnique as any).mockResolvedValue({
        id: 'provider123',
      })

      // Mock announcement creation
      ;(prisma.routeOrder.create as any).mockResolvedValue({
        id: 'announcement1',
        serviceType: 'hovslagning',
        address: 'Storgatan 1, Alingsås',
        latitude: null,
        longitude: null,
        dateFrom: dateFromObj,
        dateTo: dateToObj,
        status: 'open',
        announcementType: 'provider_announced',
        provider: { id: 'provider123', businessName: 'Test Provider' },
      })

      const request = new Request('http://localhost:3000/api/route-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcementType: 'provider_announced',
          serviceType: 'hovslagning',
          dateFrom,
          dateTo,
          stops: [
            { locationName: 'Alingsås centrum', address: 'Storgatan 1, Alingsås' },
          ],
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.latitude).toBeNull()
      expect(data.longitude).toBeNull()
      expect(data.address).toBe('Storgatan 1, Alingsås')
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
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
    } as any)

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      {
        id: 'announcement1',
        providerId: 'provider123',
        serviceType: 'Hovslagning',
        announcementType: 'provider_announced',
        routeStops: [
          { id: 'stop1', locationName: 'Alingsås', stopOrder: 1 }
        ]
      }
    ] as any)

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
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders?announcementType=provider_announced'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toContain('Provider')
  })

  it('should return 400 for invalid query parameters', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders' // No params
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid')
  })
})
