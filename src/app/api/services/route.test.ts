import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { rateLimiters } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      count: vi.fn(), // For exists() check
      create: vi.fn(), // For new services
      update: vi.fn(), // For existing services
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    serviceCreate: vi.fn().mockResolvedValue(true), // Allow by default
  },
}))

describe('GET /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return services for authenticated provider', async () => {
    // Arrange
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

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices as any)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based testing
    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].name).toBe('Hovslagning')
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange - auth() throws Response for unauthenticated users
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

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
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'customer' },
    } as any)

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
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
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
    // Reset rate limiter to allow by default
    vi.mocked(rateLimiters.serviceCreate).mockResolvedValue(true)
  })

  it('should create service for authenticated provider', async () => {
    // Arrange
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
      isActive: true,
      createdAt: new Date(),
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.count).mockResolvedValue(0) // Service doesn't exist
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

    // Assert - Behavior-based testing
    expect(response.status).toBe(201)
    expect(data.name).toBe('Hovslagning')
    expect(data.price).toBe(800)
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange - auth() throws Response for unauthenticated users
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

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
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
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
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
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
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
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

  it('should return 429 when rate limited', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(rateLimiters.serviceCreate).mockResolvedValue(false) // Rate limited

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
    expect(response.status).toBe(429)
    expect(data.error).toContain('tjänster')
  })
})
