import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT, DELETE } from './route'
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
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
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
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(horseWithBookings as any)

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

  it('should use ownership check in WHERE clause (IDOR protection)', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1')
    await GET(request, { params: makeParams('horse-1') })

    // Verify atomic ownership check
    expect(prisma.horse.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'horse-1',
          ownerId: 'customer-1',
          isActive: true,
        },
      })
    )
  })

  it('should return 404 when horse not found or not owned by user', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-999')
    const response = await GET(request, { params: makeParams('horse-999') })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1')
    const response = await GET(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
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
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)
    vi.mocked(prisma.horse.update).mockResolvedValue(updatedHorse as any)

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
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)
    vi.mocked(prisma.horse.update).mockResolvedValue({
      ...mockHorse,
      specialNeeds: 'Ny info',
    } as any)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'PUT',
      body: JSON.stringify({ specialNeeds: 'Ny info' }),
    })

    const response = await PUT(request, { params: makeParams('horse-1') })

    expect(response.status).toBe(200)
  })

  it('should return 404 when horse not found or not owned', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

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
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
    })

    const response = await PUT(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
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
    expect(data.error).toBe('Invalid JSON')
  })
})

describe('DELETE /api/horses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should soft-delete horse (set isActive=false)', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)
    vi.mocked(prisma.horse.update).mockResolvedValue({
      ...mockHorse,
      isActive: false,
    } as any)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBeDefined()

    // Verify soft delete (isActive=false), not hard delete
    expect(prisma.horse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'horse-1' },
        data: { isActive: false },
      })
    )
  })

  it('should return 404 when horse not found or not owned', async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

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
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/horses/horse-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: makeParams('horse-1') })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })
})
