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
        address: 'Alingsås',
        latitude: 57.930,
        longitude: 12.532,
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
        address: 'Sollebrunn',
        latitude: 58.043,
        longitude: 12.555,
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

  it('should filter announcements by location (within radius)', async () => {
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
    const data = await response.json()

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
    const response = await GET(request)

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
      'http://localhost:3000/api/route-orders/announcements?serviceType=NonexistentService'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
  })

  it('should include route stops in response', async () => {
    // Arrange
    const mockAnnouncementsWithStops = [
      {
        id: 'announcement1',
        announcementType: 'provider_announced',
        status: 'open',
        routeStops: [
          {
            id: 'stop1',
            locationName: 'Alingsås',
            latitude: 57.930,
            longitude: 12.532,
            stopOrder: 1,
          },
          {
            id: 'stop2',
            locationName: 'Sollebrunn',
            latitude: 58.043,
            longitude: 12.555,
            stopOrder: 2,
          },
        ],
        provider: { businessName: 'Test Provider' },
      },
    ]

    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(mockAnnouncementsWithStops as any)

    const request = new NextRequest('http://localhost:3000/api/route-orders/announcements')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data[0].routeStops).toHaveLength(2)
    expect(data[0].routeStops[0].locationName).toBe('Alingsås')

    // Verify include statement
    expect(prisma.routeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          routeStops: expect.objectContaining({
            orderBy: { stopOrder: 'asc' },
          }),
        }),
      })
    )
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
})
