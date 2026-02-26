import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const TEST_UUIDS = {
  customer: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  providerUser: '33333333-3333-4333-8333-333333333333',
  service: '44444444-4444-4444-8444-444444444444',
  booking: '55555555-5555-4555-8555-555555555555',
}

const FUTURE_DATE = new Date()
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 7)
const FUTURE_DATE_STR = FUTURE_DATE.toISOString().split('T')[0]

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true),
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
    },
    service: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    availabilityException: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string
      constructor(message: string, code: string) {
        super(message)
        this.code = code
        this.name = 'PrismaClientKnownRequestError'
      }
    },
    TransactionIsolationLevel: {
      Serializable: 'Serializable',
    },
  },
}))

describe('POST /api/bookings/manual', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: provider session
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'provider' },
    } as never)

    // Default: provider exists
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
      isActive: true,
    } as never)

    // Default: service exists
    vi.mocked(prisma.service.findUnique).mockResolvedValue({
      id: TEST_UUIDS.service,
      providerId: TEST_UUIDS.provider,
      durationMinutes: 60,
      isActive: true,
    } as never)

    // Default: no existing bookings (no overlap)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])

    // Default: customer location
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      latitude: 57.7089,
      longitude: 11.9746,
      address: 'Test',
    } as never)

    // Default: no availability exception (day is open)
    vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(null)
  })

  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost:3000/api/bookings/manual', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('should create manual booking with existing customer', async () => {
    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: TEST_UUIDS.customer,
      providerId: TEST_UUIDS.provider,
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE,
      startTime: '10:00',
      endTime: '11:00',
      status: 'confirmed',
      isManualBooking: true,
      createdByProviderId: TEST_UUIDS.provider,
      customer: { firstName: 'Anna', lastName: 'Svensson', email: 'anna@test.com' },
      service: { name: 'Hovslagning', price: 800, durationMinutes: 60 },
    }

    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue(mockBooking),
        },
      }
      return await callback(tx)
    })

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerId: TEST_UUIDS.customer,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.status).toBe('confirmed')
    expect(data.isManualBooking).toBe(true)
  })

  it('should create manual booking with ghost user (customerName)', async () => {
    const ghostUserId = 'ghost-user-new'

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null) // No existing user with that email
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: ghostUserId,
      email: 'manual-test@ghost.equinet.se',
      isManualCustomer: true,
    } as never)

    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: ghostUserId,
      providerId: TEST_UUIDS.provider,
      status: 'confirmed',
      isManualBooking: true,
      customer: { firstName: 'Anna', lastName: 'Svensson' },
      service: { name: 'Hovslagning', price: 800, durationMinutes: 60 },
    }

    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue(mockBooking),
        },
      }
      return await callback(tx)
    })

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerName: 'Anna Svensson',
      customerPhone: '070-1234567',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.isManualBooking).toBe(true)
  })

  it('should return 401 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customer, userType: 'customer' },
    } as never)

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerId: TEST_UUIDS.customer,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('leverantör')
  })

  it('should return 400 without customerId or customerName', async () => {
    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      // Neither customerId nor customerName
    })

    const response = await POST(request)
    const _data = await response.json()

    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/bookings/manual', {
      method: 'POST',
      body: 'not json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('should accept +46 phone format', async () => {
    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: 'ghost-user-new',
      providerId: TEST_UUIDS.provider,
      status: 'confirmed',
      isManualBooking: true,
      customer: { firstName: 'Anna', lastName: 'Svensson' },
      service: { name: 'Hovslagning', price: 800, durationMinutes: 60 },
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'ghost-user-new',
      email: 'manual-test@ghost.equinet.se',
      isManualCustomer: true,
    } as never)

    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue(mockBooking),
        },
      }
      return await callback(tx)
    })

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerName: 'Anna Svensson',
      customerPhone: '+46701234567',
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('should accept 07x phone format', async () => {
    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: 'ghost-user-new',
      providerId: TEST_UUIDS.provider,
      status: 'confirmed',
      isManualBooking: true,
      customer: { firstName: 'Anna', lastName: 'Svensson' },
      service: { name: 'Hovslagning', price: 800, durationMinutes: 60 },
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'ghost-user-new',
      email: 'manual-test@ghost.equinet.se',
      isManualCustomer: true,
    } as never)

    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue(mockBooking),
        },
      }
      return await callback(tx)
    })

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerName: 'Anna Svensson',
      customerPhone: '070-123 45 67',
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('should return 500 when ghost user creation fails', async () => {
    // Mock createGhostUser to fail (via service layer)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.user.create).mockRejectedValue(new Error('DB connection lost'))

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerName: 'Anna Svensson',
      customerPhone: '0701234567',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should reject invalid phone format with 400', async () => {
    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerName: 'Anna Svensson',
      customerPhone: 'abc123',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should use providerId from session, not from body (IDOR protection)', async () => {
    const attackerProviderId = '99999999-9999-4999-8999-999999999999'

    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: TEST_UUIDS.customer,
      providerId: TEST_UUIDS.provider, // Should be from session, not body
      status: 'confirmed',
      isManualBooking: true,
      customer: { firstName: 'Anna', lastName: 'Svensson' },
      service: { name: 'Hovslagning', price: 800, durationMinutes: 60 },
    }

    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue(mockBooking),
        },
      }
      return await callback(tx)
    })

    // Attacker tries to pass a different providerId in body
    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerId: TEST_UUIDS.customer,
      providerId: attackerProviderId, // Should be ignored
    })

    const response = await POST(request)
    const data = await response.json()

    // Should succeed with session providerId, not attacker's
    expect(response.status).toBe(201)
    expect(data.providerId).toBe(TEST_UUIDS.provider)
  })

  it('should return 400 when provider has closed the day', async () => {
    vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
      isClosed: true,
      reason: 'Sjuk',
      startTime: null,
      endTime: null,
    } as never)

    const request = makeRequest({
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE_STR,
      startTime: '10:00',
      customerId: TEST_UUIDS.customer,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Sjuk')
  })
})
