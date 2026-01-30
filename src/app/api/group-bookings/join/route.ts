import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import {
  notificationService,
  NotificationType,
} from "@/domain/notification/NotificationService"

const joinSchema = z.object({
  inviteCode: z.string().min(1, "Inbjudningskod krävs").max(20),
  numberOfHorses: z.number().int().min(1).max(10).optional(),
  horseId: z.string().uuid().optional(),
  horseName: z.string().max(100).optional(),
  horseInfo: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Rate limiting
    const rateLimitKey = `booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar. Försök igen senare." },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      logger.error("Rate limiter error", rateLimitError instanceof Error ? rateLimitError : new Error(String(rateLimitError)))
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const validated = joinSchema.parse(body)

    // Find group booking by invite code
    const groupRequest = await prisma.groupBookingRequest.findUnique({
      where: { inviteCode: validated.inviteCode },
      include: {
        _count: {
          select: { participants: { where: { status: { not: "cancelled" } } } },
        },
      },
    })

    if (!groupRequest) {
      return NextResponse.json(
        { error: "Ogiltig inbjudningskod" },
        { status: 404 }
      )
    }

    // Validate: must be open
    if (groupRequest.status !== "open") {
      return NextResponse.json(
        { error: "Grupprequesten är inte längre öppen för nya deltagare" },
        { status: 400 }
      )
    }

    // Validate: not full
    if (groupRequest._count.participants >= groupRequest.maxParticipants) {
      return NextResponse.json(
        { error: "Grupprequesten är fullt belagd" },
        { status: 400 }
      )
    }

    // Validate: join deadline not passed
    if (groupRequest.joinDeadline && new Date() > groupRequest.joinDeadline) {
      return NextResponse.json(
        { error: "Anslutnings-deadline har passerat" },
        { status: 400 }
      )
    }

    // Validate: not already joined
    const existingParticipant = await prisma.groupBookingParticipant.findUnique({
      where: {
        groupBookingRequestId_userId: {
          groupBookingRequestId: groupRequest.id,
          userId: session.user.id,
        },
      },
    })

    if (existingParticipant) {
      return NextResponse.json(
        { error: "Du är redan med i denna grupprequest" },
        { status: 409 }
      )
    }

    // Create participant
    const participant = await prisma.groupBookingParticipant.create({
      data: {
        groupBookingRequestId: groupRequest.id,
        userId: session.user.id,
        numberOfHorses: validated.numberOfHorses ?? 1,
        horseId: validated.horseId,
        horseName: validated.horseName,
        horseInfo: validated.horseInfo,
        notes: validated.notes,
        status: "joined",
      },
    })

    // Notify creator
    notificationService.createAsync({
      userId: groupRequest.creatorId,
      type: NotificationType.GROUP_BOOKING_JOINED,
      message: `En ny deltagare har gått med i din grupprequest för ${groupRequest.serviceType}`,
      linkUrl: `/customer/group-bookings/${groupRequest.id}`,
      metadata: { groupBookingId: groupRequest.id },
    })

    logger.info("User joined group booking", {
      groupBookingId: groupRequest.id,
      userId: session.user.id,
    })

    return NextResponse.json(participant, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to join group booking", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to join group booking" },
      { status: 500 }
    )
  }
}
