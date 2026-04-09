import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { getAuthUser } from '@/lib/auth-dual'
import { prisma } from '@/lib/prisma'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { rateLimiters } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
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
    api: vi.fn().mockResolvedValue(true),
    serviceCreate: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('GET /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
  })

  it('should return services for authenticated provider (via Supabase RLS)', async () => {
    // Arrange
    const mockServices = [
      {
        id: 'service1',
        name: 'Hovslagning',
        description: 'Standard hovslagning',
        price: 800,
        durationMinutes: 60,
        providerId: 'provider123',
      },
      {
        id: 'service2',
        name: 'Massage',
        price: 600,
        durationMinutes: 45,
        providerId: 'provider123',
      },
    ]

    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockServices, error: null }),
          }),
        }),
      }),
    } as never)

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
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 403 when user is not a provider', async () => {
    // Arrange
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'customer', isAdmin: false,
      providerId: null, stableId: null, authMethod: 'supabase' as const,
    })

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Åtkomst nekad')
  })

  it('should return empty list when provider has no services (RLS filters)', async () => {
    // With Supabase RLS, a provider without services gets an empty array
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as never)

    const request = new NextRequest('http://localhost:3000/api/services')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert -- RLS returns empty array, not 404
    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
  })

  it('returns 401 when session is null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const request = new NextRequest('http://localhost:3000/api/services')
    const response = await GET(request)
    expect(response.status).toBe(401)
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

    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.service.count).mockResolvedValue(0) // Service doesn't exist
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as never)

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
    vi.mocked(getAuthUser).mockResolvedValue(null)

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
    expect(data.error).toBe('Ej inloggad')
  })

  it('returns 401 when session is null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const request = new NextRequest('http://localhost:3000/api/services', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', price: 100, durationMinutes: 30 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 for invalid data - missing name', async () => {
    // Arrange
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })

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
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid data - negative price', async () => {
    // Arrange
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })

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
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid data - zero duration', async () => {
    // Arrange
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })

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
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 429 when rate limited', async () => {
    // Arrange
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user123', email: '', userType: 'provider', isAdmin: false,
      providerId: 'provider123', stableId: null, authMethod: 'supabase' as const,
    })
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
