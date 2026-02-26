import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, DELETE } from './route'
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
    },
    provider: {
      findUnique: vi.fn(),
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
    request: new NextRequest(`http://localhost:3000/api/reviews/${reviewId}/reply`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    params: Promise.resolve({ id: reviewId }),
  }
}

describe('POST /api/reviews/[id]/reply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add a reply to a review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
    } as never)
    // ReviewService.addReply calls findById (findUnique) then addReplyWithAuth (update)
    vi.mocked(prisma.review.findUnique).mockResolvedValue(mockReview as never)
    vi.mocked(prisma.review.update).mockResolvedValue({
      ...mockReview,
      reply: 'Tack för ditt betyg!',
      repliedAt: new Date(),
    } as never)

    const { request, params } = createRequest('review-1', 'POST', {
      reply: 'Tack för ditt betyg!',
    })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reply).toBe('Tack för ditt betyg!')
    expect(data.repliedAt).toBeDefined()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { request, params } = createRequest('review-1', 'POST', { reply: 'Tack!' })
    const response = await POST(request, { params })
    expect(response.status).toBe(401)
  })

  it('should return 401 when user is not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)

    const { request, params } = createRequest('review-1', 'POST', { reply: 'Tack!' })
    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 404 when review not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
    } as never)
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)

    const { request, params } = createRequest('nonexistent', 'POST', { reply: 'Tack!' })
    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Review not found')
  })

  it('should return 403 when provider does not own the review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'other-provider',
    } as never)
    vi.mocked(prisma.review.findUnique).mockResolvedValue(mockReview as never)

    const { request, params } = createRequest('review-1', 'POST', { reply: 'Tack!' })
    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not authorized')
  })

  it('should return 400 for reply exceeding 500 characters', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)

    const { request, params } = createRequest('review-1', 'POST', {
      reply: 'a'.repeat(501),
    })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 409 when reply already exists', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
    } as never)
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      ...mockReview,
      reply: 'Redan svarat',
      repliedAt: new Date(),
    } as never)

    const { request, params } = createRequest('review-1', 'POST', { reply: 'Nytt svar' })
    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already')
  })
})

describe('DELETE /api/reviews/[id]/reply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a reply', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
    } as never)
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      ...mockReview,
      reply: 'Tack!',
      repliedAt: new Date(),
    } as never)
    vi.mocked(prisma.review.update).mockResolvedValue({
      ...mockReview,
      reply: null,
      repliedAt: null,
    } as never)

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })

    expect(response.status).toBe(204)
  })

  it('should return 404 when review not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
    } as never)
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Review not found')
  })

  it('should return 403 when provider does not own the review', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'other-provider',
    } as never)
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      ...mockReview,
      reply: 'Tack!',
    } as never)

    const { request, params } = createRequest('review-1', 'DELETE')
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not authorized')
  })
})
