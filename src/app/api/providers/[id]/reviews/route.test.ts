import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}))

const mockReviews = [
  {
    id: 'review-1',
    rating: 5,
    comment: 'Fantastiskt!',
    reply: null,
    repliedAt: null,
    createdAt: new Date('2026-01-20'),
    customer: { firstName: 'Anna', lastName: 'Svensson' },
    booking: { service: { name: 'Hovslagning' } },
  },
  {
    id: 'review-2',
    rating: 4,
    comment: 'Bra service',
    reply: 'Tack för ditt betyg!',
    repliedAt: new Date('2026-01-21'),
    createdAt: new Date('2026-01-19'),
    customer: { firstName: 'Erik', lastName: 'Johansson' },
    booking: { service: { name: 'Massage' } },
  },
]

// Helper to create request with route context
function createRequest(providerId: string, queryParams?: Record<string, string>) {
  const params = new URLSearchParams(queryParams)
  const url = `http://localhost:3000/api/providers/${providerId}/reviews${params.toString() ? `?${params}` : ''}`
  return {
    request: new NextRequest(url),
    params: Promise.resolve({ id: providerId }),
  }
}

describe('GET /api/providers/[id]/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return reviews with aggregated data for a provider', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({ id: 'provider-1' } as any)
    vi.mocked(prisma.review.findMany).mockResolvedValue(mockReviews as any)
    vi.mocked(prisma.review.count).mockResolvedValue(2)
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: 4.5 },
    } as any)

    const { request, params } = createRequest('provider-1')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reviews).toHaveLength(2)
    expect(data.averageRating).toBe(4.5)
    expect(data.totalCount).toBe(2)
    // Verify review shape
    expect(data.reviews[0].customer.firstName).toBe('Anna')
    expect(data.reviews[0].booking.service.name).toBe('Hovslagning')
    // Security: no sensitive data
    expect(data.reviews[0].customer.email).toBeUndefined()
    expect(data.reviews[0].customer.passwordHash).toBeUndefined()
  })

  it('should return empty reviews for provider with no reviews', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({ id: 'provider-1' } as any)
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
    } as any)

    const { request, params } = createRequest('provider-1')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reviews).toHaveLength(0)
    expect(data.averageRating).toBeNull()
    expect(data.totalCount).toBe(0)
  })

  it('should support pagination with page and limit', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({ id: 'provider-1' } as any)
    vi.mocked(prisma.review.findMany).mockResolvedValue([mockReviews[1]] as any)
    vi.mocked(prisma.review.count).mockResolvedValue(2)
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: 4.5 },
    } as any)

    const { request, params } = createRequest('provider-1', { page: '2', limit: '1' })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reviews).toHaveLength(1)
    expect(data.totalCount).toBe(2)
    expect(data.page).toBe(2)
    expect(data.limit).toBe(1)
  })

  it('should return 404 when provider not found', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const { request, params } = createRequest('nonexistent')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})
