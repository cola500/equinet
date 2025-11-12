import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('GET /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return services for authenticated provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockServices = [
      {
        id: 'service1',
        name: 'Hovslagning',
        description: 'Standard hovslagning',
        price: 800,
        durationMinutes: 60,
        providerId: 'provider123',
        createdAt: new Date(),
      },
      {
        id: 'service2',
        name: 'Massage',
        price: 600,
        durationMinutes: 45,
        providerId: 'provider123',
        createdAt: new Date(),
      },
    ]

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices as any)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].name).toBe('Hovslagning')
    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: { providerId: 'provider123' },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 401 when user is not a provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'customer',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 when provider not found', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})

describe('POST /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create service for authenticated provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockService = {
      id: 'service1',
      name: 'Hovslagning',
      description: 'Standard hovslagning',
      price: 800,
      durationMinutes: 60,
      providerId: 'provider123',
      createdAt: new Date(),
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as any)

    const request = new NextRequest('http://localhost:3000/api/services', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Hovslagning',
        description: 'Standard hovslagning',
        price: 800,
        durationMinutes: 60,
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(201)
    expect(data.name).toBe('Hovslagning')
    expect(data.price).toBe(800)
    expect(prisma.service.create).toHaveBeenCalledWith({
      data: {
        name: 'Hovslagning',
        description: 'Standard hovslagning',
        price: 800,
        durationMinutes: 60,
        providerId: 'provider123',
      },
    })
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        price: 100,
        durationMinutes: 30,
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 for invalid data - missing name', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/services', {
      method: 'POST',
      body: JSON.stringify({
        price: 800,
        durationMinutes: 60,
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 400 for invalid data - negative price', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/services', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        price: -100,
        durationMinutes: 60,
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 400 for invalid data - zero duration', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/services', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        price: 100,
        durationMinutes: 0,
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })
})
