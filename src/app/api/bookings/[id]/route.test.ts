import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared/types/Result'

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

vi.mock('@/lib/email', () => ({
  sendBookingConfirmationNotification: vi.fn().mockResolvedValue(undefined),
  sendBookingStatusChangeNotification: vi.fn().mockResolvedValue(undefined),
  sendPaymentConfirmationNotification: vi.fn().mockResolvedValue(undefined),
}))

// Mock BookingService for PUT tests
const mockUpdateStatus = vi.fn()
vi.mock('@/domain/booking', () => ({
  createBookingService: () => ({
    updateStatus: mockUpdateStatus,
  }),
  createBookingEventDispatcher: () => ({
    dispatch: vi.fn().mockResolvedValue(undefined),
    dispatchAll: vi.fn().mockResolvedValue(undefined),
  }),
  createBookingStatusChangedEvent: vi.fn((payload: any) => ({
    eventId: 'test-evt',
    eventType: 'BOOKING_STATUS_CHANGED',
    occurredAt: new Date(),
    payload,
  })),
  mapBookingErrorToStatus: vi.fn((error: any) => {
    if (error.type === 'BOOKING_NOT_FOUND') return 404
    if (error.type === 'INVALID_STATUS_TRANSITION') return 400
    return 500
  }),
  mapBookingErrorToMessage: vi.fn((error: any) => {
    if (error.type === 'BOOKING_NOT_FOUND') return 'Bokningen hittades inte'
    if (error.type === 'INVALID_STATUS_TRANSITION') return error.message
    return 'Ett fel uppstod'
  }),
}))

// Mock repositories (used by DELETE and provider lookup in PUT)
const mockDeleteWithAuth = vi.fn()
const mockFindByUserId = vi.fn()

vi.mock('@/infrastructure/persistence/booking/PrismaBookingRepository', () => {
  return {
    PrismaBookingRepository: class {
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
    const mockUpdatedBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'confirmed',
      bookingDate: new Date('2026-02-15'),
      startTime: '10:00',
      service: { name: 'Hovslagning', price: 500, durationMinutes: 60 },
      customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      provider: { businessName: 'Test Provider', user: { firstName: 'John', lastName: 'Smith' } },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider123', userId: 'user123' })
    mockUpdateStatus.mockResolvedValue(Result.ok(mockUpdatedBooking))

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('confirmed')
    expect(data.id).toBe('booking1')

    // Verify service was called with correct DTO
    expect(mockUpdateStatus).toHaveBeenCalledWith({
      bookingId: 'booking1',
      newStatus: 'confirmed',
      providerId: 'provider123',
      customerId: undefined,
    })
  })

  it('should update booking status when customer cancels', async () => {
    const mockUpdatedBooking = {
      id: 'booking1',
      customerId: 'customer123',
      providerId: 'provider123',
      status: 'cancelled',
      bookingDate: new Date('2026-02-15'),
      startTime: '10:00',
      service: { name: 'Hovslagning', price: 500, durationMinutes: 60 },
      customer: { firstName: 'Jane', lastName: 'Doe' },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    mockUpdateStatus.mockResolvedValue(Result.ok(mockUpdatedBooking))

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('cancelled')

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      bookingId: 'booking1',
      newStatus: 'cancelled',
      providerId: undefined,
      customerId: 'customer123',
    })
  })

  it('should return 404 when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider123', userId: 'user123' })
    mockUpdateStatus.mockResolvedValue(
      Result.fail({ type: 'BOOKING_NOT_FOUND' })
    )

    const request = new NextRequest('http://localhost:3000/api/bookings/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('hittades inte')
  })

  it('should return 400 for invalid status transition', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider123', userId: 'user123' })
    mockUpdateStatus.mockResolvedValue(
      Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: 'Kan inte ändra status från "pending" till "completed"',
        from: 'pending',
        to: 'completed',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('pending')
  })

  it('should return 400 for invalid status value (Zod)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'invalid-status' }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 404 when provider profile not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmed' }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })

  it('should return 400 for invalid JSON body', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'PUT',
      body: 'invalid json',
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request body')
  })
})

describe('DELETE /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete booking when provider is authorized', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider123', userId: 'user123' })
    mockDeleteWithAuth.mockResolvedValue(true)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Booking deleted')
    expect(mockDeleteWithAuth).toHaveBeenCalledWith(
      'booking1',
      { providerId: 'provider123' }
    )
  })

  it('should delete booking when customer is authorized', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer123', userType: 'customer' },
    } as any)
    mockDeleteWithAuth.mockResolvedValue(true)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Booking deleted')
    expect(mockDeleteWithAuth).toHaveBeenCalledWith(
      'booking1',
      { customerId: 'customer123' }
    )
  })

  it('should return 404 when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider123', userId: 'user123' })
    mockDeleteWithAuth.mockResolvedValue(false)

    const request = new NextRequest('http://localhost:3000/api/bookings/nonexistent', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('should return 404 when not authorized', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider123', userId: 'user123' })
    mockDeleteWithAuth.mockResolvedValue(false)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('should return 404 when provider profile not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/bookings/booking1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'booking1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Provider not found')
  })
})
