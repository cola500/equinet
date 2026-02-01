import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared'

const TEST_UUIDS = {
  creator: '11111111-1111-4111-8111-111111111111',
  otherUser: '22222222-2222-4222-8222-222222222222',
  provider: '33333333-3333-4333-8333-333333333333',
  providerUser: '44444444-4444-4444-8444-444444444444',
  groupRequest: '55555555-5555-4555-8555-555555555555',
  participant1: '66666666-6666-4666-8666-666666666666',
  participant2: '77777777-7777-4777-8777-777777777777',
}

const FUTURE_DATE = new Date()
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 14)
const FUTURE_DATE_END = new Date(FUTURE_DATE)
FUTURE_DATE_END.setDate(FUTURE_DATE_END.getDate() + 7)

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

const mockService = {
  getById: vi.fn(),
  updateRequest: vi.fn(),
}

vi.mock('@/domain/group-booking/GroupBookingService', () => ({
  createGroupBookingService: () => mockService,
}))

const mockGroupRequest = {
  id: TEST_UUIDS.groupRequest,
  creatorId: TEST_UUIDS.creator,
  serviceType: 'hovslagning',
  locationName: 'Sollebrunn Ridklubb',
  address: 'Stallvägen 1',
  dateFrom: FUTURE_DATE,
  dateTo: FUTURE_DATE_END,
  maxParticipants: 6,
  status: 'open',
  inviteCode: 'ABC12345',
  createdAt: new Date(),
  updatedAt: new Date(),
  participants: [
    {
      id: TEST_UUIDS.participant1,
      userId: TEST_UUIDS.creator,
      numberOfHorses: 1,
      status: 'joined',
      user: { firstName: 'Anna' },
    },
    {
      id: TEST_UUIDS.participant2,
      userId: TEST_UUIDS.otherUser,
      numberOfHorses: 2,
      status: 'joined',
      user: { firstName: 'Erik' },
    },
  ],
  _count: { participants: 2 },
  provider: null,
}

const makeParams = (id: string) => Promise.resolve({ id })

describe('GET /api/group-bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return group booking details for a participant', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as any)
    mockService.getById.mockResolvedValue(Result.ok(mockGroupRequest))

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`
    )

    const response = await GET(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe(TEST_UUIDS.groupRequest)
    expect(data.participants).toHaveLength(2)
    expect(data.participants[0].user.firstName).toBe('Anna')
    // Privacy: no lastName exposed
    expect(data.participants[0].user.lastName).toBeUndefined()
  })

  it('should return 404 when group booking not found or user not participant', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.otherUser, userType: 'customer' },
    } as any)
    mockService.getById.mockResolvedValue(
      Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Grupprequest hittades inte',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`
    )

    const response = await GET(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Grupprequest hittades inte')
  })

  it('should return 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`
    )

    const response = await GET(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    expect(response.status).toBe(401)
  })
})

describe('PUT /api/group-bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow creator to update the group booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as any)
    mockService.updateRequest.mockResolvedValue(
      Result.ok({
        ...mockGroupRequest,
        notes: 'Uppdaterade anteckningar',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`,
      {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Uppdaterade anteckningar' }),
      }
    )

    const response = await PUT(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notes).toBe('Uppdaterade anteckningar')
  })

  it('should allow creator to cancel the group booking', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as any)
    mockService.updateRequest.mockResolvedValue(
      Result.ok({
        ...mockGroupRequest,
        status: 'cancelled',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      }
    )

    const response = await PUT(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('cancelled')
  })

  it('should return 403 when non-creator tries to update', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.otherUser, userType: 'customer' },
    } as any)
    mockService.updateRequest.mockResolvedValue(
      Result.fail({
        type: 'UNAUTHORIZED',
        message: 'Bara skaparen kan uppdatera grupprequesten',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`,
      {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Hacked' }),
      }
    )

    const response = await PUT(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Bara skaparen kan uppdatera grupprequesten')
  })

  it('should return 400 for invalid status transition', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as any)
    mockService.updateRequest.mockResolvedValue(
      Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: 'Kan inte ändra status från "open" till "completed"',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status: 'completed' }),
      }
    )

    const response = await PUT(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('status')
  })
})
