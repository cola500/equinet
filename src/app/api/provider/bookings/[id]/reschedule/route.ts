import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireProvider } from "@/lib/roles"
import { z } from "zod"
import { rateLimiters } from "@/lib/rate-limit"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sendBookingRescheduleNotification } from "@/lib/email"
import { TimeSlot } from "@/domain/shared/TimeSlot"
import { dateSchema, timeSchema } from "@/lib/zod-schemas"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

const rescheduleSchema = z.object({
  bookingDate: dateSchema,
  startTime: timeSchema,
}).strict()

/**
 * PATCH /api/provider/bookings/[id]/reschedule
 *
 * Provider reschedules a booking to a new date/time.
 * No window or max-reschedule restrictions (provider-side action).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Auth
    const { userId } = requireProvider(await auth())

    // 2. Get provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(userId)
    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // 3. Rate limiting
    const rateLimitKey = `booking:${userId}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
      }
    } catch (rateLimitError) {
      logger.error(
        "Rate limiter error",
        rateLimitError instanceof Error ? rateLimitError : new Error(String(rateLimitError))
      )
      return NextResponse.json(
        { error: "Tjänsten är tillfälligt otillgänglig" },
        { status: 503 }
      )
    }

    // 4. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 5. Validate
    const validated = rescheduleSchema.parse(body)

    // 6. Fetch booking with IDOR check (atomic WHERE: id + providerId)
    const booking = await prisma.booking.findFirst({
      where: { id, providerId: provider.id },
      select: {
        id: true,
        status: true,
        serviceId: true,
        bookingDate: true,
        startTime: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Bokning hittades inte" }, { status: 404 })
    }

    // 7. Check reschedulable status
    if (!["pending", "confirmed"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Bara väntande och bekräftade bokningar kan ombokas" },
        { status: 400 }
      )
    }

    // 8. Get service duration
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { durationMinutes: true },
    })

    if (!service) {
      return NextResponse.json({ error: "Tjänsten hittades inte" }, { status: 404 })
    }

    // 9. Calculate end time
    const timeSlotResult = TimeSlot.fromDuration(validated.startTime, service.durationMinutes)
    if (timeSlotResult.isFailure) {
      return NextResponse.json(
        { error: `Ogiltig tid: ${timeSlotResult.error}` },
        { status: 400 }
      )
    }
    const endTime = timeSlotResult.value.endTime

    // 10. Reschedule with atomic overlap check
    const bookingRepo = new PrismaBookingRepository()
    const updated = await bookingRepo.providerRescheduleWithOverlapCheck(
      id,
      provider.id,
      {
        bookingDate: new Date(validated.bookingDate),
        startTime: validated.startTime,
        endTime,
      }
    )

    if (!updated) {
      return NextResponse.json(
        { error: "Den nya tiden krockar med en annan bokning" },
        { status: 409 }
      )
    }

    // 11. Notify customer (fire-and-forget)
    const oldDateFormatted = format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv })
    sendBookingRescheduleNotification(
      id,
      oldDateFormatted,
      booking.startTime,
      false
    ).catch((err) => {
      logger.error(
        "Failed to send provider reschedule notification",
        err instanceof Error ? err : new Error(String(err))
      )
    })

    logger.info("Provider rescheduled booking", {
      providerId: provider.id,
      bookingId: id,
      newDate: validated.bookingDate,
      newStartTime: validated.startTime,
    })

    return NextResponse.json({
      id: updated.id,
      bookingDate: updated.bookingDate,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Response) return error

    logger.error(
      "Error during provider reschedule",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
