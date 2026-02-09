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
    availabilityException: {
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no upcoming visits
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])
    // Default: no reviews
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
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
    const result = await response.json()

    // Assert - Behavior-based: test API contract, not implementation
    expect(response.status).toBe(200)
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({
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
    expect(result.data[0].user.email).toBeUndefined()
    expect(result.data[0].user.phone).toBeUndefined()
    expect(result.data[0].user.passwordHash).toBeUndefined()

    // Verify pagination metadata
    expect(result.pagination).toMatchObject({
      total: 2,
      limit: 100,
      offset: 0,
      hasMore: false
    })
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
    const result = await response.json()

    // Assert - Behavior-based: test API response, not Prisma calls
    expect(response.status).toBe(200)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
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
    const result = await response.json()

    // Assert - Behavior-based: verify search results returned
    expect(response.status).toBe(200)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
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
    const result = await response.json()

    // Assert - Behavior-based: verify empty results when no match
    expect(response.status).toBe(200)
    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
  })

  it('should return empty array when no providers found', async () => {
    // Arrange
    vi.mocked(prisma.provider.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/providers')

    // Act
    const response = await GET(request)
    const result = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
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
    const result = await response.json()

    // Assert - Behavior-based: verify only active services returned
    expect(response.status).toBe(200)
    expect(result.data[0].services).toHaveLength(1)
    expect(result.data[0].services[0]).toMatchObject({
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
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('provider1')
      expect(result.data[0].businessName).toBe('Nearby Provider')
      expect(result.pagination.total).toBe(1)
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
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(1)
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
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(0)
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
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].city).toBe('Alingsås')
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
      expect(data.error).toContain('latitud, longitud och radie')
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
      expect(data.error).toContain('Radien måste vara ett positivt tal')
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
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('provider1')
    })
  })

  describe('Next visit enrichment', () => {
    it('should include nextVisit for providers with upcoming location visits', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Test Provider',
          city: 'Stockholm',
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)
      vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([
        {
          providerId: 'provider1',
          date: new Date('2026-02-03'),
          location: 'Sollebrunn',
        },
      ] as any)

      const request = new NextRequest('http://localhost:3000/api/providers')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data[0].nextVisit).toEqual({
        date: '2026-02-03',
        location: 'Sollebrunn',
      })
    })

    it('should return null nextVisit for providers without upcoming visits', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Test Provider',
          city: 'Stockholm',
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)
      vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/providers')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data[0].nextVisit).toBeNull()
    })

    it('should return earliest visit when multiple exist', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider1',
          businessName: 'Test Provider',
          city: 'Stockholm',
          services: [],
          user: { firstName: 'John', lastName: 'Doe' },
        },
      ]

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)
      // Note: Results are ordered by date ASC in the query
      vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([
        {
          providerId: 'provider1',
          date: new Date('2026-02-03'),
          location: 'Sollebrunn',
        },
        {
          providerId: 'provider1',
          date: new Date('2026-02-10'),
          location: 'Uppsala',
        },
      ] as any)

      const request = new NextRequest('http://localhost:3000/api/providers')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data[0].nextVisit).toEqual({
        date: '2026-02-03',
        location: 'Sollebrunn',
      })
    })
  })

  describe('Pagination', () => {
    it('should limit results to max 100 by default', async () => {
      // Arrange - Create 150 mock providers
      const mockProviders = Array.from({ length: 150 }, (_, i) => ({
        id: `provider${i + 1}`,
        businessName: `Provider ${i + 1}`,
        city: 'Stockholm',
        services: [],
        user: { firstName: 'John', lastName: 'Doe' },
      }))

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      const request = new NextRequest('http://localhost:3000/api/providers')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(100) // Max 100 returned
      expect(result.pagination).toMatchObject({
        total: 150,
        limit: 100,
        offset: 0,
        hasMore: true
      })
    })

    it('should respect custom limit parameter (clamped to 100)', async () => {
      // Arrange
      const mockProviders = Array.from({ length: 50 }, (_, i) => ({
        id: `provider${i + 1}`,
        businessName: `Provider ${i + 1}`,
        city: 'Stockholm',
        services: [],
        user: { firstName: 'John', lastName: 'Doe' },
      }))

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      // Request with limit=200 should be clamped to 100
      const request = new NextRequest('http://localhost:3000/api/providers?limit=200')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.pagination.limit).toBe(100) // Clamped to max
    })

    it('should support smaller limit values', async () => {
      // Arrange
      const mockProviders = Array.from({ length: 50 }, (_, i) => ({
        id: `provider${i + 1}`,
        businessName: `Provider ${i + 1}`,
        city: 'Stockholm',
        services: [],
        user: { firstName: 'John', lastName: 'Doe' },
      }))

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      const request = new NextRequest('http://localhost:3000/api/providers?limit=10')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(10)
      expect(result.pagination).toMatchObject({
        total: 50,
        limit: 10,
        offset: 0,
        hasMore: true
      })
    })

    it('should support offset for pagination', async () => {
      // Arrange
      const mockProviders = Array.from({ length: 30 }, (_, i) => ({
        id: `provider${i + 1}`,
        businessName: `Provider ${i + 1}`,
        city: 'Stockholm',
        services: [],
        user: { firstName: 'John', lastName: 'Doe' },
      }))

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      const request = new NextRequest('http://localhost:3000/api/providers?limit=10&offset=10')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(10)
      expect(result.data[0].id).toBe('provider11') // Starting from offset
      expect(result.pagination).toMatchObject({
        total: 30,
        limit: 10,
        offset: 10,
        hasMore: true
      })
    })

    it('should set hasMore to false when on last page', async () => {
      // Arrange
      const mockProviders = Array.from({ length: 25 }, (_, i) => ({
        id: `provider${i + 1}`,
        businessName: `Provider ${i + 1}`,
        city: 'Stockholm',
        services: [],
        user: { firstName: 'John', lastName: 'Doe' },
      }))

      vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

      const request = new NextRequest('http://localhost:3000/api/providers?limit=10&offset=20')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(5) // Only 5 remaining
      expect(result.pagination).toMatchObject({
        total: 25,
        limit: 10,
        offset: 20,
        hasMore: false
      })
    })
  })
})
