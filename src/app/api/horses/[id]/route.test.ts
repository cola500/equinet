import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT, DELETE } from './route'
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
  getHorse: vi.fn(),
  updateHorse: vi.fn(),
  softDeleteHorse: vi.fn(),
}

vi.mock('@/domain/horse/HorseService', () => ({
  createHorseService: () => mockService,
}))

const mockCustomerSession = {
  user: { id: 'customer-1', email: 'anna@test.se', userType: 'customer' },
} as never

const mockHorse = {
  id: 'horse-1',
  ownerId: 'customer-1',
  name: 'Blansen',
  breed: 'Svenskt varmblod',
  birthYear: 2018,
  color: 'Brun',
  gender: 'gelding',
  specialNeeds: null,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
}

const makeParams = (id: string) => Promise.resolve({ id })

describe('GET /api/horses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return horse with booking history for owner', async () => {
    const horseWithBookings = {
      ...mockHorse,
      bookings: [
        {
          id: 'booking-1',
          bookingDate: new Date('2026-01-10'),
          startTime: '09:00',
          endTime: '10:00',
          status: 'completed',
          provider: { businessName: 'Magnus Hovslageri' },
          service: { name: 'Hovslagning' },
        },
      ],
    }

    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.getHorse.mockResolvedValue(Result.ok(horseWithBookings))

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1')
    const response = await GET(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      id: 'horse-1',
      name: 'Blansen',
      breed: 'Svenskt varmblod',
    })
    expect(data.bookings).toHaveLength(1)
    expect(data.bookings[0].provider.businessName).toBe('Magnus Hovslageri')
  })

  it('should return 404 when horse not found or not owned by user', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.getHorse.mockResolvedValue(
      Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    )

    const request = new NextRequest('http://localhost:3000/api/horses/horse-999')
    const response = await GET(request, { params: makeParams('horse-999') })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Ej inloggad' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1')
    const response = await GET(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })
})

describe('PUT /api/horses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update horse for owner', async () => {
    const updatedHorse = {
      ...mockHorse,
      name: 'Blansen III',
      specialNeeds: 'Ny info om hovproblem',
    }

    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.updateHorse.mockResolvedValue(Result.ok(updatedHorse))

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Blansen III',
        specialNeeds: 'Ny info om hovproblem',
      }),
    })

    const response = await PUT(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe('Blansen III')
    expect(data.specialNeeds).toBe('Ny info om hovproblem')
  })

  it('should allow partial updates', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.updateHorse.mockResolvedValue(Result.ok({
      ...mockHorse,
      specialNeeds: 'Ny info',
    }))

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'PUT',
      body: JSON.stringify({ specialNeeds: 'Ny info' }),
    })

    const response = await PUT(request, { params: makeParams('horse-1') })

    expect(response.status).toBe(200)
  })

  it('should return 404 when horse not found or not owned', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.updateHorse.mockResolvedValue(
      Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    )

    const request = new NextRequest('http://localhost:3000/api/horses/horse-999', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Hacked' }),
    })

    const response = await PUT(request, { params: makeParams('horse-999') })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it('should return 400 for invalid data', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
    })

    const response = await PUT(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid JSON', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'PUT',
      body: 'not json',
    })

    const response = await PUT(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })
})

describe('DELETE /api/horses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should soft-delete horse', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.softDeleteHorse.mockResolvedValue(Result.ok(undefined))

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBeDefined()
  })

  it('should return 404 when horse not found or not owned', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.softDeleteHorse.mockResolvedValue(
      Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    )

    const request = new NextRequest('http://localhost:3000/api/horses/horse-999', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: makeParams('horse-999') })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Ej inloggad' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })
})
