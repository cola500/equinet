import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { BookingSeriesService, SeriesError } from "@/domain/booking/BookingSeriesService"
import { BookingService } from "@/domain/booking/BookingService"
import { TravelTimeService } from "@/domain/booking/TravelTimeService"
import { z } from "zod"
import type { SessionUser } from "@/types/auth"

const cancelBodySchema = z.object({
  cancellationMessage: z.string().max(500).optional(),
}).strict().optional()

function mapSeriesErrorToStatus(error: SeriesError): number {
  switch (error.type) {
    case 'SERIES_NOT_FOUND': return 404
    case 'NOT_OWNER': return 403
    default: return 500
  }
}

function mapSeriesErrorToMessage(error: SeriesError): string {
  switch (error.type) {
    case 'SERIES_NOT_FOUND': return 'Bokningsserien hittades inte'
    case 'NOT_OWNER': return 'Åtkomst nekad'
    default: return 'Internt serverfel'
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }

  // 2. Feature flag
  if (!(await isFeatureEnabled("recurring_bookings"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  // 3. Rate limit
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.booking(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen senare." },
      { status: 429 }
    )
  }

  const { id } = await params

  // 3. Parse optional body
  let cancellationMessage: string | undefined
  try {
    const text = await request.text()
    if (text) {
      const body = JSON.parse(text)
      const parsed = cancelBodySchema.safeParse(body)
      if (parsed.success && parsed.data) {
        cancellationMessage = parsed.data.cancellationMessage
      }
    }
  } catch {
    // No body or invalid JSON -- OK for cancel
  }

  // 4. Build service
  const bookingRepository = new PrismaBookingRepository()
  const bookingService = new BookingService({
    bookingRepository,
    getService: async (sid) => prisma.service.findUnique({
      where: { id: sid },
      select: { id: true, providerId: true, durationMinutes: true, isActive: true },
    }),
    getProvider: async (pid) => prisma.provider.findUnique({
      where: { id: pid },
      select: { id: true, userId: true, isActive: true, acceptingNewCustomers: true, latitude: true, longitude: true },
    }),
    getAvailabilityException: async (providerId, date) => prisma.availabilityException.findUnique({
      where: { providerId_date: { providerId, date } },
      select: { isClosed: true, reason: true, startTime: true, endTime: true },
    }),
    travelTimeService: new TravelTimeService(),
  })

  const seriesService = new BookingSeriesService({
    bookingRepository,
    prisma: {
      bookingSeries: prisma.bookingSeries,
      booking: prisma.booking,
    },
    isFeatureEnabled,
    getProvider: async (pid) => prisma.provider.findUnique({
      where: { id: pid },
      select: { id: true, userId: true, isActive: true, recurringEnabled: true, maxSeriesOccurrences: true },
    }),
    getService: async (sid) => prisma.service.findUnique({
      where: { id: sid },
      select: { id: true, providerId: true, durationMinutes: true, isActive: true },
    }),
    bookingService,
  })

  // 5. Call cancel
  try {
    const user = session.user as SessionUser
    const result = await seriesService.cancelSeries({
      seriesId: id,
      actorCustomerId: user.userType === 'customer' ? user.id : undefined,
      actorProviderId: user.providerId || undefined,
      cancellationMessage,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: mapSeriesErrorToMessage(result.error) },
        { status: mapSeriesErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (error) {
    logger.error("Error cancelling booking series", { error, seriesId: id })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
