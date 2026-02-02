import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      findFirst: vi.fn(),
    },
    horse: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/customers/:id/horses', () => {
  const customerId = '11111111-1111-4111-8111-111111111111'

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
      userId: 'provider-user-1',
    } as any)

    // Default: provider has a booking with this customer
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({
      id: 'booking-1',
    } as any)
  })

  function makeRequest() {
    return new NextRequest(`http://localhost:3000/api/customers/${customerId}/horses`)
  }

  it('should return customer horses when provider has booking relation', async () => {
    vi.mocked(prisma.horse.findMany).mockResolvedValue([
      { id: 'h1', name: 'Thunder', breed: 'Warmblood', birthYear: 2015, gender: 'gelding' },
      { id: 'h2', name: 'Storm', breed: 'Icelandic', birthYear: 2018, gender: 'mare' },
    ] as any)

    const request = makeRequest()
    const response = await GET(request, { params: Promise.resolve({ id: customerId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].name).toBe('Thunder')
    // Should not expose sensitive fields
    expect(data[0].specialNeeds).toBeUndefined()
  })

  it('should return 403 when provider has no booking with customer', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(null)

    const request = makeRequest()
    const response = await GET(request, { params: Promise.resolve({ id: customerId }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Forbidden')
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-1', userType: 'customer' },
    } as any)

    const request = makeRequest()
    const response = await GET(request, { params: Promise.resolve({ id: customerId }) })

    expect(response.status).toBe(403)
  })

  it('should return empty array when customer has no horses', async () => {
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])

    const request = makeRequest()
    const response = await GET(request, { params: Promise.resolve({ id: customerId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
  })
})
