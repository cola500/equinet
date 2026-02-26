import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared'
import { isFeatureEnabled } from '@/lib/feature-flags'

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

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

const mockService = {
  removeParticipant: vi.fn(),
}

vi.mock('@/domain/group-booking/GroupBookingService', () => ({
  createGroupBookingService: () => mockService,
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const makeParams = (id: string, pid: string) => Promise.resolve({ id, pid })

describe('DELETE /api/group-bookings/[id]/participants/[pid]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when group_bookings feature flag is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const req = new NextRequest('http://localhost/api/group-bookings/gb-1/participants/p-1', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'gb-1', pid: 'p-1' }) })
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('group_bookings')
  })

  it('should allow participant to leave (cancel their own participation)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.participant, userType: 'customer' },
    } as never)

    mockService.removeParticipant.mockResolvedValue(
      Result.ok({ message: 'Deltagaren har lämnat grupprequesten' })
    )

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
    } as never)

    mockService.removeParticipant.mockResolvedValue(
      Result.ok({ message: 'Deltagaren har lämnat grupprequesten' })
    )

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
    } as never)

    mockService.removeParticipant.mockResolvedValue(
      Result.ok({ message: 'Deltagaren har lämnat grupprequesten' })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/participants/${TEST_UUIDS.participantId}`,
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams(TEST_UUIDS.groupRequest, TEST_UUIDS.participantId),
    })

    expect(response.status).toBe(200)
    // Auto-cancel logic is tested in GroupBookingService.test.ts
  })

  it('should return 404 when unauthorized user tries to remove', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.otherUser, userType: 'customer' },
    } as never)

    mockService.removeParticipant.mockResolvedValue(
      Result.fail({
        type: 'PARTICIPANT_NOT_FOUND',
        message: 'Deltagaren hittades inte eller saknar behörighet',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/participants/${TEST_UUIDS.participantId}`,
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams(TEST_UUIDS.groupRequest, TEST_UUIDS.participantId),
    })

    // 404 is correct: we don't reveal whether the resource exists for unauthorized users
    expect(response.status).toBe(404)
  })
})
