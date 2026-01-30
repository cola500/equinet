import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { groupBookingService } from "@/domain/group-booking/GroupBookingService"

type RouteParams = { params: Promise<{ id: string }> }

const matchSchema = z.object({
  serviceId: z.string().uuid("Ogiltigt tjänst-ID"),
  bookingDate: z.string().refine(
    (s) => !isNaN(Date.parse(s)),
    { message: "Ogiltigt datumformat" }
  ),
  startTime: z.string().regex(
    /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
    "Ogiltigt tidsformat (HH:MM)"
  ),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantörer kan matcha grupprequests" },
        { status: 403 }
      )
    }

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

    const validated = matchSchema.parse(body)

    // Verify provider
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Provider hittades inte" },
        { status: 404 }
      )
    }

    // Verify service belongs to provider
    const service = await prisma.service.findFirst({
      where: {
        id: validated.serviceId,
        providerId: provider.id,
        isActive: true,
      },
      select: { id: true, durationMinutes: true },
    })

    if (!service) {
      return NextResponse.json(
        { error: "Tjänsten hittades inte eller tillhör inte dig" },
        { status: 400 }
      )
    }

    // Delegate to GroupBookingService
    const result = await groupBookingService.matchRequest({
      groupBookingRequestId: id,
      providerId: provider.id,
      providerUserId: session.user.id,
      serviceId: validated.serviceId,
      bookingDate: new Date(validated.bookingDate),
      startTime: validated.startTime,
      serviceDurationMinutes: service.durationMinutes,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: "Matchning misslyckades", details: result.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: `${result.bookingsCreated} bokningar skapade`,
      bookingsCreated: result.bookingsCreated,
      errors: result.errors,
    })
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

    logger.error("Failed to match group booking", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to match group booking" },
      { status: 500 }
    )
  }
}
