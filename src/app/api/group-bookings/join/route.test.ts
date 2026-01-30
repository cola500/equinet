import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const TEST_UUIDS = {
  creator: '11111111-1111-4111-8111-111111111111',
  joiner: '22222222-2222-4222-8222-222222222222',
  groupRequest: '33333333-3333-4333-8333-333333333333',
  participant: '44444444-4444-4444-8444-444444444444',
  newParticipant: '55555555-5555-4555-8555-555555555555',
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
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    groupBookingRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    groupBookingParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

const baseGroupRequest = {
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
  joinDeadline: null,
  participants: [
    {
      id: TEST_UUIDS.participant,
      userId: TEST_UUIDS.creator,
      status: 'joined',
    },
  ],
  _count: { participants: 1 },
}

describe('POST /api/group-bookings/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow a user to join via invite code', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    vi.mocked(prisma.groupBookingRequest.findUnique).mockResolvedValue(baseGroupRequest as any)
    vi.mocked(prisma.groupBookingParticipant.findUnique).mockResolvedValue(null) // Not already joined
    vi.mocked(prisma.groupBookingParticipant.create).mockResolvedValue({
      id: TEST_UUIDS.newParticipant,
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      userId: TEST_UUIDS.joiner,
      numberOfHorses: 2,
      horseName: 'Blansen',
      status: 'joined',
      joinedAt: new Date(),
    } as any)

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
    vi.mocked(prisma.groupBookingRequest.findUnique).mockResolvedValue(null)

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
    vi.mocked(prisma.groupBookingRequest.findUnique).mockResolvedValue({
      ...baseGroupRequest,
      status: 'matched',
    } as any)

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
    vi.mocked(prisma.groupBookingRequest.findUnique).mockResolvedValue({
      ...baseGroupRequest,
      maxParticipants: 1,
      _count: { participants: 1 },
    } as any)

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
    vi.mocked(prisma.groupBookingRequest.findUnique).mockResolvedValue(baseGroupRequest as any)
    vi.mocked(prisma.groupBookingParticipant.findUnique).mockResolvedValue({
      id: TEST_UUIDS.newParticipant,
      userId: TEST_UUIDS.joiner,
      status: 'joined',
    } as any)

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
    const pastDeadline = new Date()
    pastDeadline.setDate(pastDeadline.getDate() - 1)

    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.joiner, userType: 'customer' },
    } as any)
    vi.mocked(prisma.groupBookingRequest.findUnique).mockResolvedValue({
      ...baseGroupRequest,
      joinDeadline: pastDeadline,
    } as any)

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
