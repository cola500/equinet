import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks -- only boundaries, NOT GroupBookingService (the real service runs)
// ---------------------------------------------------------------------------

const mockGroupBookingRepo = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByInviteCode: vi.fn(),
  addParticipant: vi.fn(),
  findByIdWithAccess: vi.fn(),
  findByIdForCreator: vi.fn(),
  isUserParticipant: vi.fn(),
  findParticipantWithAccess: vi.fn(),
  cancelParticipant: vi.fn(),
  countActiveParticipants: vi.fn(),
  cancelRequest: vi.fn(),
  findForMatch: vi.fn(),
  matchAndCreateBookings: vi.fn(),
  findAvailableForProvider: vi.fn(),
}

vi.mock(
  '@/infrastructure/persistence/group-booking/GroupBookingRepository',
  () => ({
    GroupBookingRepository: class MockGroupBookingRepo {
      create = mockGroupBookingRepo.create
      findByUserId = mockGroupBookingRepo.findByUserId
      findById = mockGroupBookingRepo.findById
      update = mockGroupBookingRepo.update
      delete = mockGroupBookingRepo.delete
      findByInviteCode = mockGroupBookingRepo.findByInviteCode
      addParticipant = mockGroupBookingRepo.addParticipant
      findByIdWithAccess = mockGroupBookingRepo.findByIdWithAccess
      findByIdForCreator = mockGroupBookingRepo.findByIdForCreator
      isUserParticipant = mockGroupBookingRepo.isUserParticipant
      findParticipantWithAccess = mockGroupBookingRepo.findParticipantWithAccess
      cancelParticipant = mockGroupBookingRepo.cancelParticipant
      countActiveParticipants = mockGroupBookingRepo.countActiveParticipants
      cancelRequest = mockGroupBookingRepo.cancelRequest
      findForMatch = mockGroupBookingRepo.findForMatch
      matchAndCreateBookings = mockGroupBookingRepo.matchAndCreateBookings
      findAvailableForProvider = mockGroupBookingRepo.findAvailableForProvider
    },
  })
)

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true),
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    service: { findFirst: vi.fn() },
  },
}))

vi.mock('@/domain/notification/NotificationService', () => ({
  notificationService: {
    createAsync: vi.fn(),
  },
  NotificationType: {
    GROUP_BOOKING_CANCELLED: 'GROUP_BOOKING_CANCELLED',
    GROUP_BOOKING_JOINED: 'GROUP_BOOKING_JOINED',
    GROUP_BOOKING_LEFT: 'GROUP_BOOKING_LEFT',
    GROUP_BOOKING_MATCHED: 'GROUP_BOOKING_MATCHED',
  },
}))

import { auth } from '@/lib/auth-server'
import { rateLimiters } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { POST, GET } from './route'
import { GET as GET_AVAILABLE } from './available/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const futureDate = new Date()
futureDate.setDate(futureDate.getDate() + 7)
const endDate = new Date(futureDate)
endDate.setDate(endDate.getDate() + 1)

const validBody = {
  serviceType: 'Hovslagning',
  locationName: 'Stall Sjöbo',
  address: 'Stallvägen 1, 123 45 Sjöbo',
  dateFrom: futureDate.toISOString(),
  dateTo: endDate.toISOString(),
}

const mockCreatedGroupBooking = {
  id: 'gb-1',
  userId: 'user-1',
  creatorId: 'user-1',
  serviceType: 'Hovslagning',
  status: 'open',
  locationName: 'Stall Sjöbo',
  address: 'Stallvägen 1, 123 45 Sjöbo',
  dateFrom: futureDate,
  dateTo: endDate,
  maxParticipants: 10,
  inviteCode: 'ABC123',
  createdAt: new Date(),
  participants: [
    {
      id: 'p-1',
      userId: 'user-1',
      numberOfHorses: 1,
      status: 'active',
    },
  ],
}

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): NextRequest {
  const url = 'http://localhost:3000/api/group-bookings'
  if (method === 'GET') {
    return new NextRequest(url, { method })
  }
  return new NextRequest(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/group-bookings', {
    method: 'POST',
    body: 'not valid json{{{',
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/group-bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)
    vi.mocked(rateLimiters.booking).mockResolvedValue(true)
    mockGroupBookingRepo.create.mockResolvedValue(mockCreatedGroupBooking)
  })

  it('creates group booking request and returns 201', async () => {
    const res = await POST(makeRequest('POST', validBody))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toMatchObject({
      id: 'gb-1',
      serviceType: 'Hovslagning',
      status: 'open',
      locationName: 'Stall Sjöbo',
    })
    expect(mockGroupBookingRepo.create).toHaveBeenCalledOnce()
  })

  it('returns 404 when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)

    const res = await POST(makeRequest('POST', validBody))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Ej tillgänglig')
    expect(isFeatureEnabled).toHaveBeenCalledWith('group_bookings')
    expect(mockGroupBookingRepo.create).not.toHaveBeenCalled()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never)

    const res = await POST(makeRequest('POST', validBody))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
    expect(mockGroupBookingRepo.create).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonRequest())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
    expect(mockGroupBookingRepo.create).not.toHaveBeenCalled()
  })

  it('returns 400 for Zod validation failure', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 7)

    const res = await POST(
      makeRequest('POST', {
        ...validBody,
        dateFrom: pastDate.toISOString(),
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
    expect(data.details).toBeDefined()
    expect(mockGroupBookingRepo.create).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.booking).mockResolvedValueOnce(false)

    const res = await POST(makeRequest('POST', validBody))
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.error).toContain('För många förfrågningar')
    expect(mockGroupBookingRepo.create).not.toHaveBeenCalled()
  })
})

describe('GET /api/group-bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    mockGroupBookingRepo.findByUserId.mockResolvedValue([
      mockCreatedGroupBooking,
    ])
  })

  it('lists user group bookings and returns 200', async () => {
    const res = await GET(makeRequest('GET'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      id: 'gb-1',
      serviceType: 'Hovslagning',
    })
    expect(mockGroupBookingRepo.findByUserId).toHaveBeenCalledWith('user-1')
  })

  it('returns 404 when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)

    const res = await GET(makeRequest('GET'))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Ej tillgänglig')
    expect(isFeatureEnabled).toHaveBeenCalledWith('group_bookings')
    expect(mockGroupBookingRepo.findByUserId).not.toHaveBeenCalled()
  })
})

describe('GET /api/group-bookings/available', () => {
  function makeAvailableRequest(): NextRequest {
    return new NextRequest('http://localhost:3000/api/group-bookings/available', {
      method: 'GET',
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'provider-user-1', userType: 'provider' },
    } as never)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    mockGroupBookingRepo.findAvailableForProvider.mockResolvedValue({
      provider: { id: 'provider-1' },
      requests: [mockCreatedGroupBooking],
    })
  })

  it('returns 200 with open requests for authenticated provider', async () => {
    const res = await GET_AVAILABLE(makeAvailableRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({ id: 'gb-1', serviceType: 'Hovslagning' })
    expect(mockGroupBookingRepo.findAvailableForProvider).toHaveBeenCalledWith('provider-user-1')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null)

    const res = await GET_AVAILABLE(makeAvailableRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 when customer tries to access', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'customer-1', userType: 'customer' },
    } as never)

    const res = await GET_AVAILABLE(makeAvailableRequest())
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toMatch(/leverantörer/i)
  })

  it('returns 404 when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)

    const res = await GET_AVAILABLE(makeAvailableRequest())
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Ej tillgänglig')
    expect(mockGroupBookingRepo.findAvailableForProvider).not.toHaveBeenCalled()
  })
})
