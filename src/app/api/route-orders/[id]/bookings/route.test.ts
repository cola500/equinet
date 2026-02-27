import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Valid UUIDs for testing
const TEST_UUIDS = {
  customer: '11111111-1111-4111-8111-111111111111',
  provider: '22222222-2222-4222-8222-222222222222',
  providerUser: '33333333-3333-4333-8333-333333333333',
  announcement: '44444444-4444-4444-8444-444444444444',
  booking: '55555555-5555-4555-8555-555555555555',
  service: '66666666-6666-4666-8666-666666666666',
  differentProvider: '77777777-7777-4777-8777-777777777777',
}

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    routeOrder: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/route-orders/[id]/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return bookings for provider-owned announcement', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: TEST_UUIDS.provider,
    }

    const mockAnnouncement = {
      id: TEST_UUIDS.announcement,
      providerId: TEST_UUIDS.provider,
      announcementType: 'provider_announced',
      serviceType: 'Hovslagning',
      dateFrom: new Date('2026-01-25'),
      dateTo: new Date('2026-01-30'),
      status: 'open',
    }

    const mockBookings = [
      {
        id: TEST_UUIDS.booking,
        bookingDate: new Date('2026-01-26'),
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        horseName: 'Thunder',
        horseInfo: 'Calm horse',
        customerNotes: 'Call before arrival',
        createdAt: new Date(),
        customer: {
          id: TEST_UUIDS.customer,
          firstName: 'Johan',
          lastName: 'Testsson',
          email: 'johan@test.se',
          phone: '0701234567',
        },
        service: {
          id: TEST_UUIDS.service,
          name: 'Hovslagning',
          price: 800,
          durationMinutes: 60,
        },
      },
    ]

    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockAnnouncement as never)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as never)

    const request = new NextRequest(
      `http://localhost:3000/api/route-orders/${TEST_UUIDS.announcement}/bookings`
    )

    // Act
    const response = await GET(request, { params: Promise.resolve({ id: TEST_UUIDS.announcement }) })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.announcement.id).toBe(TEST_UUIDS.announcement)
    expect(data.bookings).toHaveLength(1)
    expect(data.bookings[0].customer.name).toBe('Johan Testsson')
    expect(data.bookings[0].customer.email).toBe('johan@test.se')
    expect(data.totalBookings).toBe(1)
  })

  it('should return 403 for non-provider users', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.customer,
        userType: 'customer',
      },
    }

    vi.mocked(auth).mockResolvedValue(mockSession as never)

    const request = new NextRequest(
      `http://localhost:3000/api/route-orders/${TEST_UUIDS.announcement}/bookings`
    )

    // Act
    const response = await GET(request, { params: Promise.resolve({ id: TEST_UUIDS.announcement }) })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Endast leverantörer kan se bokningar på annonser')
  })

  it('should return 404 when announcement does not exist', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: TEST_UUIDS.provider,
    }

    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      `http://localhost:3000/api/route-orders/${TEST_UUIDS.announcement}/bookings`
    )

    // Act
    const response = await GET(request, { params: Promise.resolve({ id: TEST_UUIDS.announcement }) })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Annons hittades inte')
  })

  it('should return 403 when announcement belongs to different provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: TEST_UUIDS.provider,
    }

    const mockAnnouncement = {
      id: TEST_UUIDS.announcement,
      providerId: TEST_UUIDS.differentProvider, // Different provider!
      announcementType: 'provider_announced',
      serviceType: 'Hovslagning',
      dateFrom: new Date('2026-01-25'),
      dateTo: new Date('2026-01-30'),
      status: 'open',
    }

    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockAnnouncement as never)

    const request = new NextRequest(
      `http://localhost:3000/api/route-orders/${TEST_UUIDS.announcement}/bookings`
    )

    // Act
    const response = await GET(request, { params: Promise.resolve({ id: TEST_UUIDS.announcement }) })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Du har inte behörighet att se bokningar för denna annons')
  })

  it('should return 400 for customer-initiated route orders', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: TEST_UUIDS.provider,
    }

    const mockRouteOrder = {
      id: TEST_UUIDS.announcement,
      providerId: TEST_UUIDS.provider,
      announcementType: 'customer_initiated', // Not a provider announcement!
      serviceType: 'Hovslagning',
      dateFrom: new Date('2026-01-25'),
      dateTo: new Date('2026-01-30'),
      status: 'open',
    }

    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockRouteOrder as never)

    const request = new NextRequest(
      `http://localhost:3000/api/route-orders/${TEST_UUIDS.announcement}/bookings`
    )

    // Act
    const response = await GET(request, { params: Promise.resolve({ id: TEST_UUIDS.announcement }) })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Detta är inte en leverantörs-annons')
  })

  it('should return empty bookings array when no bookings exist', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: TEST_UUIDS.provider,
    }

    const mockAnnouncement = {
      id: TEST_UUIDS.announcement,
      providerId: TEST_UUIDS.provider,
      announcementType: 'provider_announced',
      serviceType: 'Hovslagning',
      dateFrom: new Date('2026-01-25'),
      dateTo: new Date('2026-01-30'),
      status: 'open',
    }

    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.routeOrder.findUnique).mockResolvedValue(mockAnnouncement as never)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])

    const request = new NextRequest(
      `http://localhost:3000/api/route-orders/${TEST_UUIDS.announcement}/bookings`
    )

    // Act
    const response = await GET(request, { params: Promise.resolve({ id: TEST_UUIDS.announcement }) })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.bookings).toHaveLength(0)
    expect(data.totalBookings).toBe(0)
  })
})
