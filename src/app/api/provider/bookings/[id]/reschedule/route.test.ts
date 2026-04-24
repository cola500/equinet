import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

const mockFindByUserId = vi.fn()
vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

const mockProviderRescheduleWithOverlapCheck = vi.fn()
vi.mock('@/infrastructure/persistence/booking/PrismaBookingRepository', () => ({
  PrismaBookingRepository: class {
    providerRescheduleWithOverlapCheck = mockProviderRescheduleWithOverlapCheck
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findFirst: vi.fn() },
    service: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendBookingRescheduleNotification: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { auth } from '@/lib/auth-server'
import { rateLimiters } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockBookingFindFirst = vi.mocked(prisma.booking.findFirst)
const mockServiceFindUnique = vi.mocked(prisma.service.findUnique)

function createRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/provider/bookings/booking-1/reschedule',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

function createInvalidJsonRequest() {
  return new NextRequest(
    'http://localhost/api/provider/bookings/booking-1/reschedule',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid{{json',
    }
  )
}

const params = Promise.resolve({ id: 'booking-1' })

const mockProvider = { id: 'provider-1' }

const mockBookingRow = {
  id: 'booking-1',
  status: 'confirmed',
  serviceId: 'service-1',
  bookingDate: new Date('2026-05-10'),
  startTime: '10:00',
}

const mockServiceRow = { durationMinutes: 60 }

const mockUpdatedBooking = {
  id: 'booking-1',
  bookingDate: new Date('2026-05-15'),
  startTime: '14:00',
  endTime: '15:00',
}

const validBody = { bookingDate: '2026-05-15', startTime: '14:00' }

describe('PATCH /api/provider/bookings/[id]/reschedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindByUserId.mockResolvedValue(mockProvider)
    mockBookingFindFirst.mockResolvedValue(mockBookingRow)
    mockServiceFindUnique.mockResolvedValue(mockServiceRow)
    mockProviderRescheduleWithOverlapCheck.mockResolvedValue(mockUpdatedBooking)
  })

  it('returns 401 without session', async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(401)
  })

  it('returns 403 for customer user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)

    const response = await PATCH(createRequest(validBody), { params })
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.error).toBe('Åtkomst nekad')
  })

  it('returns 429 when rate limited', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    vi.mocked(rateLimiters.booking).mockResolvedValueOnce(false)

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(429)
  })

  it('returns 503 when rate limiter throws', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    vi.mocked(rateLimiters.booking).mockRejectedValueOnce(new Error('Redis down'))

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(503)
  })

  it('returns 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const response = await PATCH(createInvalidJsonRequest(), { params })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('returns 400 for missing bookingDate', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const response = await PATCH(createRequest({ startTime: '10:00' }), { params })
    expect(response.status).toBe(400)
  })

  it('returns 400 for missing startTime', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const response = await PATCH(createRequest({ bookingDate: '2026-05-15' }), { params })
    expect(response.status).toBe(400)
  })

  it('returns 400 for extra fields (strict mode)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const response = await PATCH(
      createRequest({ ...validBody, extraField: 'hack' }),
      { params }
    )
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const response = await PATCH(
      createRequest({ bookingDate: '15/05/2026', startTime: '10:00' }),
      { params }
    )
    expect(response.status).toBe(400)
  })

  it('returns 404 when booking not found or IDOR', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    mockBookingFindFirst.mockResolvedValue(null)

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(404)
  })

  it('returns 400 when booking status is completed', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    mockBookingFindFirst.mockResolvedValue({ ...mockBookingRow, status: 'completed' })

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/ombokas/)
  })

  it('returns 400 when booking status is cancelled', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    mockBookingFindFirst.mockResolvedValue({ ...mockBookingRow, status: 'cancelled' })

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(400)
  })

  it('returns 400 when booking status is no_show', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    mockBookingFindFirst.mockResolvedValue({ ...mockBookingRow, status: 'no_show' })

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/ombokas/)
  })

  it('returns 409 when new time overlaps with another booking', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    mockProviderRescheduleWithOverlapCheck.mockResolvedValue(null)

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toMatch(/krockar/)
  })

  it('returns 200 with updated booking on success (confirmed)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.id).toBe('booking-1')
  })

  it('returns 200 with updated booking on success (pending)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)
    mockBookingFindFirst.mockResolvedValue({ ...mockBookingRow, status: 'pending' })

    const response = await PATCH(createRequest(validBody), { params })
    expect(response.status).toBe(200)
  })

  it('calls providerRescheduleWithOverlapCheck with correct args', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
    } as never)

    await PATCH(createRequest(validBody), { params })

    expect(mockProviderRescheduleWithOverlapCheck).toHaveBeenCalledWith(
      'booking-1',
      'provider-1',
      expect.objectContaining({
        startTime: '14:00',
        endTime: '15:00',
      })
    )
  })
})
