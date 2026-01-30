import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'provider-user-1' }),
    },
  },
}))

vi.mock('@/domain/notification/NotificationService', () => ({
  notificationService: {
    createAsync: vi.fn(),
  },
  NotificationType: {
    BOOKING_CONFIRMED: 'booking_confirmed',
    BOOKING_CANCELLED: 'booking_cancelled',
    BOOKING_COMPLETED: 'booking_completed',
  },
}))

// Mock repositories
const mockUpdateStatusWithAuth = vi.fn()
const mockDeleteWithAuth = vi.fn()
const mockFindByUserId = vi.fn()

vi.mock('@/infrastructure/persistence/booking/PrismaBookingRepository', () => {
  return {
    PrismaBookingRepository: class {
      updateStatusWithAuth = mockUpdateStatusWithAuth
      deleteWithAuth = mockDeleteWithAuth
    },
  }
})

vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => {
  return {
    ProviderRepository: class {
      findByUserId = mockFindByUserId
    },
  }
})

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
      service: { name: 'Hovslagning', price: 500, durationMinutes: 60 },
      customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      provider: { businessName: 'Test Provider', user: { firstName: 'John', lastName: 'Smith' } },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    mockUpdateStatusWithAuth.mockResolvedValue(mockUpdatedBooking)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert - Behavior-based: test WHAT the API returns, not HOW
    expect(response.status).toBe(200)
    expect(data.status).toBe('confirmed')
    expect(data.id).toBe('booking1')

    // Verify repository was called with correct auth context
    expect(mockUpdateStatusWithAuth).toHaveBeenCalledWith(
      'booking1',
      'confirmed',
      { providerId: 'provider123' }
    )
  })

  it('should update booking status when customer is authorized', async () => {
    // Arrange
    const mockUpdatedBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'cancelled',
      service: { name: 'Hovslagning', price: 500, durationMinutes: 60 },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    mockUpdateStatusWithAuth.mockResolvedValue(mockUpdatedBooking)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert - Behavior-based
    expect(response.status).toBe(200)
    expect(data.status).toBe('cancelled')

    // Verify repository was called with correct auth context
    expect(mockUpdateStatusWithAuth).toHaveBeenCalledWith(
      'booking1',
      'cancelled',
      { customerId: 'customer123' }
    )
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
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns null when booking not found or unauthorized
    mockUpdateStatusWithAuth.mockResolvedValue(null)

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
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns null for unauthorized access
    mockUpdateStatusWithAuth.mockResolvedValue(null)

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
    // Repository returns null for unauthorized access
    mockUpdateStatusWithAuth.mockResolvedValue(null)

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
    mockFindByUserId.mockResolvedValue(null)

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

  it('should return 400 for invalid JSON body', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: 'invalid json',
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request body')
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

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    mockDeleteWithAuth.mockResolvedValue(true)

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

    // Verify repository was called with correct auth context
    expect(mockDeleteWithAuth).toHaveBeenCalledWith(
      'booking1',
      { providerId: 'provider123' }
    )
  })

  it('should delete booking when customer is authorized', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    mockDeleteWithAuth.mockResolvedValue(true)

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

    // Verify repository was called with correct auth context
    expect(mockDeleteWithAuth).toHaveBeenCalledWith(
      'booking1',
      { customerId: 'customer123' }
    )
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
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns false when booking not found
    mockDeleteWithAuth.mockResolvedValue(false)

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
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns false for unauthorized access
    mockDeleteWithAuth.mockResolvedValue(false)

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
    // Repository returns false for unauthorized access
    mockDeleteWithAuth.mockResolvedValue(false)

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
    mockFindByUserId.mockResolvedValue(null)

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
