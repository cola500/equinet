import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
    customerReview: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
}))

const mockBooking = {
  id: 'booking-1',
  customerId: 'customer-1',
  providerId: 'provider-1',
  status: 'completed',
  customerReview: null,
  customer: { firstName: 'Anna', lastName: 'Svensson' },
  service: { name: 'Hovslagning' },
}

describe('POST /api/customer-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a customer review for a completed booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as never)
    vi.mocked(prisma.customerReview.create).mockResolvedValue({
      id: 'cr-1',
      rating: 4,
      comment: 'Bra kund!',
      bookingId: 'booking-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
      createdAt: new Date(),
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 4,
        comment: 'Bra kund!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.rating).toBe(4)
    expect(data.comment).toBe('Bra kund!')
    expect(data.bookingId).toBe('booking-1')
  })

  it('should create a review without comment', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as never)
    vi.mocked(prisma.customerReview.create).mockResolvedValue({
      id: 'cr-1',
      rating: 5,
      comment: null,
      bookingId: 'booking-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
      createdAt: new Date(),
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 5,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.rating).toBe(5)
    expect(data.comment).toBeNull()
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 401 when user is not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 401 when provider has no providerId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: null },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 400 for invalid rating (too low)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 0 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid rating (too high)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 6 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for comment exceeding 500 characters', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 5,
        comment: 'a'.repeat(501),
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 404 when booking not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'nonexistent', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Booking not found')
  })

  it('should return 403 when provider does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'other-provider' },
    } as never)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not authorized')
  })

  it('should return 400 when booking is not completed', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      status: 'confirmed',
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('completed')
  })

  it('should return 409 when customer review already exists', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      customerReview: { id: 'existing-cr' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already')
  })

  it('should return 400 for invalid JSON', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('should reject extra fields (strict mode)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 5,
        customerId: 'hacked-customer-id', // Should be rejected by strict()
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  // Security: providerId comes from session, not request body
  it('should not allow providerId in request body', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 5,
        providerId: 'attacker-provider', // Should be rejected by strict()
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})

describe('GET /api/customer-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return customer reviews for the provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([
      {
        id: 'cr-1',
        rating: 4,
        comment: 'Bra kund',
        bookingId: 'booking-1',
        providerId: 'provider-1',
        customerId: 'customer-1',
        createdAt: new Date(),
        customer: { firstName: 'Anna', lastName: 'Svensson' },
        booking: { service: { name: 'Hovslagning' }, bookingDate: new Date() },
      },
    ] as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].rating).toBe(4)
    expect(data[0].customer.firstName).toBe('Anna')
  })

  it('should return 401 when not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customer-reviews')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })
})
