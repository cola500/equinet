import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"

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

    const service = createGroupBookingService()
    const result = await service.getById(id, session.user.id, session.user.userType)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
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

    const service = createGroupBookingService()
    const result = await service.updateRequest({
      groupBookingId: id,
      userId: session.user.id,
      notes: validated.notes,
      maxParticipants: validated.maxParticipants,
      joinDeadline: validated.joinDeadline ? new Date(validated.joinDeadline) : undefined,
      status: validated.status,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
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
