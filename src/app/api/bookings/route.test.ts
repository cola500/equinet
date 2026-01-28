import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Valid UUIDs for testing (version 4, variant 8/9/a/b)
const TEST_UUIDS = {
  customer: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  providerUser: '33333333-3333-4333-8333-333333333333',
  service: '44444444-4444-4444-8444-444444444444',
  booking: '55555555-5555-4555-8555-555555555555',
  routeOrder: '66666666-6666-4666-8666-666666666666',
  differentProvider: '77777777-7777-4777-8777-777777777777',
}

// Future date for booking tests (to pass "cannot book in the past" validation)
const FUTURE_DATE = new Date()
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 7)
const FUTURE_DATE_ISO = FUTURE_DATE.toISOString()
const FUTURE_DATE_STR = FUTURE_DATE.toISOString().split('T')[0]

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true), // Always allow in tests
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    routeOrder: {
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
    PrismaClientInitializationError: class PrismaClientInitializationError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'PrismaClientInitializationError'
      }
    },
    TransactionIsolationLevel: {
      Serializable: 'Serializable',
    },
  },
}))

describe('GET /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return bookings for authenticated customer', async () => {
    // Arrange
    const mockBookings = [
      {
        id: 'booking1',
        customerId: 'customer123',
        providerId: 'provider123',
        serviceId: 'service1',
        bookingDate: new Date('2025-11-20'),
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        provider: {
          businessName: 'Test Provider',
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        service: {
          name: 'Hovslagning',
          price: 800,
          durationMinutes: 60,
        },
      },
    ]

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based testing (no implementation assertions)
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('booking1')
    expect(data[0].provider.businessName).toBe('Test Provider')
  })

  it('should return bookings for authenticated provider', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockBookings = [
      {
        id: 'booking1',
        customerId: 'customer123',
        providerId: 'provider123',
        serviceId: 'service1',
        status: 'confirmed',
        customer: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '0701234567',
        },
        service: {
          name: 'Hovslagning',
          price: 800,
          durationMinutes: 60,
        },
      },
    ]

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert - Behavior-based testing (no implementation assertions)
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].customer.firstName).toBe('Jane')
    expect(data[0].customer.email).toBe('jane@example.com')
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange - auth() throws Response for unauthenticated users
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 when provider not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})

describe('POST /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for provider (BookingService fetches provider separately)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
      isActive: true,
    } as any)
  })

  it('should create booking for authenticated customer', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    const mockService = {
      id: TEST_UUIDS.service,
      name: 'Hovslagning',
      providerId: TEST_UUIDS.provider,
      durationMinutes: 60,
      isActive: true,
      provider: {
        id: TEST_UUIDS.provider,
        userId: TEST_UUIDS.providerUser, // Different from customer
        isActive: true,
      },
    }

    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: TEST_UUIDS.customer,
      providerId: TEST_UUIDS.provider,
      serviceId: TEST_UUIDS.service,
      bookingDate: FUTURE_DATE,
      startTime: '10:00',
      endTime: '11:00',
      horseName: 'Thunder',
      horseInfo: 'Calm horse',
      customerNotes: 'Please be gentle',
      status: 'pending',
      service: mockService,
      provider: {
        user: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    }

    vi.mocked(auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

    // Mock $transaction to execute the callback immediately with tx object
    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]), // No overlapping bookings
          create: vi.fn().mockResolvedValue(mockBooking),
        },
      }
      return await callback(tx)
    })

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: FUTURE_DATE_ISO,
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'Thunder',
        horseInfo: 'Calm horse',
        customerNotes: 'Please be gentle',
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(201)
    expect(data.id).toBe(TEST_UUIDS.booking)
    expect(data.horseName).toBe('Thunder')
    expect(data.customerNotes).toBe('Please be gentle')
    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange - auth() throws Response for unauthenticated users
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: FUTURE_DATE_ISO,
        startTime: '10:00',
        endTime: '11:00',
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 when service does not exist', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customer, userType: 'customer' },
    } as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: FUTURE_DATE_ISO,
        startTime: '10:00',
        endTime: '11:00',
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert - BookingService returns INACTIVE_SERVICE for null service
    expect(response.status).toBe(400)
    expect(data.error).toBe('Tjänsten är inte längre tillgänglig')
  })

  it('should return 400 when service does not belong to provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    const mockService = {
      id: TEST_UUIDS.service,
      name: 'Hovslagning',
      providerId: TEST_UUIDS.differentProvider, // Different provider!
      durationMinutes: 60,
      isActive: true,
      provider: {
        id: TEST_UUIDS.differentProvider,
        userId: TEST_UUIDS.providerUser,
        isActive: true,
      },
    }

    vi.mocked(auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: FUTURE_DATE_ISO,
        startTime: '10:00',
        endTime: '11:00',
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig tjänst')
  })

  it('should return 400 for invalid data - missing required fields', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    vi.mocked(auth).mockResolvedValue(mockSession as any)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        // Missing serviceId, bookingDate, etc
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  describe('Automatic endTime calculation (US-1)', () => {
    it('should calculate endTime from service.durationMinutes when not provided', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 90, // 90 minute service
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: FUTURE_DATE,
        startTime: '10:00',
        endTime: '11:30', // Calculated: 10:00 + 90min = 11:30
        status: 'pending',
        service: mockService,
        provider: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

      // @ts-expect-error - Vitest type instantiation depth limitation
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(mockBooking),
          },
        }
        return await callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          // NO endTime - should be calculated
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.endTime).toBe('11:30') // 10:00 + 90min = 11:30
    })

    it('should still accept explicit endTime (backward compatibility)', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: FUTURE_DATE,
        startTime: '10:00',
        endTime: '12:00', // Explicit 2 hours, not 60min from service
        status: 'pending',
        service: mockService,
        provider: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

      // @ts-expect-error - Vitest type instantiation depth limitation
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(mockBooking),
          },
        }
        return await callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '12:00', // Explicit - customer wants longer booking
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.endTime).toBe('12:00') // Uses explicit endTime
    })

    it('should return 400 when calculated endTime exceeds business hours', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 120, // 2 hours
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '17:00', // 17:00 + 120min = 19:00, exceeds 18:00
          // NO endTime - should be calculated to 19:00 and fail
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('öppettider')
    })
  })

  describe('RouteOrder Linking (Experiment 003)', () => {
    it('should link booking to routeOrderId when provided', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      // RouteOrder covers booking date
      const mockRouteOrder = {
        id: TEST_UUIDS.routeOrder,
        dateFrom: new Date(FUTURE_DATE.getTime() - 1000 * 60 * 60 * 24), // Yesterday
        dateTo: new Date(FUTURE_DATE.getTime() + 1000 * 60 * 60 * 24 * 7), // 1 week ahead
        status: 'open',
        providerId: TEST_UUIDS.provider,
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        routeOrderId: TEST_UUIDS.routeOrder, // LINKED!
        bookingDate: FUTURE_DATE,
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        service: mockService,
        provider: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
      vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockRouteOrder as any)

      // @ts-expect-error - Vitest type instantiation depth limitation
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(mockBooking),
          },
        }
        return await callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: TEST_UUIDS.routeOrder, // NEW FIELD
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.routeOrderId).toBe(TEST_UUIDS.routeOrder)
    })

    it('should accept bookings without routeOrderId (backward compatibility)', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        routeOrderId: null, // NOT LINKED
        bookingDate: FUTURE_DATE,
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        service: mockService,
        provider: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

      // @ts-expect-error - Vitest type instantiation depth limitation
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(mockBooking),
          },
        }
        return await callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '11:00',
          // NO routeOrderId - should still work
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.routeOrderId).toBeNull()
    })

    it('should return 400 when routeOrderId does not exist', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
      vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: TEST_UUIDS.routeOrder,
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert - BookingService returns 400 for invalid route order
      expect(response.status).toBe(400)
      expect(data.error).toBe('RouteOrder hittades inte')
    })

    it('should return 400 when routeOrder is not open', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      const mockRouteOrder = {
        id: TEST_UUIDS.routeOrder,
        dateFrom: new Date(FUTURE_DATE.getTime() - 1000 * 60 * 60 * 24), // Yesterday
        dateTo: new Date(FUTURE_DATE.getTime() + 1000 * 60 * 60 * 24 * 7), // 1 week ahead
        status: 'closed', // NOT open!
        providerId: TEST_UUIDS.provider,
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
      vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockRouteOrder as any)

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: TEST_UUIDS.routeOrder,
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Rutten är inte längre öppen för bokningar')
    })

    it('should return 400 when booking date is outside routeOrder date range', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      // RouteOrder is 10-14 days from now, but booking is only 7 days from now
      const routeOrderStart = new Date(FUTURE_DATE.getTime() + 1000 * 60 * 60 * 24 * 3) // 3 days after FUTURE_DATE
      const routeOrderEnd = new Date(FUTURE_DATE.getTime() + 1000 * 60 * 60 * 24 * 7) // 7 days after FUTURE_DATE

      const mockRouteOrder = {
        id: TEST_UUIDS.routeOrder,
        dateFrom: routeOrderStart,
        dateTo: routeOrderEnd,
        status: 'open',
        providerId: TEST_UUIDS.provider,
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
      vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockRouteOrder as any)

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO, // This is BEFORE routeOrder.dateFrom
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: TEST_UUIDS.routeOrder,
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Bokningsdatum måste vara inom ruttens datum-spann')
    })

    it('should return 400 when provider does not match routeOrder provider', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      const mockRouteOrder = {
        id: TEST_UUIDS.routeOrder,
        dateFrom: new Date(FUTURE_DATE.getTime() - 1000 * 60 * 60 * 24), // Yesterday
        dateTo: new Date(FUTURE_DATE.getTime() + 1000 * 60 * 60 * 24 * 7), // 1 week ahead
        status: 'open',
        providerId: TEST_UUIDS.differentProvider, // DIFFERENT provider!
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
      vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockRouteOrder as any)

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: TEST_UUIDS.routeOrder,
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Provider matchar inte rutt-annonsen')
    })

    it('should allow booking when routeOrder validations pass', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: TEST_UUIDS.customer,
          userType: 'customer',
        },
      }

      const mockService = {
        id: TEST_UUIDS.service,
        name: 'Hovslagning',
        providerId: TEST_UUIDS.provider,
        durationMinutes: 60,
        isActive: true,
        provider: {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser,
          isActive: true,
        },
      }

      // RouteOrder covers booking date
      const mockRouteOrder = {
        id: TEST_UUIDS.routeOrder,
        dateFrom: new Date(FUTURE_DATE.getTime() - 1000 * 60 * 60 * 24), // Yesterday
        dateTo: new Date(FUTURE_DATE.getTime() + 1000 * 60 * 60 * 24 * 7), // 1 week ahead
        status: 'open',
        providerId: TEST_UUIDS.provider, // Same provider
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        routeOrderId: TEST_UUIDS.routeOrder,
        bookingDate: FUTURE_DATE,
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        service: mockService,
        provider: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      }

      vi.mocked(auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
      vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockRouteOrder as any)

      // @ts-expect-error - Vitest type instantiation depth limitation
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(mockBooking),
          },
        }
        return await callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: FUTURE_DATE_ISO,
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: TEST_UUIDS.routeOrder,
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.routeOrderId).toBe(TEST_UUIDS.routeOrder)
    })
  })
})
