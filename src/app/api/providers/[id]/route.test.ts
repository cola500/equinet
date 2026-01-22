import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import * as authModule from '@/lib/auth'
import * as geocoding from '@/lib/geocoding'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/geocoding', () => ({
  geocodeAddress: vi.fn(),
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

describe('PUT /api/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update provider with automatic geocoding when address changes', async () => {
    // Arrange - Mock session (provider owns this profile)
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    // Mock existing provider
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
      businessName: 'Old Name',
      address: 'Old Street 1',
      city: 'Old City',
      postalCode: '11111',
      latitude: null,
      longitude: null,
    } as any)

    // Mock successful geocoding
    vi.mocked(geocoding.geocodeAddress).mockResolvedValue({
      latitude: 57.930,
      longitude: 12.532,
      formattedAddress: 'Storgatan 1, 441 30 Alingsås, Sweden',
    })

    // Mock successful update
    vi.mocked(prisma.provider.update).mockResolvedValue({
      id: 'provider123',
      businessName: 'Test Hovslagare',
      address: 'Storgatan 1',
      city: 'Alingsås',
      postalCode: '44130',
      latitude: 57.930,
      longitude: 12.532,
    } as any)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        address: 'Storgatan 1',
        city: 'Alingsås',
        postalCode: '44130',
      }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert - Geocoding was called
    expect(geocoding.geocodeAddress).toHaveBeenCalledWith(
      'Storgatan 1',
      'Alingsås',
      '44130'
    )

    // Assert - Provider updated with coordinates
    expect(prisma.provider.update).toHaveBeenCalledWith({
      where: { id: 'provider123' },
      data: expect.objectContaining({
        businessName: 'Test Hovslagare',
        address: 'Storgatan 1',
        city: 'Alingsås',
        postalCode: '44130',
        latitude: 57.930,
        longitude: 12.532,
      }),
    })

    expect(response.status).toBe(200)
    expect(data.latitude).toBe(57.930)
    expect(data.longitude).toBe(12.532)
  })

  it('should NOT geocode if address unchanged', async () => {
    // Arrange
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    // Existing provider with coordinates
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
      address: 'Storgatan 1',
      city: 'Alingsås',
      postalCode: '44130',
      latitude: 57.930,
      longitude: 12.532,
    } as any)

    vi.mocked(prisma.provider.update).mockResolvedValue({
      id: 'provider123',
      businessName: 'Updated Name',
      address: 'Storgatan 1',
      city: 'Alingsås',
      latitude: 57.930,
      longitude: 12.532,
    } as any)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Updated Name', // Only name changed
        address: 'Storgatan 1', // Same address
        city: 'Alingsås',
        postalCode: '44130',
      }),
    })

    // Act
    await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })

    // Assert - Geocoding NOT called
    expect(geocoding.geocodeAddress).not.toHaveBeenCalled()

    // Assert - Update used existing coordinates
    expect(prisma.provider.update).toHaveBeenCalledWith({
      where: { id: 'provider123' },
      data: expect.objectContaining({
        latitude: 57.930,
        longitude: 12.532,
      }),
    })
  })

  it('should return 400 if geocoding fails', async () => {
    // Arrange
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
      address: 'Old Address',
    } as any)

    // Mock geocoding failure
    vi.mocked(geocoding.geocodeAddress).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        address: 'Invalid Address XYZ 999',
        city: 'NonexistentCity',
      }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('geocode')
  })

  it('should return 401 if not authenticated', async () => {
    // Arrange - No session
    vi.mocked(authModule.auth).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({ businessName: 'Test' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 403 if user does not own provider profile', async () => {
    // Arrange - Different user
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: 'otherUser', userType: 'provider' },
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider123',
      userId: 'user123', // Different owner
    } as any)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({ businessName: 'Test' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Forbidden')
  })

  it('should return 404 if provider not found', async () => {
    // Arrange
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ businessName: 'Test' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})
