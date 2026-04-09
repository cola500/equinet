/**
 * POST /api/native/group-bookings/[id]/match
 * Provider matches group request -- creates sequential bookings.
 *
 * Auth: Bearer > Supabase
 * Feature flag: group_bookings
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"

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
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIP = getClientIP(request)
    try {
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    if (!(await isFeatureEnabled("group_bookings"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    if (!authUser.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan matcha grupprequests" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = matchSchema.parse(body)

    // Verify service belongs to provider
    const service = await prisma.service.findFirst({
      where: {
        id: validated.serviceId,
        providerId: authUser.providerId,
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

    // Delegate to domain service
    const groupBookingService = createGroupBookingService()
    const result = await groupBookingService.matchRequest({
      groupBookingRequestId: id,
      providerId: authUser.providerId,
      providerUserId: authUser.id,
      serviceId: validated.serviceId,
      bookingDate: new Date(validated.bookingDate),
      startTime: validated.startTime,
      serviceDurationMinutes: service.durationMinutes,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    logger.info("Native group booking matched", {
      groupBookingId: id,
      providerId: authUser.providerId,
      bookingsCreated: result.value.bookingsCreated,
    })

    return NextResponse.json({
      message: `${result.value.bookingsCreated} bokningar skapade`,
      bookingsCreated: result.value.bookingsCreated,
      errors: result.value.errors,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to match native group booking", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte matcha gruppbokning" },
      { status: 500 }
    )
  }
}
