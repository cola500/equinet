import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findMany: vi.fn(),
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
        isActive: true,
        services: [
          {
            id: 'service1',
            name: 'Hovslagning',
            price: 800,
            isActive: true,
          },
        ],
        user: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '0701234567',
        },
      },
      {
        id: 'provider2',
        businessName: 'Uppsala Hästvård',
        description: 'Horse care services',
        city: 'Uppsala',
        isActive: true,
        services: [],
        user: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
      },
    ]

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

    const request = new NextRequest('http://localhost:3000/api/providers')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].businessName).toBe('Test Hovslagare')
    expect(data[0].services).toHaveLength(1)
    expect(prisma.provider.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: true }],
      },
      include: {
        services: {
          where: {
            isActive: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  })

  it('should filter providers by city', async () => {
    // Arrange
    const mockProviders = [
      {
        id: 'provider1',
        businessName: 'Stockholm Hovslagare',
        city: 'Stockholm',
        isActive: true,
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

    // Assert
    expect(response.status).toBe(200)
    expect(prisma.provider.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { isActive: true },
          {
            city: {
              contains: 'Stockholm',
            },
          },
        ],
      },
      include: expect.any(Object),
      orderBy: expect.any(Object),
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
        isActive: true,
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

    // Assert
    expect(response.status).toBe(200)
    expect(prisma.provider.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              {
                businessName: {
                  contains: 'Hovslagare',
                },
              },
              {
                description: {
                  contains: 'Hovslagare',
                },
              },
            ],
          },
        ],
      },
      include: expect.any(Object),
      orderBy: expect.any(Object),
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

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
    expect(prisma.provider.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { isActive: true },
          {
            city: {
              contains: 'Stockholm',
            },
          },
          {
            OR: [
              {
                businessName: {
                  contains: 'Hovslagare',
                },
              },
              {
                description: {
                  contains: 'Hovslagare',
                },
              },
            ],
          },
        ],
      },
      include: expect.any(Object),
      orderBy: expect.any(Object),
    })
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
        isActive: true,
        services: [
          { id: 'service1', name: 'Active Service', isActive: true },
        ],
        user: { firstName: 'John', lastName: 'Doe' },
      },
    ]

    vi.mocked(prisma.provider.findMany).mockResolvedValue(mockProviders as any)

    const request = new NextRequest('http://localhost:3000/api/providers')

    // Act
    const response = await GET(request)

    // Assert
    expect(prisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          services: {
            where: {
              isActive: true,
            },
          },
        }),
      })
    )
  })
})
