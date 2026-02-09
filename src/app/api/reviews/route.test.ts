import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
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
    review: {
      create: vi.fn(),
    },
    provider: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'provider-user-1' }),
    },
  },
}))

vi.mock('@/domain/notification/NotificationService', () => ({
  notificationService: {
    createAsync: vi.fn(),
  },
  NotificationType: {
    REVIEW_RECEIVED: 'review_received',
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
}))

const mockBooking = {
  id: 'booking-1',
  customerId: 'user-1',
  providerId: 'provider-1',
  status: 'completed',
  review: null,
  service: { name: 'Hovslagning' },
}

describe('POST /api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a review for a completed booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.review.create).mockResolvedValue({
      id: 'review-1',
      rating: 5,
      comment: 'Utmärkt service!',
      bookingId: 'booking-1',
      customerId: 'user-1',
      providerId: 'provider-1',
      reply: null,
      repliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 5,
        comment: 'Utmärkt service!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.rating).toBe(5)
    expect(data.comment).toBe('Utmärkt service!')
    expect(data.bookingId).toBe('booking-1')
  })

  it('should create a review without comment', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.review.create).mockResolvedValue({
      id: 'review-1',
      rating: 3,
      comment: null,
      bookingId: 'booking-1',
      customerId: 'user-1',
      providerId: 'provider-1',
      reply: null,
      repliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: 'booking-1',
        rating: 3,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.rating).toBe(3)
    expect(data.comment).toBeNull()
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 401 when user is not a customer', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
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
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
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
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
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
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
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
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'nonexistent', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Booking not found')
  })

  it('should return 403 when customer does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'other-user', userType: 'customer' },
    } as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
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
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      status: 'confirmed',
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1', rating: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('completed')
  })

  it('should return 409 when review already exists for booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      review: { id: 'existing-review' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
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
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })
})
