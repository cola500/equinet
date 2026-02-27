import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { BookingSeriesService, SeriesError } from "@/domain/booking/BookingSeriesService"
import { BookingService } from "@/domain/booking/BookingService"
import { TravelTimeService } from "@/domain/booking/TravelTimeService"
import type { SessionUser } from "@/types/auth"

const createSeriesSchema = z.object({
  providerId: z.string().uuid("Ogiltigt provider-ID"),
  serviceId: z.string().uuid("Ogiltigt tjänst-ID"),
  firstBookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datumformat (YYYY-MM-DD)"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ogiltigt tidsformat (HH:MM)"),
  intervalWeeks: z.number().int().min(1, "Intervall måste vara minst 1 vecka").max(52, "Intervall får inte överstiga 52 veckor"),
  totalOccurrences: z.number().int().min(2, "Minst 2 tillfällen").max(52, "Max 52 tillfällen"),
  horseId: z.string().uuid("Ogiltigt häst-ID").optional(),
  horseName: z.string().max(100, "Hästnamn max 100 tecken").optional(),
  horseInfo: z.string().max(500, "Hästinfo max 500 tecken").optional(),
  customerNotes: z.string().max(1000, "Anteckningar max 1000 tecken").optional(),
}).strict()

function mapSeriesErrorToStatus(error: SeriesError): number {
  switch (error.type) {
    case 'RECURRING_FEATURE_OFF':
    case 'RECURRING_DISABLED':
    case 'NOT_OWNER':
      return 403
    case 'INVALID_INTERVAL':
    case 'INVALID_OCCURRENCES':
    case 'NO_BOOKINGS_CREATED':
      return 400
    case 'SERIES_NOT_FOUND':
      return 404
    default:
      return 500
  }
}

function mapSeriesErrorToMessage(error: SeriesError): string {
  switch (error.type) {
    case 'RECURRING_FEATURE_OFF':
      return 'Återkommande bokningar är inte aktiverat'
    case 'RECURRING_DISABLED':
      return 'Leverantören har inte aktiverat återkommande bokningar'
    case 'INVALID_INTERVAL':
      return error.message
    case 'INVALID_OCCURRENCES':
      return error.message
    case 'NO_BOOKINGS_CREATED':
      return error.message
    case 'SERIES_NOT_FOUND':
      return 'Bokningsserien hittades inte'
    case 'NOT_OWNER':
      return 'Åtkomst nekad'
    default:
      return 'Internt serverfel'
  }
}

export async function POST(request: NextRequest) {
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

  // 3. Parse JSON
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
  }

  // 4. Zod validation
  const parsed = createSeriesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valideringsfel", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // 5. Determine if manual booking (provider creating)
  const user = session.user as SessionUser
  const isManualBooking = !!(user.providerId && user.providerId === data.providerId)
  const customerId = isManualBooking ? undefined : user.id
  const createdByProviderId = isManualBooking ? data.providerId : undefined

  // 6. Create service with deps
  const bookingRepository = new PrismaBookingRepository()
  const bookingService = new BookingService({
    bookingRepository,
    getService: async (id) => prisma.service.findUnique({
      where: { id },
      select: { id: true, providerId: true, durationMinutes: true, isActive: true },
    }),
    getProvider: async (id) => prisma.provider.findUnique({
      where: { id },
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
    getProvider: async (id) => prisma.provider.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        isActive: true,
        recurringEnabled: true,
        maxSeriesOccurrences: true,
      },
    }),
    getService: async (id) => prisma.service.findUnique({
      where: { id },
      select: { id: true, providerId: true, durationMinutes: true, isActive: true },
    }),
    bookingService,
  })

  // 7. Call service
  try {
    const result = await seriesService.createSeries({
      customerId: customerId || user.id,
      providerId: data.providerId,
      serviceId: data.serviceId,
      firstBookingDate: new Date(data.firstBookingDate),
      startTime: data.startTime,
      intervalWeeks: data.intervalWeeks,
      totalOccurrences: data.totalOccurrences,
      horseId: data.horseId,
      horseName: data.horseName,
      horseInfo: data.horseInfo,
      customerNotes: data.customerNotes,
      isManualBooking,
      createdByProviderId,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: mapSeriesErrorToMessage(result.error) },
        { status: mapSeriesErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value, { status: 201 })
  } catch (error) {
    logger.error("Error creating booking series", { error })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
