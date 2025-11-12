import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
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
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('GET /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return bookings for authenticated customer', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'customer123',
        userType: 'customer',
      },
    }

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
          id: 'provider123',
          businessName: 'Test Provider',
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        service: {
          id: 'service1',
          name: 'Hovslagning',
          price: 800,
        },
      },
    ]

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)

    const request = new NextRequest('http://localhost:3000/api/bookings')

    // Act
    const response = await GET(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('booking1')
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { customerId: 'customer123' },
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
        id: 'user123',
        userType: 'provider',
      },
    }

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
          id: 'service1',
          name: 'Hovslagning',
        },
      },
    ]

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
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
      where: { providerId: 'provider123' },
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
    vi.mocked(getServerSession).mockResolvedValue(null)

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
        id: 'user123',
        userType: 'provider',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
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
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockService = {
      id: 'service1',
      name: 'Hovslagning',
      providerId: 'provider123',
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      serviceId: 'service1',
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

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([]) // No overlapping bookings
    vi.mocked(prisma.booking.create).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider123',
        serviceId: 'service1',
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
    expect(data.id).toBe('booking1')
    expect(data.horseName).toBe('Thunder')
    expect(prisma.booking.create).toHaveBeenCalledWith({
      data: {
        customerId: 'customer123',
        providerId: 'provider123',
        serviceId: 'service1',
        bookingDate: new Date('2025-11-20'),
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'Thunder',
        horseInfo: 'Calm horse',
        customerNotes: 'Please be gentle',
        status: 'pending',
      },
      include: {
        service: true,
        provider: {
          include: {
            user: true,
          },
        },
      },
    })
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider123',
        serviceId: 'service1',
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
        id: 'customer123',
        userType: 'customer',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider123',
        serviceId: 'nonexistent',
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
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockService = {
      id: 'service1',
      name: 'Hovslagning',
      providerId: 'different-provider', // Different provider!
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as any)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider123',
        serviceId: 'service1',
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
        id: 'customer123',
        userType: 'customer',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)

    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider123',
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
})
