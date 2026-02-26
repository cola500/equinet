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
    user: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/customers/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: 'provider-1',
      userId: 'provider-user-1',
    } as never)
  })

  it('should return matching customers', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'c1', firstName: 'Anna', lastName: 'Svensson', email: 'anna@test.com', phone: '070-123' },
    ] as never)

    const request = new NextRequest('http://localhost:3000/api/customers/search?q=anna')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].firstName).toBe('Anna')
    // Should not expose passwordHash
    expect(data[0].passwordHash).toBeUndefined()
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-1', userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/customers/search?q=anna')
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it('should return 400 for too short query', async () => {
    const request = new NextRequest('http://localhost:3000/api/customers/search?q=a')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('should return 400 for missing query', async () => {
    const request = new NextRequest('http://localhost:3000/api/customers/search')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('should include manually added customers (ghost users) in search results', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'c1', firstName: 'Anna', lastName: 'Svensson', email: 'anna@test.com', phone: '070-123' },
      { id: 'c2', firstName: 'Anna', lastName: 'Ghost', email: 'anna-ghost@placeholder.equinet.se', phone: '070-456' },
    ] as never)

    const request = new NextRequest('http://localhost:3000/api/customers/search?q=anna')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)

    // Verify query includes providerCustomerLinks OR bookings (not just bookings)
    const findManyCall = vi.mocked(prisma.user.findMany).mock.calls[0][0]
    const andConditions = findManyCall?.where?.AND as Record<string, unknown>[]

    // Should have an OR condition that includes both bookings and providerCustomerLinks
    const providerRelationCondition = andConditions.find((c: Record<string, unknown>) => (c.OR as Record<string, unknown>[])?.some((or: Record<string, unknown>) => or.providerCustomerLinks))
    expect(providerRelationCondition).toBeDefined()

    // Should NOT have isManualCustomer: false filter
    const manualCustomerFilter = andConditions.find((c: Record<string, unknown>) => c.isManualCustomer === false)
    expect(manualCustomerFilter).toBeUndefined()
  })
})
