import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
    vi.mocked(prisma.review.findUnique).mockResolvedValue(mockReview as any)
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
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)

    const { request, params } = createRequest('nonexistent', 'PUT', { rating: 5 })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Review not found')
  })

  it('should return 403 when customer does not own the review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'other-user', userType: 'customer' },
    } as any)
    vi.mocked(prisma.review.findUnique).mockResolvedValue(mockReview as any)

    const { request, params } = createRequest('review-1', 'PUT', { rating: 5 })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not authorized')
  })

  it('should return 400 for invalid rating', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const { request, params } = createRequest('review-1', 'PUT', { rating: 0 })
    const response = await PUT(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
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
    expect(data.error).toBe('Validation error')
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
    vi.mocked(prisma.review.findUnique).mockResolvedValue(mockReview as any)
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
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)

    const { request, params } = createRequest('nonexistent', 'DELETE')
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Review not found')
  })

  it('should return 403 when customer does not own the review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'other-user', userType: 'customer' },
    } as any)
    vi.mocked(prisma.review.findUnique).mockResolvedValue(mockReview as any)

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not authorized')
  })
})
