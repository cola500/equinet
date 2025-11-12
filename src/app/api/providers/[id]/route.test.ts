import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
  },
}))

describe('GET /api/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return provider with services and availability', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      businessName: 'Test Hovslagare',
      description: 'Professional farrier services',
      city: 'Stockholm',
      isActive: true,
      services: [
        {
          id: 'service1',
          name: 'Hovslagning',
          description: 'Standard hovslagning',
          price: 800,
          durationMinutes: 60,
          isActive: true,
        },
        {
          id: 'service2',
          name: 'Massage',
          price: 600,
          durationMinutes: 45,
          isActive: true,
        },
      ],
      availability: [
        {
          id: 'avail1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
        {
          id: 'avail2',
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ],
      user: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '0701234567',
      },
    }

    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.id).toBe('provider123')
    expect(data.businessName).toBe('Test Hovslagare')
    expect(data.services).toHaveLength(2)
    expect(data.availability).toHaveLength(2)
    expect(data.user.firstName).toBe('John')
    expect(prisma.provider.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'provider123',
        isActive: true,
      },
      include: {
        services: {
          where: {
            isActive: true,
          },
        },
        availability: {
          where: {
            isActive: true,
          },
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    })
  })

  it('should return 404 when provider does not exist', async () => {
    // Arrange
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/nonexistent')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })

  it('should return 404 when provider is not active', async () => {
    // Arrange
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/inactive123')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'inactive123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
    expect(prisma.provider.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'inactive123',
        isActive: true,
      },
      include: expect.any(Object),
    })
  })

  it('should only return active services', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      businessName: 'Test Provider',
      isActive: true,
      services: [
        { id: 'service1', name: 'Active Service', isActive: true },
      ],
      availability: [],
      user: { firstName: 'John', lastName: 'Doe' },
    }

    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123')

    // Act
    await GET(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })

    // Assert
    expect(prisma.provider.findUnique).toHaveBeenCalledWith(
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

  it('should return provider with empty services array if no active services', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      businessName: 'Test Provider',
      isActive: true,
      services: [],
      availability: [],
      user: { firstName: 'John', lastName: 'Doe', phone: '0701234567' },
    }

    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.services).toHaveLength(0)
    expect(data.availability).toHaveLength(0)
  })
})
