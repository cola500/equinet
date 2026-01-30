import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  notificationService,
  NotificationType,
} from "@/domain/notification/NotificationService"

type RouteParams = { params: Promise<{ id: string; pid: string }> }

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id, pid } = await params

    // Find participant - must be the participant themselves OR the group creator
    const participant = await prisma.groupBookingParticipant.findFirst({
      where: {
        id: pid,
        groupBookingRequestId: id,
        status: { not: "cancelled" },
        OR: [
          { userId: session.user.id }, // Self-removal
          { groupBookingRequest: { creatorId: session.user.id } }, // Creator removal
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
    })

    if (!participant) {
      return NextResponse.json(
        { error: "Deltagaren hittades inte eller saknar behörighet" },
        { status: 403 }
      )
    }

    // Soft-delete: mark as cancelled
    await prisma.groupBookingParticipant.update({
      where: { id: pid },
      data: { status: "cancelled" },
    })

    // Check if any active participants remain
    const activeCount = await prisma.groupBookingParticipant.count({
      where: {
        groupBookingRequestId: id,
        status: { not: "cancelled" },
      },
    })

    // Auto-cancel group if no participants left
    if (activeCount === 0) {
      await prisma.groupBookingRequest.update({
        where: { id },
        data: { status: "cancelled" },
      })
      logger.info("Group booking auto-cancelled (no participants)", { groupBookingId: id })
    }

    // Notify creator if someone else left (and creator didn't remove them)
    if (
      participant.userId !== session.user.id &&
      participant.userId !== participant.groupBookingRequest.creatorId
    ) {
      // Creator removed someone - notify the removed user
      notificationService.createAsync({
        userId: participant.userId,
        type: NotificationType.GROUP_BOOKING_LEFT,
        message: `Du har tagits bort från grupprequesten för ${participant.groupBookingRequest.serviceType}`,
        linkUrl: "/customer/group-bookings",
        metadata: { groupBookingId: id },
      })
    } else if (
      participant.userId === session.user.id &&
      participant.userId !== participant.groupBookingRequest.creatorId
    ) {
      // User left voluntarily - notify creator
      notificationService.createAsync({
        userId: participant.groupBookingRequest.creatorId,
        type: NotificationType.GROUP_BOOKING_LEFT,
        message: `En deltagare har lämnat din grupprequest för ${participant.groupBookingRequest.serviceType}`,
        linkUrl: `/customer/group-bookings/${id}`,
        metadata: { groupBookingId: id },
      })
    }

    logger.info("Participant removed from group booking", {
      groupBookingId: id,
      participantId: pid,
      removedBy: session.user.id,
    })

    return NextResponse.json({
      message: "Deltagaren har lämnat grupprequesten",
    })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to remove participant", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to remove participant" },
      { status: 500 }
    )
  }
}
