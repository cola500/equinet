import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}))

describe('GET /api/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all active providers with services', async () => {
    // Arrange
    const mockProviders = [
      {
        id: 'provider1',
        businessName: 'Test Hovslagare',
        description: 'Professional farrier',
        city: 'Stockholm',
        services: [
          {
            id: 'service1',
            name: 'Hovslagning',
            price: 800,
          },
        ],
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
      {
        id: 'provider2',
        businessName: 'Uppsala Hästvård',
        description: 'Horse care services',
        city: 'Uppsala',
        services: [],
        user: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
      },
    ]

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

    const request = new NextRequest('http://localhost:3000/api/providers')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based: test API contract, not implementation
    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      id: 'provider1',
      businessName: 'Test Hovslagare',
      description: 'Professional farrier',
      city: 'Stockholm',
      services: expect.arrayContaining([
        expect.objectContaining({
          id: 'service1',
          name: 'Hovslagning',
          price: 800,
        }),
      ]),
      user: expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
      }),
    })
    // Security assertion: sensitive data should NOT be exposed
    expect(data[0].user.email).toBeUndefined()
    expect(data[0].user.phone).toBeUndefined()
    expect(data[0].user.passwordHash).toBeUndefined()
  })

  it('should filter providers by city', async () => {
    // Arrange
    const mockProviders = [
      {
        id: 'provider1',
        businessName: 'Stockholm Hovslagare',
        description: 'Test description',
        city: 'Stockholm',
        services: [],
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    ]

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

    const request = new NextRequest('http://localhost:3000/api/providers?city=Stockholm')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based: test API response, not Prisma calls
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      id: 'provider1',
      businessName: 'Stockholm Hovslagare',
      city: 'Stockholm',
    })
  })

  it('should filter providers by search term in businessName', async () => {
    // Arrange
    const mockProviders = [
      {
        id: 'provider1',
        businessName: 'Hovslagare AB',
        description: 'Professional service',
        city: 'Stockholm',
        services: [],
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    ]

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

    const request = new NextRequest('http://localhost:3000/api/providers?search=Hovslagare')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based: verify search results returned
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      id: 'provider1',
      businessName: 'Hovslagare AB',
      description: 'Professional service',
    })
  })

  it('should combine city and search filters', async () => {
    // Arrange
    const mockProviders: any[] = []

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders)

    const request = new NextRequest(
      'http://localhost:3000/api/providers?city=Stockholm&search=Hovslagare'
    )

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based: verify empty results when no match
    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
  })

  it('should return empty array when no providers found', async () => {
    // Arrange
    vi.mocked(prisma.provider.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/providers')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
  })

  it('should only return active services for providers', async () => {
    // Arrange
    const mockProviders = [
      {
        id: 'provider1',
        businessName: 'Test Provider',
        description: 'Test description',
        city: 'Stockholm',
        services: [
          { id: 'service1', name: 'Active Service', price: 500 },
        ],
        user: { firstName: 'John', lastName: 'Doe' },
      },
    ]

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

    const request = new NextRequest('http://localhost:3000/api/providers')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based: verify only active services returned
    expect(response.status).toBe(200)
    expect(data[0].services).toHaveLength(1)
    expect(data[0].services[0]).toMatchObject({
      id: 'service1',
      name: 'Active Service',
      price: 500,
    })
  })

  describe('Geo-search functionality', () => {
    it('should filter providers by location (within radius)', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Nearby Provider',
          city: 'Alingsås',
          latitude: 57.930,
          longitude: 12.532,
          serviceAreaKm: 50,
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
        {
          id: 'provider2',
          businessName: 'Far Provider',
          city: 'Stockholm',
          latitude: 59.329,
          longitude: 18.068,
          serviceAreaKm: 30,
          services: [],
          user: { firstName: 'Jane', lastName: 'Smith' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      // Search near Alingsås with 50km radius
      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=57.930&longitude=12.532&radiusKm=50'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('provider1')
      expect(data[0].businessName).toBe('Nearby Provider')
    })

    it('should return providers within their service area', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Wide Service Area',
          latitude: 57.930,
          longitude: 12.532,
          serviceAreaKm: 100,
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      // Search from Sollebrunn (about 15km from Alingsås)
      // Note: Max radius is 100km for security (prevents data enumeration)
      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=58.043&longitude=12.555&radiusKm=50'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
    })

    it('should exclude providers outside search radius', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Far Provider',
          latitude: 59.329,
          longitude: 18.068,
          serviceAreaKm: 50,
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      // Search near Alingsås with small radius
      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=57.930&longitude=12.532&radiusKm=10'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveLength(0)
    })

    it('should combine geo-filter with city filter', async () => {
      // Arrange - Only return Alingsås provider (DB filters by city first)
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Alingsås Provider',
          city: 'Alingsås',
          latitude: 57.930,
          longitude: 12.532,
          serviceAreaKm: 50,
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      // Search near Alingsås + city filter
      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=57.930&longitude=12.532&radiusKm=50&city=Alingsås'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].city).toBe('Alingsås')
    })

    it('should return 400 when geo-filter is incomplete', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=57.930&radiusKm=50'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('latitude, longitude, and radiusKm')
    })

    it('should return 400 when radiusKm is invalid', async () => {
      // Arrange
      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=57.930&longitude=12.532&radiusKm=-10'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('radiusKm must be positive')
    })

    it('should skip providers without coordinates when geo-filtering', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Provider with coords',
          latitude: 57.930,
          longitude: 12.532,
          serviceAreaKm: 50,
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
        {
          id: 'provider2',
          businessName: 'Provider without coords',
          latitude: null,
          longitude: null,
          serviceAreaKm: 50,
          services: [],
          user: { firstName: 'Jane', lastName: 'Smith' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      const request = new NextRequest(
        'http://localhost:3000/api/providers?latitude=57.930&longitude=12.532&radiusKm=50'
      )

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('provider1')
    })
  })
})
