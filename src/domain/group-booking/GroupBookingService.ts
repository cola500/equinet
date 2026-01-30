import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  notificationService,
  NotificationType,
} from "@/domain/notification/NotificationService"

export interface MatchResult {
  success: boolean
  bookingsCreated: number
  errors: string[]
}

/**
 * GroupBookingService - handles matching a provider to a group booking request.
 *
 * When a provider "matches" a group request:
 * 1. Creates individual Bookings for each active participant
 * 2. Links each participant to their booking
 * 3. Updates the group request status to "matched"
 * 4. Notifies all participants
 */
export class GroupBookingService {
  /**
   * Match a provider to a group booking request.
   * Creates individual bookings for each participant via a transaction.
   */
  async matchRequest(input: {
    groupBookingRequestId: string
    providerId: string
    providerUserId: string
    serviceId: string
    bookingDate: Date
    startTime: string
    serviceDurationMinutes: number
  }): Promise<MatchResult> {
    const {
      groupBookingRequestId,
      providerId,
      providerUserId,
      serviceId,
      bookingDate,
      startTime,
      serviceDurationMinutes,
    } = input

    try {
      // Fetch group request with active participants
      const groupRequest = await prisma.groupBookingRequest.findFirst({
        where: {
          id: groupBookingRequestId,
          status: "open",
        },
        include: {
          participants: {
            where: { status: "joined" },
            include: {
              user: { select: { id: true, firstName: true } },
            },
          },
        },
      })

      if (!groupRequest) {
        return {
          success: false,
          bookingsCreated: 0,
          errors: ["Grupprequesten hittades inte eller är inte öppen"],
        }
      }

      if (groupRequest.participants.length === 0) {
        return {
          success: false,
          bookingsCreated: 0,
          errors: ["Inga aktiva deltagare i grupprequesten"],
        }
      }

      // Calculate end time and sequential slots
      const calculateEndTime = (start: string, durationMin: number): string => {
        const [h, m] = start.split(":").map(Number)
        const totalMin = h * 60 + m + durationMin
        const endH = Math.floor(totalMin / 60)
        const endM = totalMin % 60
        return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`
      }

      // Create bookings in a transaction
      // @ts-expect-error - Prisma interactive transaction TypeScript inference issue
      const result: { bookings: any[]; errors: string[] } = await prisma.$transaction(async (tx: any) => {
        const bookings = []
        const errors: string[] = []
        let currentStartTime = startTime

        for (const participant of groupRequest.participants) {
          const endTime = calculateEndTime(currentStartTime, serviceDurationMinutes)

          try {
            const booking = await tx.booking.create({
              data: {
                customerId: participant.userId,
                providerId,
                serviceId,
                bookingDate,
                startTime: currentStartTime,
                endTime,
                status: "confirmed",
                horseName: participant.horseName,
                horseInfo: participant.horseInfo,
                horseId: participant.horseId,
                customerNotes: participant.notes,
              },
            })

            // Link participant to booking
            await tx.groupBookingParticipant.update({
              where: { id: participant.id },
              data: {
                bookingId: booking.id,
                status: "booked",
              },
            })

            bookings.push(booking)
          } catch (err) {
            const msg = `Kunde inte skapa bokning för ${participant.user.firstName}: ${err instanceof Error ? err.message : "Okänt fel"}`
            errors.push(msg)
            logger.error(msg, err instanceof Error ? err : new Error(String(err)))
          }

          // Next slot starts after this one
          currentStartTime = endTime
        }

        // Update group request status
        if (bookings.length > 0) {
          await tx.groupBookingRequest.update({
            where: { id: groupBookingRequestId },
            data: {
              status: "matched",
              providerId,
            },
          })
        }

        return { bookings, errors }
      })

      // Notify all participants (async, non-blocking)
      for (const participant of groupRequest.participants) {
        notificationService.createAsync({
          userId: participant.userId,
          type: NotificationType.GROUP_BOOKING_MATCHED,
          message: `Din grupprequest för ${groupRequest.serviceType} har matchats med en leverantör!`,
          linkUrl: "/customer/bookings",
          metadata: { groupBookingId: groupBookingRequestId },
        })
      }

      logger.info("Group booking matched", {
        groupBookingId: groupBookingRequestId,
        providerId,
        bookingsCreated: result.bookings.length,
        errors: result.errors.length,
      })

      return {
        success: result.bookings.length > 0,
        bookingsCreated: result.bookings.length,
        errors: result.errors,
      }
    } catch (err) {
      logger.error(
        "Failed to match group booking",
        err instanceof Error ? err : new Error(String(err))
      )
      return {
        success: false,
        bookingsCreated: 0,
        errors: [err instanceof Error ? err.message : "Okänt fel"],
      }
    }
  }
}

export const groupBookingService = new GroupBookingService()
