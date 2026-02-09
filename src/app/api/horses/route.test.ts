import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
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

// Mock service factory
const mockService = {
  listHorses: vi.fn(),
  createHorse: vi.fn(),
}

vi.mock('@/domain/horse/HorseService', () => ({
  createHorseService: () => mockService,
}))

const mockCustomerSession = {
  user: { id: 'customer-1', email: 'anna@test.se', userType: 'customer' },
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
    mockService.listHorses.mockResolvedValue(Result.ok(mockHorses))

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

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Ej inloggad' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return empty array when customer has no horses', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.listHorses.mockResolvedValue(Result.ok([]))

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
    mockService.createHorse.mockResolvedValue(Result.ok(mockHorse))

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
    mockService.createHorse.mockResolvedValue(Result.ok(mockHorse))

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
    expect(data.error).toBe('Valideringsfel')
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
    expect(data.error).toBe('Valideringsfel')
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
    expect(data.error).toBe('Valideringsfel')
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
    expect(data.error).toBe('Valideringsfel')
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
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Ej inloggad' }),
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
    expect(data.error).toBe('Ej inloggad')
  })

  it('should pass ownerId from session to service', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.createHorse.mockResolvedValue(Result.ok({
      id: 'horse-1',
      ownerId: 'customer-1',
      name: 'Blansen',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const request = new NextRequest('http://localhost:3000/api/horses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Blansen' }),
    })

    await POST(request)

    // Verify ownerId is passed from session
    expect(mockService.createHorse).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blansen' }),
      'customer-1'
    )
  })
})
