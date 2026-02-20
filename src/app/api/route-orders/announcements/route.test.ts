import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    routeOrder: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/route-orders/announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all open announcements without filters', async () => {
    // Arrange
    const mockAnnouncements = [
      {
        id: 'announcement1',
        providerId: 'provider1',
        serviceType: 'Hovslagning',
        municipality: 'Alingsås',
        dateFrom: new Date('2025-12-15'),
        dateTo: new Date('2025-12-20'),
        announcementType: 'provider_announced',
        status: 'open',
        provider: {
          id: 'provider1',
          businessName: 'Test Hovslagare',
        },
      },
      {
        id: 'announcement2',
        providerId: 'provider2',
        serviceType: 'Massage',
        municipality: 'Göteborg',
        dateFrom: new Date('2025-12-18'),
        dateTo: new Date('2025-12-22'),
        announcementType: 'provider_announced',
        status: 'open',
        provider: {
          id: 'provider2',
          businessName: 'Test Massage',
        },
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockAnnouncements as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/announcements')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].id).toBe('announcement1')
    expect(data[1].id).toBe('announcement2')

    // Verify query filters for open announcements
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          announcementType: 'provider_announced',
          status: 'open',
        }),
      })
    )
  })

  it('should filter announcements by municipality', async () => {
    // Arrange
    const mockAnnouncements = [
      {
        id: 'announcement1',
        providerId: 'provider1',
        serviceType: 'Hovslagning',
        municipality: 'Göteborg',
        announcementType: 'provider_announced',
        status: 'open',
        provider: { id: 'provider1', businessName: 'Test Hovslagare' },
        services: [{ id: 's1', name: 'Hovslagning' }],
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockAnnouncements as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?municipality=Göteborg'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].municipality).toBe('Göteborg')

    // Verify municipality filter in query
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          municipality: 'Göteborg',
        }),
      })
    )
  })

  it('should filter announcements by location (within radius) - legacy support', async () => {
    // Arrange - Announcements near Alingsås (57.930, 12.532)
    const mockNearbyAnnouncements = [
      {
        id: 'announcement1',
        providerId: 'provider1',
        serviceType: 'Hovslagning',
        address: 'Alingsås centrum',
        latitude: 57.930,
        longitude: 12.532,
        announcementType: 'provider_announced',
        status: 'open',
        provider: { businessName: 'Local Hovslagare' },
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockNearbyAnnouncements as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?latitude=57.930&longitude=12.532&radiusKm=50'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('announcement1')
  })

  it('should filter announcements by service type', async () => {
    // Arrange
    const mockHovslagningAnnouncements = [
      {
        id: 'announcement1',
        serviceType: 'Hovslagning',
        announcementType: 'provider_announced',
        status: 'open',
        provider: { businessName: 'Test Hovslagare' },
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockHovslagningAnnouncements as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?serviceType=Hovslagning'
    )

    // Act
    const response = await GET(request)
    const _data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceType: 'Hovslagning',
        }),
      })
    )
  })

  it('should filter announcements by date range', async () => {
    // Arrange
    const mockAnnouncements = [
      {
        id: 'announcement1',
        dateFrom: new Date('2025-12-15'),
        dateTo: new Date('2025-12-20'),
        announcementType: 'provider_announced',
        status: 'open',
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockAnnouncements as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?dateFrom=2025-12-15&dateTo=2025-12-20'
    )

    // Act
    const _response = await GET(request)

    // Assert
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dateFrom: expect.objectContaining({
            lte: expect.any(Date),
          }),
          dateTo: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      })
    )
  })

  it('should return empty array when no announcements match filters', async () => {
    // Arrange
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?municipality=Kiruna'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
  })

  it('should include services in response', async () => {
    // Arrange
    const mockAnnouncementsWithServices = [
      {
        id: 'announcement1',
        announcementType: 'provider_announced',
        status: 'open',
        municipality: 'Alingsås',
        services: [
          { id: 's1', name: 'Hovslagning' },
          { id: 's2', name: 'Verkning' },
        ],
        routeStops: [],
        provider: { businessName: 'Test Provider' },
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockAnnouncementsWithServices as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/announcements')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data[0].services).toHaveLength(2)
    expect(data[0].services[0].name).toBe('Hovslagning')
  })

  it('should return 400 when geo-filter is incomplete (missing longitude)', async () => {
    // Arrange
    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?latitude=57.930&radiusKm=50'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('latitude, longitude, and radiusKm')
  })

  it('should return 400 when radiusKm is invalid (<= 0)', async () => {
    // Arrange
    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?latitude=57.930&longitude=12.532&radiusKm=0'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('radiusKm must be positive')
  })

  it('should filter announcements by providerId', async () => {
    // Arrange
    const mockProviderAnnouncements = [
      {
        id: 'announcement1',
        providerId: 'provider1',
        serviceType: 'Hovslagning',
        announcementType: 'provider_announced',
        status: 'open',
        provider: { id: 'provider1', businessName: 'Test Hovslagare' },
        routeStops: [],
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockProviderAnnouncements as any)

    const request = new NextRequest(
      'http://localhost:3000/api/route-orders/announcements?providerId=provider1'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].providerId).toBe('provider1')

    // Verify query includes providerId filter
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: 'provider1',
        }),
      })
    )
  })

  describe('Security', () => {
    it('should only select safe provider fields (no user relation)', async () => {
      // Arrange
      vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/route-orders/announcements')

      // Act
      await GET(request)

      // Assert - Verify provider select only includes safe fields
      expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            provider: {
              select: {
                id: true,
                businessName: true,
                description: true,
                profileImageUrl: true,
              },
            },
          }),
        })
      )

      // Verify user relation is NOT selected
      const callArgs = vi.mocked(prisma.routeOrder.findMany).mock.calls[0][0] as any
      expect(callArgs.select.provider.select.user).toBeUndefined()
      expect(callArgs.select.provider.select.email).toBeUndefined()
    })

    it('should use select (not include) to prevent data leakage', async () => {
      // Arrange
      vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/route-orders/announcements')

      // Act
      await GET(request)

      // Assert - Verify select is used instead of include
      expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            providerId: true,
            municipality: true,
            provider: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                businessName: true,
              }),
            }),
          }),
        })
      )

      // Verify include is NOT used
      const callArgs = vi.mocked(prisma.routeOrder.findMany).mock.calls[0][0]
      expect(callArgs).not.toHaveProperty('include')
    })
  })
})
