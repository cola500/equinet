import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Valid UUIDs for testing
const TEST_UUIDS = {
  providerUser: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  customer1: '33333333-3333-4333-8333-333333333333',
  customer2: '44444444-4444-4444-8444-444444444444',
  customer3: '55555555-5555-4555-8555-555555555555',
}

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
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

const makeRequest = (params = '') =>
  new NextRequest(`http://localhost:3000/api/provider/customers${params}`)

describe('GET /api/provider/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated provider
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'provider' },
    } as any)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
    } as any)
  })

  // --- Auth & Authorization ---

  it('should return 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
  })

  it('should return 403 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-user', userType: 'customer' },
    } as any)

    const response = await GET(makeRequest())
    expect(response.status).toBe(403)
  })

  it('should return 404 when provider profile not found', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const response = await GET(makeRequest())
    expect(response.status).toBe(404)
  })

  // --- Customer list ---

  it('should return unique customers from completed bookings', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-15'),
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: '070-1234567',
        },
        horse: { id: 'horse-1', name: 'Blansen' },
        service: { name: 'Hovslagning' },
      },
      {
        id: 'booking-2',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-20'),
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: '070-1234567',
        },
        horse: { id: 'horse-1', name: 'Blansen' },
        service: { name: 'Hovslagning' },
      },
      {
        id: 'booking-3',
        customerId: TEST_UUIDS.customer2,
        status: 'completed',
        bookingDate: new Date('2025-06-01'),
        customer: {
          id: TEST_UUIDS.customer2,
          firstName: 'Erik',
          lastName: 'Johansson',
          email: 'erik@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Massage' },
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    // Should deduplicate: 3 bookings -> 2 unique customers
    expect(data.customers).toHaveLength(2)

    // First customer
    const anna = data.customers.find((c: any) => c.firstName === 'Anna')
    expect(anna).toBeDefined()
    expect(anna.email).toBe('anna@test.com')
    expect(anna.phone).toBe('070-1234567')
    expect(anna.bookingCount).toBe(2)
    expect(anna.lastBookingDate).toBeDefined()

    // Second customer
    const erik = data.customers.find((c: any) => c.firstName === 'Erik')
    expect(erik).toBeDefined()
    expect(erik.bookingCount).toBe(1)

    // SECURITY: should NOT expose passwordHash
    expect(anna.passwordHash).toBeUndefined()
    expect(erik.passwordHash).toBeUndefined()
  })

  it('should include horse information per customer', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-15'),
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: null,
        },
        horse: { id: 'horse-1', name: 'Blansen' },
        service: { name: 'Hovslagning' },
      },
      {
        id: 'booking-2',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-20'),
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: null,
        },
        horse: { id: 'horse-2', name: 'Pransen' },
        service: { name: 'Massage' },
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    const anna = data.customers[0]
    // Should have 2 unique horses
    expect(anna.horses).toHaveLength(2)
    expect(anna.horses.map((h: any) => h.name)).toContain('Blansen')
    expect(anna.horses.map((h: any) => h.name)).toContain('Pransen')
  })

  // --- Filtering ---

  it('should filter active customers (booking within 12 months)', async () => {
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const mockBookings = [
      {
        id: 'booking-1',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-15'), // Recent
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Hovslagning' },
      },
      {
        id: 'booking-2',
        customerId: TEST_UUIDS.customer2,
        status: 'completed',
        bookingDate: new Date('2024-06-01'), // Old
        customer: {
          id: TEST_UUIDS.customer2,
          firstName: 'Erik',
          lastName: 'Johansson',
          email: 'erik@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Massage' },
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const response = await GET(makeRequest('?status=active'))
    const data = await response.json()

    expect(response.status).toBe(200)
    // Only Anna should be active (recent booking)
    expect(data.customers).toHaveLength(1)
    expect(data.customers[0].firstName).toBe('Anna')
  })

  it('should filter inactive customers (no booking within 12 months)', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-15'), // Recent
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Hovslagning' },
      },
      {
        id: 'booking-2',
        customerId: TEST_UUIDS.customer2,
        status: 'completed',
        bookingDate: new Date('2024-06-01'), // Old
        customer: {
          id: TEST_UUIDS.customer2,
          firstName: 'Erik',
          lastName: 'Johansson',
          email: 'erik@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Massage' },
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const response = await GET(makeRequest('?status=inactive'))
    const data = await response.json()

    expect(response.status).toBe(200)
    // Only Erik should be inactive (old booking)
    expect(data.customers).toHaveLength(1)
    expect(data.customers[0].firstName).toBe('Erik')
  })

  // --- Search ---

  it('should filter by search query on name', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-15'),
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Hovslagning' },
      },
      {
        id: 'booking-2',
        customerId: TEST_UUIDS.customer2,
        status: 'completed',
        bookingDate: new Date('2026-01-10'),
        customer: {
          id: TEST_UUIDS.customer2,
          firstName: 'Erik',
          lastName: 'Johansson',
          email: 'erik@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Massage' },
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const response = await GET(makeRequest('?q=anna'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.customers).toHaveLength(1)
    expect(data.customers[0].firstName).toBe('Anna')
  })

  it('should filter by search query on email', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        customerId: TEST_UUIDS.customer1,
        status: 'completed',
        bookingDate: new Date('2026-01-15'),
        customer: {
          id: TEST_UUIDS.customer1,
          firstName: 'Anna',
          lastName: 'Svensson',
          email: 'anna@test.com',
          phone: null,
        },
        horse: null,
        service: { name: 'Hovslagning' },
      },
    ]

    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const response = await GET(makeRequest('?q=anna@test'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.customers).toHaveLength(1)
  })

  // --- IDOR protection ---

  it('should only return customers from bookings with the authenticated provider', async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.customers).toHaveLength(0)

    // Verify the query used the correct provider ID filter
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: TEST_UUIDS.provider,
        }),
      })
    )
  })

  // --- Empty state ---

  it('should return empty list for provider with no bookings', async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.customers).toEqual([])
  })
})
