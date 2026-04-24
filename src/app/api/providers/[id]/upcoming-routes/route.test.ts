import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    routeOrder: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { prisma } from '@/lib/prisma'

const makeRequest = (providerId: string) =>
  new NextRequest(`http://localhost:3000/api/providers/${providerId}/upcoming-routes`)

describe('GET /api/providers/[id]/upcoming-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])
  })

  it('should return upcoming routes for a provider', async () => {
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([
      {
        id: 'route-1',
        dateFrom: new Date('2026-05-10'),
        dateTo: new Date('2026-05-11'),
        municipality: 'Södermanland',
        serviceType: 'hovslagare',
      },
      {
        id: 'route-2',
        dateFrom: new Date('2026-05-20'),
        dateTo: new Date('2026-05-21'),
        municipality: 'Uppland',
        serviceType: 'hovslagare',
      },
    ] as never)

    const response = await GET(makeRequest('provider-1'), {
      params: Promise.resolve({ id: 'provider-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      id: 'route-1',
      municipality: 'Södermanland',
    })
    expect(data[0].dateFrom).toBeDefined()
    expect(data[0].dateTo).toBeDefined()
  })

  it('should pass take:3 to the query so at most 3 routes are returned', async () => {
    // Prisma respects take:3 in the real DB. Here we verify the query is called
    // with that constraint by having the mock return exactly 3 (as Prisma would).
    const threeRoutes = Array.from({ length: 3 }, (_, i) => ({
      id: `route-${i}`,
      dateFrom: new Date(`2026-05-${10 + i}`),
      dateTo: new Date(`2026-05-${11 + i}`),
      municipality: 'Södermanland',
      serviceType: 'hovslagare',
    }))
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue(threeRoutes as never)

    const response = await GET(makeRequest('provider-1'), {
      params: Promise.resolve({ id: 'provider-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(3)
    // Verify take:3 is passed in query (Prisma enforces the cap in the real DB)
    expect(vi.mocked(prisma.routeOrder.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    )
  })

  it('should return 404 when feature flag is disabled', async () => {
    const { isFeatureEnabled } = await import('@/lib/feature-flags')
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)

    const response = await GET(makeRequest('provider-1'), {
      params: Promise.resolve({ id: 'provider-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('should return empty array when provider has no upcoming routes', async () => {
    vi.mocked(prisma.routeOrder.findMany).mockResolvedValue([])

    const response = await GET(makeRequest('provider-1'), {
      params: Promise.resolve({ id: 'provider-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it('should return 429 when rate limit exceeded', async () => {
    const { rateLimiters } = await import('@/lib/rate-limit')
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const response = await GET(makeRequest('provider-1'), {
      params: Promise.resolve({ id: 'provider-1' }),
    })

    expect(response.status).toBe(429)
  })
})
