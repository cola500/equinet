import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import {
  notificationService,
  NotificationType,
} from "@/domain/notification/NotificationService"

type RouteParams = { params: Promise<{ id: string }> }

const updateGroupBookingSchema = z.object({
  notes: z.string().max(1000).optional(),
  maxParticipants: z.number().int().min(2).max(20).optional(),
  joinDeadline: z.string().refine(
    (s) => !isNaN(Date.parse(s)),
    { message: "Ogiltigt datumformat" }
  ).optional(),
  status: z.enum(["open", "matched", "completed", "cancelled"]).optional(),
})

// Valid status transitions from customer perspective
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["cancelled"],
  matched: ["cancelled"],
  // completed and cancelled are terminal states
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()
    const { id } = await params

    // Access: participant, creator, matched provider, or any provider for open requests
    const isProvider = session.user.userType === "provider"
    const groupRequest = await prisma.groupBookingRequest.findFirst({
      where: {
        id,
        OR: [
          { creatorId: session.user.id },
          { participants: { some: { userId: session.user.id } } },
          { provider: { userId: session.user.id } },
          // Providers can view open requests (needed to evaluate before matching)
          ...(isProvider ? [{ status: "open" }] : []),
        ],
      },
      include: {
        participants: {
          where: { status: { not: "cancelled" } },
          include: {
            user: {
              select: { firstName: true }, // Privacy: only first name
            },
            horse: {
              select: { name: true },
            },
          },
        },
        provider: {
          select: {
            id: true,
            businessName: true,
          },
        },
        _count: {
          select: { participants: { where: { status: { not: "cancelled" } } } },
        },
      },
    })

    if (!groupRequest) {
      return NextResponse.json(
        { error: "Grupprequest hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(groupRequest)
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to fetch group booking", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to fetch group booking" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params

    // Only creator can update
    const existing = await prisma.groupBookingRequest.findFirst({
      where: { id, creatorId: session.user.id },
      include: {
        participants: {
          where: { status: { not: "cancelled" } },
          select: { userId: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Bara skaparen kan uppdatera grupprequesten" },
        { status: 403 }
      )
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

    const validated = updateGroupBookingSchema.parse(body)

    // Validate status transition
    if (validated.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || []
      if (!allowedTransitions.includes(validated.status)) {
        return NextResponse.json(
          { error: `Kan inte ändra status från "${existing.status}" till "${validated.status}"` },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.groupBookingRequest.update({
      where: { id },
      data: {
        ...(validated.notes !== undefined && { notes: validated.notes }),
        ...(validated.maxParticipants !== undefined && { maxParticipants: validated.maxParticipants }),
        ...(validated.joinDeadline !== undefined && { joinDeadline: new Date(validated.joinDeadline) }),
        ...(validated.status !== undefined && { status: validated.status }),
      },
      include: {
        participants: {
          where: { status: { not: "cancelled" } },
          include: {
            user: {
              select: { firstName: true },
            },
          },
        },
      },
    })

    // Notify participants if cancelled
    if (validated.status === "cancelled") {
      for (const participant of existing.participants) {
        if (participant.userId !== session.user.id) {
          notificationService.createAsync({
            userId: participant.userId,
            type: NotificationType.GROUP_BOOKING_CANCELLED,
            message: `Grupprequest för ${existing.serviceType} har avbrutits`,
            linkUrl: "/customer/group-bookings",
            metadata: { groupBookingId: id },
          })
        }
      }
    }

    logger.info("Group booking updated", { groupBookingId: id, updatedFields: Object.keys(validated) })

    return NextResponse.json(updated)
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

    logger.error("Failed to update group booking", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to update group booking" },
      { status: 500 }
    )
  }
}
