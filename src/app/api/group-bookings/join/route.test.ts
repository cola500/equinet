import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared'

const TEST_UUIDS = {
  creator: '11111111-1111-4111-8111-111111111111',
  joiner: '22222222-2222-4222-8222-222222222222',
  groupRequest: '33333333-3333-4333-8333-333333333333',
  newParticipant: '55555555-5555-4555-8555-555555555555',
}

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

const mockService = {
  joinByInviteCode: vi.fn(),
}

vi.mock('@/domain/group-booking/GroupBookingService', () => ({
  createGroupBookingService: () => mockService,
}))

describe('POST /api/group-bookings/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow a user to join via invite code', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    mockService.joinByInviteCode.mockResolvedValue(
      Result.ok({
        id: TEST_UUIDS.newParticipant,
        groupBookingRequestId: TEST_UUIDS.groupRequest,
        userId: TEST_UUIDS.joiner,
        numberOfHorses: 2,
        horseName: 'Blansen',
        status: 'joined',
        joinedAt: new Date(),
      })
    )

    const request = new NextRequest('http://localhost:3000/api/group-bookings/join', {
      method: 'POST',
      body: JSON.stringify({
        inviteCode: 'ABC12345',
        numberOfHorses: 2,
        horseName: 'Blansen',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.userId).toBe(TEST_UUIDS.joiner)
    expect(data.horseName).toBe('Blansen')
  })

  it('should return 404 for invalid invite code', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    mockService.joinByInviteCode.mockResolvedValue(
      Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Ogiltig inbjudningskod',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/group-bookings/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'BADCODE1' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Ogiltig inbjudningskod')
  })

  it('should return 400 when group is not open', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    mockService.joinByInviteCode.mockResolvedValue(
      Result.fail({
        type: 'GROUP_NOT_OPEN',
        message: 'Grupprequesten är inte längre öppen för nya deltagare',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/group-bookings/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'ABC12345' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('öppen')
  })

  it('should return 400 when group is full', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    mockService.joinByInviteCode.mockResolvedValue(
      Result.fail({
        type: 'GROUP_FULL',
        message: 'Grupprequesten är fullt belagd',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/group-bookings/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'ABC12345' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('fullt')
  })

  it('should return 409 when user already joined', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    mockService.joinByInviteCode.mockResolvedValue(
      Result.fail({
        type: 'ALREADY_JOINED',
        message: 'Du är redan med i denna grupprequest',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/group-bookings/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'ABC12345' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('redan')
  })

  it('should return 400 when join deadline has passed', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    mockService.joinByInviteCode.mockResolvedValue(
      Result.fail({
        type: 'JOIN_DEADLINE_PASSED',
        message: 'Anslutnings-deadline har passerat',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/group-bookings/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'ABC12345' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('deadline')
  })
})
