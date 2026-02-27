/**
 * PrismaGroupBookingRepository - Prisma implementation
 *
 * Handles data persistence for GroupBooking aggregate (Request + Participants).
 * Uses `select` to prevent passwordHash leaks.
 * Authorization is atomic in WHERE clauses (IDOR protection).
 * $transaction used for match operation (sequential bookings).
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import type {
  IGroupBookingRepository,
  GroupBookingRequest,
  GroupBookingParticipant,
  GroupBookingWithParticipants,
  GroupBookingWithDetails,
  GroupBookingForMatch,
  CreateGroupBookingData,
  UpdateGroupBookingData,
  CreateParticipantData,
  MatchBookingData,
} from './IGroupBookingRepository'

// -----------------------------------------------------------
// Select objects (never expose sensitive user data)
// -----------------------------------------------------------

const participantWithUserSelect = {
  id: true,
  groupBookingRequestId: true,
  userId: true,
  numberOfHorses: true,
  horseId: true,
  horseName: true,
  horseInfo: true,
  notes: true,
  status: true,
  bookingId: true,
  joinedAt: true,
  updatedAt: true,
  user: { select: { firstName: true } },
  horse: { select: { name: true } },
} satisfies Prisma.GroupBookingParticipantSelect

const requestWithParticipantsInclude = {
  participants: {
    where: { status: { not: 'cancelled' } },
    select: participantWithUserSelect,
  },
  _count: {
    select: { participants: { where: { status: { not: 'cancelled' } } } },
  },
}

const requestWithDetailsInclude = {
  ...requestWithParticipantsInclude,
  provider: {
    select: { id: true, businessName: true },
  },
}

// -----------------------------------------------------------
// Implementation
// -----------------------------------------------------------

export class GroupBookingRepository implements IGroupBookingRepository {
  // ==========================================
  // QUERY METHODS
  // ==========================================

  async findByIdWithAccess(
    id: string,
    userId: string,
    userType: string
  ): Promise<GroupBookingWithDetails | null> {
    const isProvider = userType === 'provider'
    return prisma.groupBookingRequest.findFirst({
      where: {
        id,
        OR: [
          { creatorId: userId },
          { participants: { some: { userId } } },
          { provider: { userId } },
          ...(isProvider ? [{ status: 'open' as const }] : []),
        ],
      },
      include: requestWithDetailsInclude,
    }) as Promise<GroupBookingWithDetails | null>
  }

  async findByUserId(userId: string): Promise<GroupBookingWithParticipants[]> {
    return prisma.groupBookingRequest.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: requestWithParticipantsInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<GroupBookingWithParticipants[]>
  }

  async findAvailableForProvider(userId: string): Promise<{
    provider: { id: string } | null
    requests: GroupBookingWithParticipants[]
  }> {
    const provider = await prisma.provider.findUnique({
      where: { userId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        serviceAreaKm: true,
        services: {
          where: { isActive: true },
          select: { name: true },
        },
      },
    })

    if (!provider) {
      return { provider: null, requests: [] }
    }

    const requests = await prisma.groupBookingRequest.findMany({
      where: {
        status: 'open',
        dateFrom: { gte: new Date() },
      },
      include: requestWithParticipantsInclude,
      orderBy: { dateFrom: 'asc' },
    }) as GroupBookingWithParticipants[]

    return { provider: { id: provider.id }, requests }
  }

  async findByInviteCode(
    inviteCode: string
  ): Promise<(GroupBookingRequest & { _count: { participants: number } }) | null> {
    return prisma.groupBookingRequest.findUnique({
      where: { inviteCode },
      include: {
        _count: {
          select: { participants: { where: { status: { not: 'cancelled' } } } },
        },
      },
    }) as Promise<(GroupBookingRequest & { _count: { participants: number } }) | null>
  }

  async findForMatch(id: string): Promise<GroupBookingForMatch | null> {
    return prisma.groupBookingRequest.findFirst({
      where: { id, status: 'open' },
      select: {
        id: true,
        status: true,
        serviceType: true,
        participants: {
          where: { status: 'joined' },
          select: {
            id: true,
            userId: true,
            horseName: true,
            horseInfo: true,
            horseId: true,
            notes: true,
            user: { select: { id: true, firstName: true } },
          },
        },
      },
    })
  }

  async isUserParticipant(
    groupBookingRequestId: string,
    userId: string
  ): Promise<boolean> {
    const existing = await prisma.groupBookingParticipant.findUnique({
      where: {
        groupBookingRequestId_userId: {
          groupBookingRequestId,
          userId,
        },
      },
    })
    return existing !== null
  }

  async findByIdForCreator(
    id: string,
    creatorId: string
  ): Promise<(GroupBookingRequest & { participants: { userId: string }[] }) | null> {
    return prisma.groupBookingRequest.findFirst({
      where: { id, creatorId },
      include: {
        participants: {
          where: { status: { not: 'cancelled' } },
          select: { userId: true },
        },
      },
    }) as Promise<(GroupBookingRequest & { participants: { userId: string }[] }) | null>
  }

  async findParticipantWithAccess(
    participantId: string,
    groupBookingRequestId: string,
    userId: string
  ): Promise<(GroupBookingParticipant & {
    groupBookingRequest: {
      id: string
      creatorId: string
      status: string
      serviceType: string
    }
  }) | null> {
    return prisma.groupBookingParticipant.findFirst({
      where: {
        id: participantId,
        groupBookingRequestId,
        status: { not: 'cancelled' },
        OR: [
          { userId },
          { groupBookingRequest: { creatorId: userId } },
        ],
      },
      include: {
        groupBookingRequest: {
          select: {
            id: true,
            creatorId: true,
            status: true,
            serviceType: true,
          },
        },
      },
    }) as Promise<(GroupBookingParticipant & {
      groupBookingRequest: {
        id: string
        creatorId: string
        status: string
        serviceType: string
      }
    }) | null>
  }

  async countActiveParticipants(groupBookingRequestId: string): Promise<number> {
    return prisma.groupBookingParticipant.count({
      where: {
        groupBookingRequestId,
        status: { not: 'cancelled' },
      },
    })
  }

  // ==========================================
  // COMMAND METHODS
  // ==========================================

  async create(data: CreateGroupBookingData): Promise<GroupBookingWithParticipants> {
    return prisma.groupBookingRequest.create({
      data: {
        creatorId: data.creatorId,
        serviceType: data.serviceType,
        providerId: data.providerId,
        locationName: data.locationName,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        notes: data.notes,
        maxParticipants: data.maxParticipants,
        status: 'open',
        inviteCode: data.inviteCode,
        joinDeadline: data.joinDeadline,
        participants: {
          create: {
            userId: data.creatorId,
            numberOfHorses: data.creatorParticipant.numberOfHorses,
            horseId: data.creatorParticipant.horseId,
            horseName: data.creatorParticipant.horseName,
            horseInfo: data.creatorParticipant.horseInfo,
            status: 'joined',
          },
        },
      },
      include: requestWithParticipantsInclude,
    }) as Promise<GroupBookingWithParticipants>
  }

  async update(
    id: string,
    data: UpdateGroupBookingData
  ): Promise<GroupBookingWithParticipants> {
    return prisma.groupBookingRequest.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.maxParticipants !== undefined && { maxParticipants: data.maxParticipants }),
        ...(data.joinDeadline !== undefined && { joinDeadline: data.joinDeadline }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: requestWithParticipantsInclude,
    }) as Promise<GroupBookingWithParticipants>
  }

  async addParticipant(data: CreateParticipantData): Promise<GroupBookingParticipant> {
    return prisma.groupBookingParticipant.create({
      data: {
        groupBookingRequestId: data.groupBookingRequestId,
        userId: data.userId,
        numberOfHorses: data.numberOfHorses,
        horseId: data.horseId,
        horseName: data.horseName,
        horseInfo: data.horseInfo,
        notes: data.notes,
        status: 'joined',
      },
    })
  }

  async cancelParticipant(participantId: string): Promise<void> {
    await prisma.groupBookingParticipant.update({
      where: { id: participantId },
      data: { status: 'cancelled' },
    })
  }

  async cancelRequest(id: string): Promise<void> {
    await prisma.groupBookingRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })
  }

  async matchAndCreateBookings(
    groupBookingRequestId: string,
    providerId: string,
    bookings: MatchBookingData[],
    participantBookingLinks: { participantId: string; bookingIndex: number }[]
  ): Promise<{ bookingIds: string[]; errors: string[] }> {
    // @ts-expect-error - Prisma interactive transaction TypeScript inference issue
    const result: { bookingIds: string[]; errors: string[] } = await prisma.$transaction(async (tx: typeof prisma) => {
      const bookingIds: string[] = []
      const errors: string[] = []

      for (let i = 0; i < bookings.length; i++) {
        const bookingData = bookings[i]
        try {
          const booking = await tx.booking.create({
            data: {
              customerId: bookingData.customerId,
              providerId: bookingData.providerId,
              serviceId: bookingData.serviceId,
              bookingDate: bookingData.bookingDate,
              startTime: bookingData.startTime,
              endTime: bookingData.endTime,
              status: 'confirmed',
              horseName: bookingData.horseName,
              horseInfo: bookingData.horseInfo,
              horseId: bookingData.horseId,
              customerNotes: bookingData.customerNotes,
            },
          })

          // Link participant to booking
          const link = participantBookingLinks.find((l) => l.bookingIndex === i)
          if (link) {
            await tx.groupBookingParticipant.update({
              where: { id: link.participantId },
              data: { bookingId: booking.id, status: 'booked' },
            })
          }

          bookingIds.push(booking.id)
        } catch (err) {
          const msg = `Failed to create booking ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`
          errors.push(msg)
          logger.error(msg, err instanceof Error ? err : new Error(String(err)))
        }
      }

      // Update group request status
      if (bookingIds.length > 0) {
        await tx.groupBookingRequest.update({
          where: { id: groupBookingRequestId },
          data: { status: 'matched', providerId },
        })
      }

      return { bookingIds, errors }
    })

    return result
  }
}
