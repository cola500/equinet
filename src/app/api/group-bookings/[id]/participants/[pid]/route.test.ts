import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const TEST_UUIDS = {
  creator: '11111111-1111-4111-8111-111111111111',
  participant: '22222222-2222-4222-8222-222222222222',
  groupRequest: '33333333-3333-4333-8333-333333333333',
  participantId: '44444444-4444-4444-8444-444444444444',
  otherUser: '55555555-5555-4555-8555-555555555555',
}

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    groupBookingRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    groupBookingParticipant: {
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))

const makeParams = (id: string, pid: string) => Promise.resolve({ id, pid })

describe('DELETE /api/group-bookings/[id]/participants/[pid]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow participant to leave (cancel their own participation)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.participant, userType: 'customer' },
    } as any)

    const mockParticipant = {
      id: TEST_UUIDS.participantId,
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      userId: TEST_UUIDS.participant,
      status: 'joined',
      groupBookingRequest: {
        id: TEST_UUIDS.groupRequest,
        creatorId: TEST_UUIDS.creator,
        status: 'open',
        serviceType: 'hovslagning',
      },
    }

    vi.mocked(prisma.groupBookingParticipant.findFirst).mockResolvedValue(mockParticipant as any)
    vi.mocked(prisma.groupBookingParticipant.update).mockResolvedValue({
      ...mockParticipant,
      status: 'cancelled',
    } as any)
    vi.mocked(prisma.groupBookingParticipant.count).mockResolvedValue(1) // Others still remain

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/participants/${TEST_UUIDS.participantId}`,
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams(TEST_UUIDS.groupRequest, TEST_UUIDS.participantId),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain('lämnat')
  })

  it('should allow creator to remove a participant', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.creator, userType: 'customer' },
    } as any)

    const mockParticipant = {
      id: TEST_UUIDS.participantId,
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      userId: TEST_UUIDS.participant, // Not the creator
      status: 'joined',
      groupBookingRequest: {
        id: TEST_UUIDS.groupRequest,
        creatorId: TEST_UUIDS.creator, // Creator is the one making the request
        status: 'open',
        serviceType: 'hovslagning',
      },
    }

    vi.mocked(prisma.groupBookingParticipant.findFirst).mockResolvedValue(mockParticipant as any)
    vi.mocked(prisma.groupBookingParticipant.update).mockResolvedValue({
      ...mockParticipant,
      status: 'cancelled',
    } as any)
    vi.mocked(prisma.groupBookingParticipant.count).mockResolvedValue(1)

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/participants/${TEST_UUIDS.participantId}`,
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams(TEST_UUIDS.groupRequest, TEST_UUIDS.participantId),
    })

    expect(response.status).toBe(200)
  })

  it('should auto-cancel group when all participants leave', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.participant, userType: 'customer' },
    } as any)

    const mockParticipant = {
      id: TEST_UUIDS.participantId,
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      userId: TEST_UUIDS.participant,
      status: 'joined',
      groupBookingRequest: {
        id: TEST_UUIDS.groupRequest,
        creatorId: TEST_UUIDS.creator,
        status: 'open',
        serviceType: 'hovslagning',
      },
    }

    vi.mocked(prisma.groupBookingParticipant.findFirst).mockResolvedValue(mockParticipant as any)
    vi.mocked(prisma.groupBookingParticipant.update).mockResolvedValue({
      ...mockParticipant,
      status: 'cancelled',
    } as any)
    vi.mocked(prisma.groupBookingParticipant.count).mockResolvedValue(0) // No active participants
    vi.mocked(prisma.groupBookingRequest.update).mockResolvedValue({} as any)

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/participants/${TEST_UUIDS.participantId}`,
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams(TEST_UUIDS.groupRequest, TEST_UUIDS.participantId),
    })

    expect(response.status).toBe(200)
    // Should auto-cancel the group
    expect(prisma.groupBookingRequest.update).toHaveBeenCalledWith({
      where: { id: TEST_UUIDS.groupRequest },
      data: { status: 'cancelled' },
    })
  })

  it('should return 403 when unauthorized user tries to remove', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.otherUser, userType: 'customer' },
    } as any)

    // findFirst returns null because user is neither the participant nor creator
    vi.mocked(prisma.groupBookingParticipant.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/participants/${TEST_UUIDS.participantId}`,
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams(TEST_UUIDS.groupRequest, TEST_UUIDS.participantId),
    })

    expect(response.status).toBe(403)
  })
})
