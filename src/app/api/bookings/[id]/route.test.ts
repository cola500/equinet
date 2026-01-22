import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Helper to create Prisma P2025 error (record not found)
function createPrismaNotFoundError() {
  const error = new Error('Record not found')
  ;(error as any).code = 'P2025'
  return error
}

describe('PUT /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update booking status when provider is authorized', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockUpdatedBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'confirmed',
      service: { name: 'Hovslagning' },
      customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      provider: { user: { firstName: 'John', lastName: 'Smith' } },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
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
    // Verify atomic authorization: providerId in WHERE clause
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking1', providerId: 'provider123' },
      data: { status: 'confirmed' },
      include: expect.any(Object),
    })
  })

  it('should update booking status when customer is authorized', async () => {
    // Arrange
    const mockUpdatedBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'cancelled',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
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
    // Verify atomic authorization: customerId in WHERE clause
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking1', customerId: 'customer123' },
      data: { status: 'cancelled' },
      include: expect.any(Object),
    })
  })

  it('should return 404 when booking does not exist', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    // Prisma throws P2025 when record not found with atomic WHERE clause
    vi.mocked(prisma.booking.update).mockRejectedValue(createPrismaNotFoundError())

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
    expect(data.error).toContain('not found')
  })

  it('should return 404 when provider is not authorized for this booking', async () => {
    // Arrange - provider123 tries to update booking owned by different-provider
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    // Atomic auth: WHERE clause won't match, Prisma throws P2025
    vi.mocked(prisma.booking.update).mockRejectedValue(createPrismaNotFoundError())

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) because atomic auth doesn't distinguish between
    // "booking doesn't exist" and "booking exists but you don't own it"
    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('should return 404 when customer is not authorized for this booking', async () => {
    // Arrange - customer123 tries to update booking owned by different-customer
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    // Atomic auth: WHERE clause won't match, Prisma throws P2025
    vi.mocked(prisma.booking.update).mockRejectedValue(createPrismaNotFoundError())

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) because atomic auth doesn't distinguish
    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('should return 400 for invalid status', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)

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

  it('should return 404 when provider profile not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

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
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})

describe('DELETE /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete booking when provider is authorized', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
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
    // Verify atomic authorization: providerId in WHERE clause
    expect(prisma.booking.delete).toHaveBeenCalledWith({
      where: { id: 'booking1', providerId: 'provider123' },
    })
  })

  it('should delete booking when customer is authorized', async () => {
    // Arrange
    const mockBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
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
    // Verify atomic authorization: customerId in WHERE clause
    expect(prisma.booking.delete).toHaveBeenCalledWith({
      where: { id: 'booking1', customerId: 'customer123' },
    })
  })

  it('should return 404 when booking does not exist', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    // Prisma throws P2025 when record not found
    vi.mocked(prisma.booking.delete).mockRejectedValue(createPrismaNotFoundError())

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
    expect(data.error).toContain('not found')
  })

  it('should return 404 when provider is not authorized for this booking', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    // Atomic auth: WHERE clause won't match, Prisma throws P2025
    vi.mocked(prisma.booking.delete).mockRejectedValue(createPrismaNotFoundError())

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) because atomic auth
    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('should return 404 when customer is not authorized for this booking', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    // Atomic auth: WHERE clause won't match, Prisma throws P2025
    vi.mocked(prisma.booking.delete).mockRejectedValue(createPrismaNotFoundError())

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) because atomic auth
    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('should return 404 when provider profile not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})
