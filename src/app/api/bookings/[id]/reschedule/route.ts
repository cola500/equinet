import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { isFeatureEnabled } from "@/lib/feature-flags"
import {
  createBookingService,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from "@/domain/booking"
import { prisma } from "@/lib/prisma"
import { sendBookingRescheduleNotification } from "@/lib/email"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

const rescheduleSchema = z.object({
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datumformat (YYYY-MM-DD)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Ogiltigt tidsformat (HH:MM)"),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth
    const session = await auth()

    if (session.user.userType !== "customer") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    // 2. Feature flag check
    const enabled = await isFeatureEnabled("self_reschedule")
    if (!enabled) {
      return NextResponse.json(
        { error: "Ombokning är inte aktiverad" },
        { status: 403 }
      )
    }

    // 3. Rate limiting
    const rateLimitKey = `booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      logger.error("Rate limiter error", rateLimitError instanceof Error ? rateLimitError : new Error(String(rateLimitError)))
    }

    // 4. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    // 5. Validate
    const validated = rescheduleSchema.parse(body)

    // 6. Get booking ID from params
    const { id: bookingId } = await params

    // 7. Save old booking times for notification
    const oldBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        bookingDate: true,
        startTime: true,
        provider: {
          select: { rescheduleRequiresApproval: true },
        },
      },
    })

    // 8. Delegate to BookingService
    const bookingService = createBookingService()

    const result = await bookingService.rescheduleBooking({
      bookingId,
      customerId: session.user.id,
      newBookingDate: validated.bookingDate,
      newStartTime: validated.startTime,
    })

    if (result.isFailure) {
      const status = mapBookingErrorToStatus(result.error)
      const message = mapBookingErrorToMessage(result.error)
      return NextResponse.json({ error: message }, { status })
    }

    // 9. Send notification (fire-and-forget)
    if (oldBooking) {
      const oldDateFormatted = format(new Date(oldBooking.bookingDate), "d MMMM yyyy", { locale: sv })
      sendBookingRescheduleNotification(
        bookingId,
        oldDateFormatted,
        oldBooking.startTime,
        oldBooking.provider.rescheduleRequiresApproval
      ).catch((err) => {
        logger.error("Failed to send reschedule notification", err instanceof Error ? err : new Error(String(err)))
      })
    }

    return NextResponse.json(result.value)
  } catch (err: unknown) {
    const error = err as Error

    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Unexpected error during reschedule", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
