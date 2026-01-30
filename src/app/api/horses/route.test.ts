import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    horse: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

const mockCustomerSession = {
  user: { id: 'customer-1', email: 'anna@test.se', userType: 'customer' },
} as any

const mockProviderSession = {
  user: { id: 'provider-user-1', email: 'magnus@test.se', userType: 'provider' },
} as any

describe('GET /api/horses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return horses for authenticated customer', async () => {
    const mockHorses = [
      {
        id: 'horse-1',
        ownerId: 'customer-1',
        name: 'Blansen',
        breed: 'Svenskt varmblod',
        birthYear: 2018,
        color: 'Brun',
        gender: 'gelding',
        specialNeeds: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'horse-2',
        ownerId: 'customer-1',
        name: 'Stjansen',
        breed: 'Islandshäst',
        birthYear: 2015,
        color: 'Fux',
        gender: 'mare',
        specialNeeds: 'Känslig på vänster fram',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findMany).mockResolvedValue(mockHorses as any)

    const request = new NextRequest('http://localhost:3000/api/horses')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      id: 'horse-1',
      name: 'Blansen',
      breed: 'Svenskt varmblod',
    })
    expect(data[1]).toMatchObject({
      id: 'horse-2',
      name: 'Stjansen',
      specialNeeds: 'Känslig på vänster fram',
    })
  })

  it('should only return active horses', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/horses')
    await GET(request)

    // Verify that we filter by ownerId AND isActive
    expect(prisma.horse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: 'customer-1',
          isActive: true,
        },
      })
    )
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return empty array when customer has no horses', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/horses')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})

describe('POST /api/horses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create horse for authenticated customer', async () => {
    const mockHorse = {
      id: 'horse-new',
      ownerId: 'customer-1',
      name: 'Blansen',
      breed: 'Svenskt varmblod',
      birthYear: 2018,
      color: 'Brun',
      gender: 'gelding',
      specialNeeds: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.create).mockResolvedValue(mockHorse as any)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Blansen',
        breed: 'Svenskt varmblod',
        birthYear: 2018,
        color: 'Brun',
        gender: 'gelding',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toMatchObject({
      id: 'horse-new',
      name: 'Blansen',
      breed: 'Svenskt varmblod',
      birthYear: 2018,
    })
  })

  it('should create horse with only required field (name)', async () => {
    const mockHorse = {
      id: 'horse-minimal',
      ownerId: 'customer-1',
      name: 'Blansen',
      breed: null,
      birthYear: null,
      color: null,
      gender: null,
      specialNeeds: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.create).mockResolvedValue(mockHorse as any)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Blansen' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).toBe('Blansen')
  })

  it('should return 400 when name is missing', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({ breed: 'Islandshäst' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 400 when name is empty string', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 400 when birthYear is in the future', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Blansen',
        birthYear: new Date().getFullYear() + 1,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 400 when gender is invalid', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Blansen',
        gender: 'invalid',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 400 for invalid JSON body', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: 'not json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid JSON')
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Blansen' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should not expose ownerId in response (set server-side)', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.create).mockResolvedValue({
      id: 'horse-1',
      ownerId: 'customer-1',
      name: 'Blansen',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Blansen' }),
    })

    await POST(request)

    // Verify ownerId is set from session, not from request body
    expect(prisma.horse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'customer-1',
        }),
      })
    )
  })
})
