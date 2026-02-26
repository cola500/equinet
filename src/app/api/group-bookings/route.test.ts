import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { auth } from '@/lib/auth-server'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared'

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const TEST_UUIDS = {
  creator: '11111111-1111-4111-8111-111111111111',
  otherUser: '22222222-2222-4222-8222-222222222222',
  groupRequest: '44444444-4444-4444-8444-444444444444',
  participant: '66666666-6666-4666-8666-666666666666',
}

const FUTURE_DATE = new Date()
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 14)
const FUTURE_DATE_END = new Date(FUTURE_DATE)
FUTURE_DATE_END.setDate(FUTURE_DATE_END.getDate() + 7)

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

const mockService = {
  createRequest: vi.fn(),
  listForUser: vi.fn(),
}

vi.mock('@/domain/group-booking/GroupBookingService', () => ({
  createGroupBookingService: () => mockService,
}))

describe('POST /api/group-bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it('returns 404 when group_bookings feature flag is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const req = new NextRequest('http://localhost/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('group_bookings')
  })

  it('should create a group booking request for authenticated customer', async () => {
    const mockSession = {
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    }

    const mockCreated = {
      id: TEST_UUIDS.groupRequest,
      creatorId: TEST_UUIDS.creator,
      serviceType: 'hovslagning',
      locationName: 'Sollebrunn Ridklubb',
      address: 'Stallvägen 1, 441 91 Alingsås',
      dateFrom: FUTURE_DATE,
      dateTo: FUTURE_DATE_END,
      maxParticipants: 6,
      status: 'open',
      inviteCode: 'ABC12345',
      notes: 'Vi har 6 hästar totalt',
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [{
        id: TEST_UUIDS.participant,
        userId: TEST_UUIDS.creator,
        numberOfHorses: 1,
        status: 'joined',
        user: { firstName: 'Anna' },
      }],
      _count: { participants: 1 },
    }

    vi.mocked(auth).mockResolvedValue(mockSession as never)
    mockService.createRequest.mockResolvedValue(Result.ok(mockCreated))

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'hovslagning',
        locationName: 'Sollebrunn Ridklubb',
        address: 'Stallvägen 1, 441 91 Alingsås',
        dateFrom: FUTURE_DATE.toISOString(),
        dateTo: FUTURE_DATE_END.toISOString(),
        maxParticipants: 6,
        notes: 'Vi har 6 hästar totalt',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe(TEST_UUIDS.groupRequest)
    expect(data.inviteCode).toBeDefined()
    expect(data.status).toBe('open')
    expect(data.participants).toHaveLength(1)
    expect(data.participants[0].userId).toBe(TEST_UUIDS.creator)
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'hovslagning',
        locationName: 'Test',
        address: 'Test',
        dateFrom: FUTURE_DATE.toISOString(),
        dateTo: FUTURE_DATE_END.toISOString(),
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 for missing required fields', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'hovslagning',
        // Missing locationName, address, dateFrom, dateTo
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 when dateFrom is in the past', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as never)

    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'hovslagning',
        locationName: 'Test',
        address: 'Test',
        dateFrom: pastDate.toISOString(),
        dateTo: FUTURE_DATE_END.toISOString(),
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 when date span exceeds 30 days', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as never)

    const farDate = new Date(FUTURE_DATE)
    farDate.setDate(farDate.getDate() + 31)

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'hovslagning',
        locationName: 'Test',
        address: 'Test',
        dateFrom: FUTURE_DATE.toISOString(),
        dateTo: farDate.toISOString(),
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 when maxParticipants is out of range', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'hovslagning',
        locationName: 'Test',
        address: 'Test',
        dateFrom: FUTURE_DATE.toISOString(),
        dateTo: FUTURE_DATE_END.toISOString(),
        maxParticipants: 25, // Max is 20
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid JSON', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/group-bookings', {
      method: 'POST',
      body: 'not json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })
})

describe('GET /api/group-bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it('returns 404 when group_bookings feature flag is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const req = new NextRequest('http://localhost/api/group-bookings')
    const res = await GET(req)
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('group_bookings')
  })

  it('should return group bookings for authenticated customer (created + joined)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as never)

    const mockRequests = [
      {
        id: TEST_UUIDS.groupRequest,
        creatorId: TEST_UUIDS.creator,
        serviceType: 'hovslagning',
        locationName: 'Sollebrunn Ridklubb',
        status: 'open',
        dateFrom: FUTURE_DATE,
        dateTo: FUTURE_DATE_END,
        inviteCode: 'ABC12345',
        maxParticipants: 6,
        participants: [
          {
            id: TEST_UUIDS.participant,
            userId: TEST_UUIDS.creator,
            status: 'joined',
            user: { firstName: 'Anna' },
          },
        ],
        _count: { participants: 1 },
      },
    ]

    mockService.listForUser.mockResolvedValue(Result.ok(mockRequests))

    const request = new NextRequest('http://localhost:3000/api/group-bookings')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].serviceType).toBe('hovslagning')
    expect(data[0].locationName).toBe('Sollebrunn Ridklubb')
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest('http://localhost:3000/api/group-bookings')

    const response = await GET(request)
    expect(response.status).toBe(401)
  })
})
