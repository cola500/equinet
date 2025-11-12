import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
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
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('PUT /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update booking status when provider is authorized', async () => {
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

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'pending',
    }

    const mockUpdatedBooking = {
      ...mockBooking,
      status: 'confirmed',
      service: { name: 'Hovslagning' },
      customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      provider: { user: { firstName: 'John', lastName: 'Smith' } },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.booking.update).mockResolvedValue(mockUpdatedBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.status).toBe('confirmed')
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking1' },
      data: { status: 'confirmed' },
      include: expect.any(Object),
    })
  })

  it('should update booking status when customer is authorized', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'pending',
    }

    const mockUpdatedBooking = {
      ...mockBooking,
      status: 'cancelled',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.booking.update).mockResolvedValue(mockUpdatedBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.status).toBe('cancelled')
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 when booking does not exist', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Booking not found')
  })

  it('should return 403 when provider is not authorized for this booking', async () => {
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

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'different-provider', // Different provider!
      status: 'pending',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 403 when customer is not authorized for this booking', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'different-customer', // Different customer!
      providerId: 'provider123',
      status: 'pending',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 for invalid status', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'pending',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'invalid-status' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })
})

describe('DELETE /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete booking when provider is authorized', async () => {
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

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.booking.delete).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.message).toBe('Booking deleted')
    expect(prisma.booking.delete).toHaveBeenCalledWith({
      where: { id: 'booking1' },
    })
  })

  it('should delete booking when customer is authorized', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.booking.delete).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.message).toBe('Booking deleted')
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 when booking does not exist', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/nonexistent', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Booking not found')
  })

  it('should return 403 when provider is not authorized for this booking', async () => {
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

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'different-provider',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 403 when customer is not authorized for this booking', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'customer123',
        userType: 'customer',
      },
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'different-customer',
      providerId: 'provider123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(data.error).toBe('Unauthorized')
  })
})
