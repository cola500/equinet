/**
 * GroupBookingService - Domain service for GroupBooking aggregate
 *
 * Contains business rules for creating, joining, updating, and matching
 * group booking requests. Uses Result pattern for explicit error handling.
 * All data access goes through IGroupBookingRepository (no Prisma imports).
 */
import { Result } from '@/domain/shared'
import { logger } from '@/lib/logger'
import {
  NotificationType,
  type CreateNotificationInput,
} from '@/domain/notification/NotificationService'
import type {
  IGroupBookingRepository,
  GroupBookingWithParticipants,
  GroupBookingWithDetails,
  GroupBookingParticipant,
  MatchBookingData,
} from '@/infrastructure/persistence/group-booking/IGroupBookingRepository'
import { GroupBookingRepository } from '@/infrastructure/persistence/group-booking/GroupBookingRepository'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export type GroupBookingErrorType =
  | 'GROUP_BOOKING_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INVALID_STATUS_TRANSITION'
  | 'GROUP_NOT_OPEN'
  | 'GROUP_FULL'
  | 'JOIN_DEADLINE_PASSED'
  | 'ALREADY_JOINED'
  | 'PARTICIPANT_NOT_FOUND'
  | 'NO_ACTIVE_PARTICIPANTS'
  | 'MATCH_FAILED'
  | 'PROVIDER_NOT_FOUND'

export interface GroupBookingError {
  type: GroupBookingErrorType
  message: string
}

export interface GroupBookingPreview {
  serviceType: string
  locationName: string
  address: string
  dateFrom: Date
  dateTo: Date
  maxParticipants: number
  currentParticipants: number
  joinDeadline: Date | null
  notes: string | null
  status: string
}

export interface GroupBookingServiceDeps {
  groupBookingRepository: IGroupBookingRepository
  generateInviteCode: () => string
  notificationService?: {
    createAsync: (input: CreateNotificationInput) => void | Promise<void>
  }
  getProviderForUser?: (userId: string) => Promise<{ id: string } | null>
  getServiceForProvider?: (
    serviceId: string,
    providerId: string
  ) => Promise<{ id: string; durationMinutes: number } | null>
}

export interface CreateGroupBookingInput {
  userId: string
  serviceType: string
  providerId?: string
  locationName: string
  address: string
  latitude?: number
  longitude?: number
  dateFrom: Date
  dateTo: Date
  notes?: string
  maxParticipants: number
  joinDeadline?: Date
  numberOfHorses?: number
  horseId?: string
  horseName?: string
  horseInfo?: string
}

export interface UpdateGroupBookingInput {
  groupBookingId: string
  userId: string
  notes?: string
  maxParticipants?: number
  joinDeadline?: Date
  status?: string
}

export interface JoinGroupBookingInput {
  userId: string
  inviteCode: string
  numberOfHorses?: number
  horseId?: string
  horseName?: string
  horseInfo?: string
  notes?: string
}

export interface RemoveParticipantInput {
  groupBookingId: string
  participantId: string
  userId: string
}

export interface MatchRequestInput {
  groupBookingRequestId: string
  providerId: string
  providerUserId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  serviceDurationMinutes: number
}

export interface MatchResult {
  bookingsCreated: number
  errors: string[]
}

// Valid status transitions from customer perspective
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['cancelled'],
  matched: ['cancelled'],
  // completed and cancelled are terminal states
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class GroupBookingService {
  private readonly repo: IGroupBookingRepository
  private readonly generateInviteCode: GroupBookingServiceDeps['generateInviteCode']
  private readonly notificationService?: GroupBookingServiceDeps['notificationService']
  private readonly getProviderForUser?: GroupBookingServiceDeps['getProviderForUser']
  private readonly getServiceForProvider?: GroupBookingServiceDeps['getServiceForProvider']

  constructor(deps: GroupBookingServiceDeps) {
    this.repo = deps.groupBookingRepository
    this.generateInviteCode = deps.generateInviteCode
    this.notificationService = deps.notificationService
    this.getProviderForUser = deps.getProviderForUser
    this.getServiceForProvider = deps.getServiceForProvider
  }

  // -----------------------------------------------------------
  // CREATE
  // -----------------------------------------------------------

  async createRequest(
    input: CreateGroupBookingInput
  ): Promise<Result<GroupBookingWithParticipants, GroupBookingError>> {
    const inviteCode = this.generateInviteCode()

    const created = await this.repo.create({
      creatorId: input.userId,
      serviceType: input.serviceType,
      providerId: input.providerId,
      locationName: input.locationName,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      notes: input.notes,
      maxParticipants: input.maxParticipants,
      inviteCode,
      joinDeadline: input.joinDeadline,
      creatorParticipant: {
        numberOfHorses: input.numberOfHorses ?? 1,
        horseId: input.horseId,
        horseName: input.horseName,
        horseInfo: input.horseInfo,
      },
    })

    logger.info('Group booking request created', {
      groupBookingId: created.id,
      creatorId: input.userId,
      inviteCode,
    })

    return Result.ok(created)
  }

  // -----------------------------------------------------------
  // LIST
  // -----------------------------------------------------------

  async listForUser(
    userId: string
  ): Promise<Result<GroupBookingWithParticipants[], GroupBookingError>> {
    const results = await this.repo.findByUserId(userId)
    return Result.ok(results)
  }

  // -----------------------------------------------------------
  // GET BY ID
  // -----------------------------------------------------------

  async getById(
    id: string,
    userId: string,
    userType: string
  ): Promise<Result<GroupBookingWithDetails, GroupBookingError>> {
    const result = await this.repo.findByIdWithAccess(id, userId, userType)
    if (!result) {
      return Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Grupprequest hittades inte',
      })
    }
    return Result.ok(result)
  }

  // -----------------------------------------------------------
  // GET PREVIEW BY CODE
  // -----------------------------------------------------------

  async getPreviewByCode(
    inviteCode: string
  ): Promise<Result<GroupBookingPreview, GroupBookingError>> {
    const groupRequest = await this.repo.findByInviteCode(inviteCode)
    if (!groupRequest) {
      return Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Ogiltig inbjudningskod',
      })
    }

    return Result.ok({
      serviceType: groupRequest.serviceType,
      locationName: groupRequest.locationName,
      address: groupRequest.address,
      dateFrom: groupRequest.dateFrom,
      dateTo: groupRequest.dateTo,
      maxParticipants: groupRequest.maxParticipants,
      currentParticipants: groupRequest._count.participants,
      joinDeadline: groupRequest.joinDeadline,
      notes: groupRequest.notes,
      status: groupRequest.status,
    })
  }

  // -----------------------------------------------------------
  // LIST AVAILABLE FOR PROVIDER
  // -----------------------------------------------------------

  async listAvailableForProvider(
    userId: string
  ): Promise<Result<{ provider: { id: string }; requests: GroupBookingWithParticipants[] }, GroupBookingError>> {
    const { provider, requests } = await this.repo.findAvailableForProvider(userId)
    if (!provider) {
      return Result.fail({
        type: 'PROVIDER_NOT_FOUND',
        message: 'Provider hittades inte',
      })
    }
    return Result.ok({ provider, requests })
  }

  // -----------------------------------------------------------
  // UPDATE
  // -----------------------------------------------------------

  async updateRequest(
    input: UpdateGroupBookingInput
  ): Promise<Result<GroupBookingWithParticipants, GroupBookingError>> {
    // 1. Auth: only creator can update
    const existing = await this.repo.findByIdForCreator(input.groupBookingId, input.userId)
    if (!existing) {
      return Result.fail({
        type: 'UNAUTHORIZED',
        message: 'Bara skaparen kan uppdatera grupprequesten',
      })
    }

    // 2. Validate status transition
    if (input.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || []
      if (!allowedTransitions.includes(input.status)) {
        return Result.fail({
          type: 'INVALID_STATUS_TRANSITION',
          message: `Kan inte ändra status från "${existing.status}" till "${input.status}"`,
        })
      }
    }

    // 3. Update
    const updated = await this.repo.update(input.groupBookingId, {
      notes: input.notes,
      maxParticipants: input.maxParticipants,
      joinDeadline: input.joinDeadline,
      status: input.status,
    })

    // 4. Notify participants if cancelled
    if (input.status === 'cancelled' && this.notificationService) {
      for (const participant of existing.participants) {
        if (participant.userId !== input.userId) {
          this.notificationService.createAsync({
            userId: participant.userId,
            type: NotificationType.GROUP_BOOKING_CANCELLED,
            message: `Grupprequest för ${existing.serviceType} har avbrutits`,
            linkUrl: '/customer/group-bookings',
            metadata: { groupBookingId: input.groupBookingId },
          })
        }
      }
    }

    logger.info('Group booking updated', {
      groupBookingId: input.groupBookingId,
    })

    return Result.ok(updated)
  }

  // -----------------------------------------------------------
  // JOIN
  // -----------------------------------------------------------

  async joinByInviteCode(
    input: JoinGroupBookingInput
  ): Promise<Result<GroupBookingParticipant, GroupBookingError>> {
    // 1. Find by invite code
    const groupRequest = await this.repo.findByInviteCode(input.inviteCode)
    if (!groupRequest) {
      return Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Ogiltig inbjudningskod',
      })
    }

    // 2. Must be open
    if (groupRequest.status !== 'open') {
      return Result.fail({
        type: 'GROUP_NOT_OPEN',
        message: 'Grupprequesten är inte längre öppen för nya deltagare',
      })
    }

    // 3. Not full
    if (groupRequest._count.participants >= groupRequest.maxParticipants) {
      return Result.fail({
        type: 'GROUP_FULL',
        message: 'Grupprequesten är fullt belagd',
      })
    }

    // 4. Deadline not passed
    if (groupRequest.joinDeadline && new Date() > groupRequest.joinDeadline) {
      return Result.fail({
        type: 'JOIN_DEADLINE_PASSED',
        message: 'Anslutnings-deadline har passerat',
      })
    }

    // 5. Not already joined
    const alreadyJoined = await this.repo.isUserParticipant(groupRequest.id, input.userId)
    if (alreadyJoined) {
      return Result.fail({
        type: 'ALREADY_JOINED',
        message: 'Du är redan med i denna grupprequest',
      })
    }

    // 6. Create participant
    const participant = await this.repo.addParticipant({
      groupBookingRequestId: groupRequest.id,
      userId: input.userId,
      numberOfHorses: input.numberOfHorses ?? 1,
      horseId: input.horseId,
      horseName: input.horseName,
      horseInfo: input.horseInfo,
      notes: input.notes,
    })

    // 7. Notify creator
    if (this.notificationService) {
      this.notificationService.createAsync({
        userId: groupRequest.creatorId,
        type: NotificationType.GROUP_BOOKING_JOINED,
        message: `En ny deltagare har gått med i din grupprequest för ${groupRequest.serviceType}`,
        linkUrl: `/customer/group-bookings/${groupRequest.id}`,
        metadata: { groupBookingId: groupRequest.id },
      })
    }

    logger.info('User joined group booking', {
      groupBookingId: groupRequest.id,
      userId: input.userId,
    })

    return Result.ok(participant)
  }

  // -----------------------------------------------------------
  // REMOVE PARTICIPANT
  // -----------------------------------------------------------

  async removeParticipant(
    input: RemoveParticipantInput
  ): Promise<Result<{ message: string }, GroupBookingError>> {
    // 1. Find participant with access check (self or creator)
    const participant = await this.repo.findParticipantWithAccess(
      input.participantId,
      input.groupBookingId,
      input.userId
    )

    if (!participant) {
      return Result.fail({
        type: 'PARTICIPANT_NOT_FOUND',
        message: 'Deltagaren hittades inte eller saknar behörighet',
      })
    }

    // 2. Soft-delete
    await this.repo.cancelParticipant(input.participantId)

    // 3. Auto-cancel group if no participants left
    const activeCount = await this.repo.countActiveParticipants(input.groupBookingId)
    if (activeCount === 0) {
      await this.repo.cancelRequest(input.groupBookingId)
      logger.info('Group booking auto-cancelled (no participants)', {
        groupBookingId: input.groupBookingId,
      })
    }

    // 4. Notifications
    if (this.notificationService) {
      const gbr = participant.groupBookingRequest
      if (participant.userId !== input.userId && participant.userId !== gbr.creatorId) {
        // Creator removed someone - notify the removed user
        this.notificationService.createAsync({
          userId: participant.userId,
          type: NotificationType.GROUP_BOOKING_LEFT,
          message: `Du har tagits bort från grupprequesten för ${gbr.serviceType}`,
          linkUrl: '/customer/group-bookings',
          metadata: { groupBookingId: input.groupBookingId },
        })
      } else if (participant.userId === input.userId && participant.userId !== gbr.creatorId) {
        // User left voluntarily - notify creator
        this.notificationService.createAsync({
          userId: gbr.creatorId,
          type: NotificationType.GROUP_BOOKING_LEFT,
          message: `En deltagare har lämnat din grupprequest för ${gbr.serviceType}`,
          linkUrl: `/customer/group-bookings/${input.groupBookingId}`,
          metadata: { groupBookingId: input.groupBookingId },
        })
      }
    }

    logger.info('Participant removed from group booking', {
      groupBookingId: input.groupBookingId,
      participantId: input.participantId,
      removedBy: input.userId,
    })

    return Result.ok({ message: 'Deltagaren har lämnat grupprequesten' })
  }

  // -----------------------------------------------------------
  // MATCH
  // -----------------------------------------------------------

  async matchRequest(
    input: MatchRequestInput
  ): Promise<Result<MatchResult, GroupBookingError>> {
    // 1. Fetch group request with active participants
    const groupRequest = await this.repo.findForMatch(input.groupBookingRequestId)
    if (!groupRequest) {
      return Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Grupprequesten hittades inte eller är inte öppen',
      })
    }

    if (groupRequest.participants.length === 0) {
      return Result.fail({
        type: 'NO_ACTIVE_PARTICIPANTS',
        message: 'Inga aktiva deltagare i grupprequesten',
      })
    }

    // 2. Calculate sequential time slots
    const calculateEndTime = (start: string, durationMin: number): string => {
      const [h, m] = start.split(':').map(Number)
      const totalMin = h * 60 + m + durationMin
      const endH = Math.floor(totalMin / 60)
      const endM = totalMin % 60
      return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
    }

    const bookings: MatchBookingData[] = []
    const participantBookingLinks: { participantId: string; bookingIndex: number }[] = []
    let currentStartTime = input.startTime

    for (let i = 0; i < groupRequest.participants.length; i++) {
      const participant = groupRequest.participants[i]
      const endTime = calculateEndTime(currentStartTime, input.serviceDurationMinutes)

      bookings.push({
        customerId: participant.userId,
        providerId: input.providerId,
        serviceId: input.serviceId,
        bookingDate: input.bookingDate,
        startTime: currentStartTime,
        endTime,
        horseName: participant.horseName,
        horseInfo: participant.horseInfo,
        horseId: participant.horseId,
        customerNotes: participant.notes,
      })

      participantBookingLinks.push({
        participantId: participant.id,
        bookingIndex: i,
      })

      currentStartTime = endTime
    }

    // 3. Execute match in transaction
    const result = await this.repo.matchAndCreateBookings(
      input.groupBookingRequestId,
      input.providerId,
      bookings,
      participantBookingLinks
    )

    // 4. Notify all participants (async, non-blocking)
    if (this.notificationService && result.bookingIds.length > 0) {
      for (const participant of groupRequest.participants) {
        this.notificationService.createAsync({
          userId: participant.userId,
          type: NotificationType.GROUP_BOOKING_MATCHED,
          message: `Din grupprequest för ${groupRequest.serviceType} har matchats med en leverantör!`,
          linkUrl: '/customer/bookings',
          metadata: { groupBookingId: input.groupBookingRequestId },
        })
      }
    }

    logger.info('Group booking matched', {
      groupBookingId: input.groupBookingRequestId,
      providerId: input.providerId,
      bookingsCreated: result.bookingIds.length,
      errors: result.errors.length,
    })

    return Result.ok({
      bookingsCreated: result.bookingIds.length,
      errors: result.errors,
    })
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

import { generateInviteCode } from '@/lib/invite-code'
import { notificationService } from '@/domain/notification/NotificationService'
import { prisma } from '@/lib/prisma'

export function createGroupBookingService(): GroupBookingService {
  return new GroupBookingService({
    groupBookingRepository: new GroupBookingRepository(),
    generateInviteCode,
    notificationService,
    getProviderForUser: async (userId: string) => {
      return prisma.provider.findUnique({
        where: { userId },
        select: { id: true },
      })
    },
    getServiceForProvider: async (serviceId: string, providerId: string) => {
      return prisma.service.findFirst({
        where: { id: serviceId, providerId, isActive: true },
        select: { id: true, durationMinutes: true },
      })
    },
  })
}
