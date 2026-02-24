import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { rateLimiters, getClientIP } from '@/lib/rate-limit'
import { sanitizeSearchQuery } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    availabilityException: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeSearchQuery: vi.fn((q: string) => q.trim()),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// --- Test data factory ---

const mockException = (overrides = {}) => ({
  id: 'exc-1',
  providerId: 'provider-1',
  date: new Date('2026-03-15'),
  location: 'Sollebrunn',
  startTime: '09:00',
  endTime: '17:00',
  isClosed: false,
  provider: {
    id: 'provider-1',
    businessName: 'Hovslagare AB',
    description: 'Erfaren hovslagare',
    city: 'Göteborg',
    isActive: true,
    services: [{ id: 's1', name: 'Hovvård', isActive: true }],
    user: { firstName: 'Anna', lastName: 'Svensson' },
  },
  ...overrides,
})

// --- Helpers ---

function makeRequest(location?: string) {
  const url = location !== undefined
    ? `http://localhost:3000/api/providers/visiting-area?location=${encodeURIComponent(location)}`
    : 'http://localhost:3000/api/providers/visiting-area'
  return new NextRequest(url)
}

describe('GET /api/providers/visiting-area', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])
  })

  // --- Rate limiting ---

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const res = await GET(makeRequest('Sollebrunn'))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toBe('För många förfrågningar. Försök igen om en minut.')
    expect(getClientIP).toHaveBeenCalled()
    // Should NOT reach the database
    expect(prisma.availabilityException.findMany).not.toHaveBeenCalled()
  })

  // --- Validation ---

  it('returns 400 when location parameter is missing', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Location parameter required (min 2 characters)')
  })

  it('returns 400 when location is shorter than 2 characters', async () => {
    const res = await GET(makeRequest('A'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Location parameter required (min 2 characters)')
  })

  it('returns 400 when location is empty string', async () => {
    const res = await GET(makeRequest(''))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Location parameter required (min 2 characters)')
  })

  it('returns 400 when location is only whitespace', async () => {
    const res = await GET(makeRequest('   '))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Location parameter required (min 2 characters)')
  })

  // --- Sanitization ---

  it('calls sanitizeSearchQuery with the location parameter', async () => {
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])

    await GET(makeRequest('Sollebrunn'))

    expect(sanitizeSearchQuery).toHaveBeenCalledWith('Sollebrunn')
  })

  // --- Happy path ---

  it('returns providers with visiting area data', async () => {
    const exception = mockException()
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([exception])

    const res = await GET(makeRequest('Sollebrunn'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toEqual({
      provider: {
        id: 'provider-1',
        businessName: 'Hovslagare AB',
        description: 'Erfaren hovslagare',
        city: 'Göteborg',
        services: [{ id: 's1', name: 'Hovvård', isActive: true }],
        user: { firstName: 'Anna', lastName: 'Svensson' },
      },
      nextVisit: {
        date: '2026-03-15',
        location: 'Sollebrunn',
        startTime: '09:00',
        endTime: '17:00',
      },
    })
  })

  // --- Response shape ---

  it('returns correct response shape with searchedLocation and total', async () => {
    const exception = mockException()
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([exception])

    const res = await GET(makeRequest('Sollebrunn'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      data: expect.any(Array),
      searchedLocation: 'Sollebrunn',
      total: 1,
    })
  })

  // --- Deduplication ---

  it('deduplicates: same provider with multiple visits returns only the earliest', async () => {
    const earlierVisit = mockException({
      id: 'exc-1',
      date: new Date('2026-03-10'),
    })
    const laterVisit = mockException({
      id: 'exc-2',
      date: new Date('2026-03-20'),
    })
    // findMany is ordered by date ASC, so earlier comes first
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([
      earlierVisit,
      laterVisit,
    ])

    const res = await GET(makeRequest('Sollebrunn'))
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].nextVisit.date).toBe('2026-03-10')
    expect(body.total).toBe(1)
  })

  // --- Inactive providers ---

  it('filters out inactive providers', async () => {
    const activeException = mockException({
      id: 'exc-1',
      providerId: 'provider-1',
      provider: {
        ...mockException().provider,
        id: 'provider-1',
        isActive: true,
      },
    })
    const inactiveException = mockException({
      id: 'exc-2',
      providerId: 'provider-2',
      provider: {
        ...mockException().provider,
        id: 'provider-2',
        businessName: 'Inaktiv Firma',
        isActive: false,
      },
    })
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([
      activeException,
      inactiveException,
    ])

    const res = await GET(makeRequest('Sollebrunn'))
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].provider.id).toBe('provider-1')
    expect(body.total).toBe(1)
  })

  // --- Empty results ---

  it('returns empty list when no matches are found', async () => {
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])

    const res = await GET(makeRequest('Ingenstans'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
    expect(body.searchedLocation).toBe('Ingenstans')
  })

  // --- Error handling ---

  it('returns 500 on unexpected database error', async () => {
    vi.mocked(prisma.availabilityException.findMany).mockRejectedValueOnce(
      new Error('Database connection lost')
    )

    const res = await GET(makeRequest('Sollebrunn'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Kunde inte hämta leverantörer')
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching providers by visiting area',
      expect.any(Error)
    )
  })

  // --- Prisma query verification ---

  it('queries with correct Prisma filters (case-insensitive, future dates, not closed)', async () => {
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])

    await GET(makeRequest('Sollebrunn'))

    expect(prisma.availabilityException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          location: {
            contains: 'Sollebrunn',
            mode: 'insensitive',
          },
          date: {
            gte: expect.any(Date),
          },
          isClosed: false,
        },
        include: {
          provider: {
            include: {
              services: { where: { isActive: true } },
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      })
    )
  })
})
