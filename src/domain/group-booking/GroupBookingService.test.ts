import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GroupBookingService } from './GroupBookingService'
import { MockGroupBookingRepository } from '@/infrastructure/persistence/group-booking/MockGroupBookingRepository'
import type {
  GroupBookingRequest,
  GroupBookingParticipant,
} from '@/infrastructure/persistence/group-booking/IGroupBookingRepository'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

// -----------------------------------------------------------
// Fixtures
// -----------------------------------------------------------

const TEST_UUIDS = {
  creator: '11111111-1111-4111-8111-111111111111',
  joiner: '22222222-2222-4222-8222-222222222222',
  provider: '33333333-3333-4333-8333-333333333333',
  providerUser: '44444444-4444-4444-8444-444444444444',
  service: '55555555-5555-4555-8555-555555555555',
  otherUser: '66666666-6666-4666-8666-666666666666',
}

const FUTURE = new Date()
FUTURE.setDate(FUTURE.getDate() + 14)
const FUTURE_END = new Date(FUTURE)
FUTURE_END.setDate(FUTURE_END.getDate() + 7)

const makeRequest = (overrides: Partial<GroupBookingRequest> = {}): GroupBookingRequest => ({
  id: 'gbr-1',
  creatorId: TEST_UUIDS.creator,
  serviceType: 'hovslagning',
  providerId: null,
  locationName: 'Sollebrunn Ridklubb',
  address: 'Stallvägen 1',
  latitude: null,
  longitude: null,
  dateFrom: FUTURE,
  dateTo: FUTURE_END,
  notes: null,
  maxParticipants: 10,
  status: 'open',
  inviteCode: 'ABC12345',
  joinDeadline: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeParticipant = (overrides: Partial<GroupBookingParticipant> = {}): GroupBookingParticipant => ({
  id: 'gbp-1',
  groupBookingRequestId: 'gbr-1',
  userId: TEST_UUIDS.creator,
  numberOfHorses: 1,
  horseId: null,
  horseName: 'Blansen',
  horseInfo: null,
  notes: null,
  status: 'joined',
  bookingId: null,
  joinedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('GroupBookingService', () => {
  let repo: MockGroupBookingRepository
  let service: GroupBookingService
  let mockNotify: { createAsync: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = new MockGroupBookingRepository()
    mockNotify = { createAsync: vi.fn() }

    service = new GroupBookingService({
      groupBookingRepository: repo,
      generateInviteCode: () => 'TEST1234',
      notificationService: mockNotify,
    })

    repo.seedUserNames(
      new Map([
        [TEST_UUIDS.creator, { firstName: 'Anna' }],
        [TEST_UUIDS.joiner, { firstName: 'Erik' }],
      ])
    )
  })

  // -----------------------------------------------------------
  // CREATE
  // -----------------------------------------------------------

  describe('createRequest', () => {
    it('should create group booking with creator as first participant', async () => {
      const result = await service.createRequest({
        userId: TEST_UUIDS.creator,
        serviceType: 'hovslagning',
        locationName: 'Sollebrunn Ridklubb',
        address: 'Stallvägen 1',
        dateFrom: FUTURE,
        dateTo: FUTURE_END,
        maxParticipants: 6,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('open')
      expect(result.value.inviteCode).toBe('TEST1234')
      expect(result.value.participants).toHaveLength(1)
      expect(result.value._count.participants).toBe(1)
    })

    it('should use custom horse info when provided', async () => {
      const result = await service.createRequest({
        userId: TEST_UUIDS.creator,
        serviceType: 'hovslagning',
        locationName: 'Test',
        address: 'Test',
        dateFrom: FUTURE,
        dateTo: FUTURE_END,
        maxParticipants: 6,
        numberOfHorses: 2,
        horseName: 'Blansen',
      })

      expect(result.isSuccess).toBe(true)
    })
  })

  // -----------------------------------------------------------
  // LIST
  // -----------------------------------------------------------

  describe('listForUser', () => {
    it('should return group bookings for creator', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.listForUser(TEST_UUIDS.creator)

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveLength(1)
    })

    it('should return empty array for user with no bookings', async () => {
      const result = await service.listForUser(TEST_UUIDS.otherUser)

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------
  // GET BY ID
  // -----------------------------------------------------------

  describe('getById', () => {
    it('should return group booking for creator', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.getById('gbr-1', TEST_UUIDS.creator, 'customer')

      expect(result.isSuccess).toBe(true)
      expect(result.value.id).toBe('gbr-1')
    })

    it('should return NOT_FOUND for non-existent request', async () => {
      const result = await service.getById('nonexistent', TEST_UUIDS.creator, 'customer')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GROUP_BOOKING_NOT_FOUND')
    })
  })

  // -----------------------------------------------------------
  // LIST AVAILABLE FOR PROVIDER
  // -----------------------------------------------------------

  describe('listAvailableForProvider', () => {
    it('should return open future requests', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.listAvailableForProvider(TEST_UUIDS.providerUser)

      expect(result.isSuccess).toBe(true)
      expect(result.value.requests).toHaveLength(1)
    })

    it('should not return past or non-open requests', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 7)
      repo.seedRequests([
        makeRequest({ id: 'gbr-past', dateFrom: pastDate }),
        makeRequest({ id: 'gbr-cancelled', status: 'cancelled' }),
      ])

      const result = await service.listAvailableForProvider(TEST_UUIDS.providerUser)

      expect(result.isSuccess).toBe(true)
      expect(result.value.requests).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------
  // UPDATE
  // -----------------------------------------------------------

  describe('updateRequest', () => {
    it('should update notes for creator', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.updateRequest({
        groupBookingId: 'gbr-1',
        userId: TEST_UUIDS.creator,
        notes: 'Updated notes',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.notes).toBe('Updated notes')
    })

    it('should fail if not creator', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.updateRequest({
        groupBookingId: 'gbr-1',
        userId: TEST_UUIDS.otherUser,
        notes: 'Should fail',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('UNAUTHORIZED')
    })

    it('should allow cancellation from open status', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([
        makeParticipant(),
        makeParticipant({ id: 'gbp-2', userId: TEST_UUIDS.joiner }),
      ])

      const result = await service.updateRequest({
        groupBookingId: 'gbr-1',
        userId: TEST_UUIDS.creator,
        status: 'cancelled',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('cancelled')
      // Should notify other participants (not creator)
      expect(mockNotify.createAsync).toHaveBeenCalled()
    })

    it('should reject invalid status transition', async () => {
      repo.seedRequests([makeRequest({ status: 'completed' })])
      repo.seedParticipants([makeParticipant()])

      const result = await service.updateRequest({
        groupBookingId: 'gbr-1',
        userId: TEST_UUIDS.creator,
        status: 'cancelled',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })
  })

  // -----------------------------------------------------------
  // JOIN
  // -----------------------------------------------------------

  describe('joinByInviteCode', () => {
    it('should allow user to join via invite code', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.joinByInviteCode({
        userId: TEST_UUIDS.joiner,
        inviteCode: 'ABC12345',
        numberOfHorses: 2,
        horseName: 'Firfansen',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.userId).toBe(TEST_UUIDS.joiner)
      expect(result.value.numberOfHorses).toBe(2)
      // Should notify creator
      expect(mockNotify.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({ userId: TEST_UUIDS.creator })
      )
    })

    it('should fail for invalid invite code', async () => {
      const result = await service.joinByInviteCode({
        userId: TEST_UUIDS.joiner,
        inviteCode: 'BADCODE1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GROUP_BOOKING_NOT_FOUND')
    })

    it('should fail when group is not open', async () => {
      repo.seedRequests([makeRequest({ status: 'matched' })])

      const result = await service.joinByInviteCode({
        userId: TEST_UUIDS.joiner,
        inviteCode: 'ABC12345',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GROUP_NOT_OPEN')
    })

    it('should fail when group is full', async () => {
      repo.seedRequests([makeRequest({ maxParticipants: 1 })])
      repo.seedParticipants([makeParticipant()])

      const result = await service.joinByInviteCode({
        userId: TEST_UUIDS.joiner,
        inviteCode: 'ABC12345',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GROUP_FULL')
    })

    it('should fail when join deadline has passed', async () => {
      const pastDeadline = new Date()
      pastDeadline.setDate(pastDeadline.getDate() - 1)
      repo.seedRequests([makeRequest({ joinDeadline: pastDeadline })])

      const result = await service.joinByInviteCode({
        userId: TEST_UUIDS.joiner,
        inviteCode: 'ABC12345',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('JOIN_DEADLINE_PASSED')
    })

    it('should fail when user already joined', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([
        makeParticipant(),
        makeParticipant({ id: 'gbp-joiner', userId: TEST_UUIDS.joiner }),
      ])

      const result = await service.joinByInviteCode({
        userId: TEST_UUIDS.joiner,
        inviteCode: 'ABC12345',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('ALREADY_JOINED')
    })
  })

  // -----------------------------------------------------------
  // REMOVE PARTICIPANT
  // -----------------------------------------------------------

  describe('removeParticipant', () => {
    it('should allow self-removal', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([
        makeParticipant(),
        makeParticipant({ id: 'gbp-joiner', userId: TEST_UUIDS.joiner }),
      ])

      const result = await service.removeParticipant({
        groupBookingId: 'gbr-1',
        participantId: 'gbp-joiner',
        userId: TEST_UUIDS.joiner,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.message).toContain('lämnat')
      // Should notify creator
      expect(mockNotify.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({ userId: TEST_UUIDS.creator })
      )
    })

    it('should allow creator to remove participant', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([
        makeParticipant(),
        makeParticipant({ id: 'gbp-joiner', userId: TEST_UUIDS.joiner }),
      ])

      const result = await service.removeParticipant({
        groupBookingId: 'gbr-1',
        participantId: 'gbp-joiner',
        userId: TEST_UUIDS.creator,
      })

      expect(result.isSuccess).toBe(true)
      // Should notify removed user
      expect(mockNotify.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({ userId: TEST_UUIDS.joiner })
      )
    })

    it('should auto-cancel group when no participants left', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.removeParticipant({
        groupBookingId: 'gbr-1',
        participantId: 'gbp-1',
        userId: TEST_UUIDS.creator,
      })

      expect(result.isSuccess).toBe(true)
      // Group should be cancelled
      const requests = repo.getAll()
      expect(requests[0].status).toBe('cancelled')
    })

    it('should fail for unauthorized user', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([makeParticipant()])

      const result = await service.removeParticipant({
        groupBookingId: 'gbr-1',
        participantId: 'gbp-1',
        userId: TEST_UUIDS.otherUser,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('PARTICIPANT_NOT_FOUND')
    })
  })

  // -----------------------------------------------------------
  // MATCH
  // -----------------------------------------------------------

  describe('matchRequest', () => {
    it('should create bookings for all participants in sequential time slots', async () => {
      repo.seedRequests([makeRequest()])
      repo.seedParticipants([
        makeParticipant(),
        makeParticipant({ id: 'gbp-2', userId: TEST_UUIDS.joiner, horseName: 'Firfansen' }),
      ])

      const result = await service.matchRequest({
        groupBookingRequestId: 'gbr-1',
        providerId: TEST_UUIDS.provider,
        providerUserId: TEST_UUIDS.providerUser,
        serviceId: TEST_UUIDS.service,
        bookingDate: new Date('2026-02-15'),
        startTime: '10:00',
        serviceDurationMinutes: 60,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.bookingsCreated).toBe(2)
      expect(result.value.errors).toHaveLength(0)

      // Verify group request is now matched
      const requests = repo.getAll()
      expect(requests[0].status).toBe('matched')
      expect(requests[0].providerId).toBe(TEST_UUIDS.provider)

      // Verify participants are linked to bookings
      const participants = repo.getAllParticipants()
      const booked = participants.filter((p) => p.status === 'booked')
      expect(booked).toHaveLength(2)

      // Should notify all participants
      expect(mockNotify.createAsync).toHaveBeenCalledTimes(2)
    })

    it('should fail when group request not found', async () => {
      const result = await service.matchRequest({
        groupBookingRequestId: 'nonexistent',
        providerId: TEST_UUIDS.provider,
        providerUserId: TEST_UUIDS.providerUser,
        serviceId: TEST_UUIDS.service,
        bookingDate: new Date('2026-02-15'),
        startTime: '10:00',
        serviceDurationMinutes: 60,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GROUP_BOOKING_NOT_FOUND')
    })

    it('should fail when no active participants', async () => {
      repo.seedRequests([makeRequest()])
      // No participants seeded

      const result = await service.matchRequest({
        groupBookingRequestId: 'gbr-1',
        providerId: TEST_UUIDS.provider,
        providerUserId: TEST_UUIDS.providerUser,
        serviceId: TEST_UUIDS.service,
        bookingDate: new Date('2026-02-15'),
        startTime: '10:00',
        serviceDurationMinutes: 60,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NO_ACTIVE_PARTICIPANTS')
    })
  })
})
