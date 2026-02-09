import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

const mockReview = {
  id: 'review-1',
  rating: 4,
  comment: 'Bra service',
  customerId: 'user-1',
  providerId: 'provider-1',
  bookingId: 'booking-1',
  reply: null,
  repliedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createRequest(reviewId: string, method: string, body?: object) {
  return {
    request: new NextRequest(`http://localhost:3000/api/reviews/${reviewId}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    params: Promise.resolve({ id: reviewId }),
  }
}

describe('PUT /api/reviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update review rating and comment', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    vi.mocked(prisma.review.update).mockResolvedValue({
      ...mockReview,
      rating: 5,
      comment: 'Uppdaterad kommentar',
    } as any)

    const { request, params } = createRequest('review-1', 'PUT', {
      rating: 5,
      comment: 'Uppdaterad kommentar',
    })

    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.rating).toBe(5)
    expect(data.comment).toBe('Uppdaterad kommentar')
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { request, params } = createRequest('review-1', 'PUT', { rating: 5 })
    const response = await PUT(request, { params })
    expect(response.status).toBe(401)
  })

  it('should return 404 when review not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    // updateWithAuth returns null (P2025)
    const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    vi.mocked(prisma.review.update).mockRejectedValue(p2025Error)
    // exists check: count returns 0
    vi.mocked(prisma.review.count).mockResolvedValue(0)

    const { request, params } = createRequest('nonexistent', 'PUT', { rating: 5 })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Omdöme hittades inte')
  })

  it('should return 403 when customer does not own the review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'other-user', userType: 'customer' },
    } as any)
    // updateWithAuth returns null because customerId doesn't match
    const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    vi.mocked(prisma.review.update).mockRejectedValue(p2025Error)
    // exists check: review exists, so it's an auth issue
    vi.mocked(prisma.review.count).mockResolvedValue(1)

    const { request, params } = createRequest('review-1', 'PUT', { rating: 5 })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Ej behörig')
  })

  it('should return 400 for invalid rating', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const { request, params } = createRequest('review-1', 'PUT', { rating: 0 })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for comment exceeding 500 characters', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const { request, params } = createRequest('review-1', 'PUT', {
      rating: 5,
      comment: 'a'.repeat(501),
    })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })
})

describe('DELETE /api/reviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    vi.mocked(prisma.review.delete).mockResolvedValue(mockReview as any)

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })

    expect(response.status).toBe(204)
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })
    expect(response.status).toBe(401)
  })

  it('should return 404 when review not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)
    // deleteWithAuth returns false (P2025)
    const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    vi.mocked(prisma.review.delete).mockRejectedValue(p2025Error)
    // exists check: count returns 0
    vi.mocked(prisma.review.count).mockResolvedValue(0)

    const { request, params } = createRequest('nonexistent', 'DELETE')
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Omdöme hittades inte')
  })

  it('should return 403 when customer does not own the review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'other-user', userType: 'customer' },
    } as any)
    // deleteWithAuth returns false (P2025 because customerId doesn't match)
    const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    vi.mocked(prisma.review.delete).mockRejectedValue(p2025Error)
    // exists check: review exists, so it's an auth issue
    vi.mocked(prisma.review.count).mockResolvedValue(1)

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Ej behörig')
  })
})
