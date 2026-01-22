import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Test UUIDs (valid v4 format - note: 4th segment must start with 8/9/a/b for variant bits)
const TEST_UUIDS = {
  customer: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  providerUser: '33333333-3333-4333-8333-333333333333',
  service: '44444444-4444-4444-8444-444444444444',
  booking: '55555555-5555-4555-8555-555555555555',
  routeOrder: '66666666-6666-4666-8666-666666666666',
}

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Create mock auth function in the factory to avoid hoisting issues
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

// Get reference to mocked auth after imports
import { auth as mockAuth } from '@/lib/auth-server'

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

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true), // Always allow by default
  },
}))

describe('GET /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return bookings for authenticated customer', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    const mockBookings = [
      {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: new Date('2025-11-20'),
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        provider: {
          id: TEST_UUIDS.provider,
          businessName: 'Test Provider',
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        service: {
          id: TEST_UUIDS.service,
          name: 'Hovslagning',
          price: 800,
        },
      },
    ]

    mockAuth.mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe(TEST_UUIDS.booking)
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { customerId: TEST_UUIDS.customer },
      include: {
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        service: true,
      },
      orderBy: { bookingDate: 'desc' },
    })
  })

  it('should return bookings for authenticated provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: TEST_UUIDS.provider,
      userId: TEST_UUIDS.providerUser,
    }

    const mockBookings = [
      {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        status: 'confirmed',
        customer: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '0701234567',
        },
        service: {
          id: TEST_UUIDS.service,
          name: 'Hovslagning',
        },
      },
    ]

    mockAuth.mockResolvedValue(mockSession as any)
    // @ts-ignore - CI-specific type instantiation depth issue
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].customer.firstName).toBe('Jane')
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { providerId: TEST_UUIDS.provider },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        service: true,
      },
      orderBy: { bookingDate: 'desc' },
    })
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    const { NextResponse } = await import('next/server')
    const unauthorizedResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    mockAuth.mockRejectedValue(unauthorizedResponse)

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
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    mockAuth.mockResolvedValue(mockSession as any)
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
    }

    const mockBooking = {
      id: TEST_UUIDS.booking,
      customerId: TEST_UUIDS.customer,
      providerId: TEST_UUIDS.provider,
      serviceId: TEST_UUIDS.service,
      bookingDate: new Date('2025-11-20'),
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

    mockAuth.mockResolvedValue(mockSession as any)
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
        bookingDate: '2025-11-20',
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
    // Arrange
    const { NextResponse } = await import('next/server')
    const unauthorizedResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    mockAuth.mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: '2025-11-20',
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
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    mockAuth.mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: '99999999-9999-4999-8999-999999999999', // Nonexistent
        bookingDate: '2025-11-20',
        startTime: '10:00',
        endTime: '11:00',
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid service')
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
      providerId: '88888888-8888-4888-8888-888888888888', // Different provider
    }

    mockAuth.mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        bookingDate: '2025-11-20',
        startTime: '10:00',
        endTime: '11:00',
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid service')
  })

  it('should return 400 for invalid data - missing required fields', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    mockAuth.mockResolvedValue(mockSession as any)

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
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        routeOrderId: TEST_UUIDS.routeOrder, // LINKED!
        bookingDate: new Date('2025-12-15'),
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

      mockAuth.mockResolvedValue(mockSession as any)
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
          bookingDate: '2025-12-15',
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
      }

      const mockBooking = {
        id: TEST_UUIDS.booking,
        customerId: TEST_UUIDS.customer,
        providerId: TEST_UUIDS.provider,
        serviceId: TEST_UUIDS.service,
        routeOrderId: null, // NOT LINKED
        bookingDate: new Date('2025-12-15'),
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

      mockAuth.mockResolvedValue(mockSession as any)
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
          bookingDate: '2025-12-15',
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

    it('should return 404 when routeOrderId does not exist', async () => {
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
      }

      mockAuth.mockResolvedValue(mockSession as any)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

      // Mock $transaction to simulate Prisma foreign key constraint error
      // @ts-expect-error - Vitest type instantiation depth limitation
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const { Prisma } = await import('@prisma/client')
        throw new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint failed',
          'P2003'
        )
      })

      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: '2025-12-15',
          startTime: '10:00',
          endTime: '11:00',
          routeOrderId: '99999999-9999-4999-8999-999999999999', // Nonexistent routeOrder
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('RouteOrder hittades inte')
    })
  })

  describe('Regression Tests - Exploratory Testing Session 1 (2026-01-21)', () => {
    describe('Bug #1: Time/Date Validation', () => {
      it('should reject past dates', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2020-01-01T00:00:00Z', // Past date
            startTime: '10:00',
            endTime: '11:00',
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message === 'Cannot book in the past')).toBe(true)
      })

      it('should reject invalid time format', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '25:99', // Invalid time
            endTime: '11:00',
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message.includes('Invalid time format'))).toBe(true)
      })

      it('should reject endTime before startTime', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '18:00',
            endTime: '09:00', // Before startTime
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message === 'End time must be after start time')).toBe(true)
      })

      it('should reject bookings shorter than 15 minutes', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '10:00',
            endTime: '10:10', // Only 10 minutes
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message === 'Booking must be at least 15 minutes long')).toBe(true)
      })

      it('should reject invalid date format', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: 'not-a-date', // Invalid format
            startTime: '10:00',
            endTime: '11:00',
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message.includes('Invalid date format'))).toBe(true)
      })
    })

    describe('Bug #3: String Length Limits', () => {
      it('should reject horseName longer than 100 characters', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const longName = 'a'.repeat(101) // 101 characters

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '10:00',
            endTime: '11:00',
            horseName: longName,
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message.includes('Horse name too long'))).toBe(true)
      })

      it('should reject horseInfo longer than 500 characters', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const longInfo = 'a'.repeat(501) // 501 characters

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '10:00',
            endTime: '11:00',
            horseInfo: longInfo,
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message.includes('Horse info too long'))).toBe(true)
      })

      it('should reject customerNotes longer than 1000 characters', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer,
            userType: 'customer',
          },
        }

        mockAuth.mockResolvedValue(mockSession as any)

        const longNotes = 'a'.repeat(1001) // 1001 characters

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '10:00',
            endTime: '11:00',
            customerNotes: longNotes,
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
        expect(data.details).toBeDefined()
        expect(data.details.some((issue: any) => issue.message.includes('Notes too long'))).toBe(true)
      })
    })

    describe('Bug #4: Self-Booking Prevention', () => {
      it('should reject when customer tries to book their own service', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.providerUser, // Same user is both customer and provider
            userType: 'customer',
          },
        }

        const mockService = {
          id: TEST_UUIDS.service,
          name: 'Hovslagning',
          providerId: TEST_UUIDS.provider,
        }

        const mockProvider = {
          id: TEST_UUIDS.provider,
          userId: TEST_UUIDS.providerUser, // Same userId as session
        }

        mockAuth.mockResolvedValue(mockSession as any)
        vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
        vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

        const request = new NextRequest('http://localhost:3000/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            providerId: TEST_UUIDS.provider,
            serviceId: TEST_UUIDS.service,
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '10:00',
            endTime: '11:00',
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBe('Cannot book your own service')
      })

      it('should allow booking when customer and provider are different users', async () => {
        // Arrange
        const mockSession = {
          user: {
            id: TEST_UUIDS.customer, // Different from provider userId
            userType: 'customer',
          },
        }

        const mockService = {
          id: TEST_UUIDS.service,
          name: 'Hovslagning',
          providerId: TEST_UUIDS.provider,
        }

        const mockProvider = {
          id: TEST_UUIDS.provider,
          userId: '77777777-7777-4777-8777-777777777777', // Different provider user
        }

        const mockBooking = {
          id: TEST_UUIDS.booking,
          customerId: TEST_UUIDS.customer,
          providerId: TEST_UUIDS.provider,
          serviceId: TEST_UUIDS.service,
          bookingDate: new Date('2026-12-15'),
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

        mockAuth.mockResolvedValue(mockSession as any)
        vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
        vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

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
            bookingDate: '2026-12-15T00:00:00Z',
            startTime: '10:00',
            endTime: '11:00',
          }),
        })

        // Act
        const response = await POST(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(201)
        expect(data.id).toBe(TEST_UUIDS.booking)
      })
    })
  })
})
