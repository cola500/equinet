import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { sendBookingConfirmationNotification } from "@/lib/email"
import { z } from "zod"
import {
  BookingService,
  TravelTimeService,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from "@/domain/booking"

// Input schema - endTime is optional (will be calculated from service duration if missing)
const bookingInputSchema = z.object({
  providerId: z.string().uuid("Ogiltigt provider-ID format"),
  serviceId: z.string().uuid("Ogiltigt tjänst-ID format"),
  bookingDate: z.string().refine(
    (dateStr) => {
      // Accept both YYYY-MM-DD and full ISO datetime
      return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ||
             /^\d{4}-\d{2}-\d{2}T/.test(dateStr)
    },
    { message: "Ogiltigt datumformat. Måste vara YYYY-MM-DD eller ISO datetime" }
  ).refine(
    (dateStr) => {
      const bookingDate = new Date(dateStr)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return bookingDate >= today
    },
    { message: "Kan inte boka i det förflutna" }
  ),
  startTime: z.string().regex(
    /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/,
    "Ogiltigt tidsformat. Måste vara HH:MM (00:00-23:59)"
  ).transform(t => t.substring(0, 5)), // Normalize to HH:MM
  endTime: z.string().regex(
    /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/,
    "Ogiltigt tidsformat. Måste vara HH:MM (00:00-23:59)"
  ).transform(t => t.substring(0, 5)).optional(),
  horseId: z.string().uuid("Ogiltigt häst-ID format").optional(),
  horseName: z.string().max(100, "Hästnamn för långt (max 100 tecken)").optional(),
  horseInfo: z.string().max(500, "Hästinfo för lång (max 500 tecken)").optional(),
  customerNotes: z.string().max(1000, "Anteckningar för långa (max 1000 tecken)").optional(),
  routeOrderId: z.string().uuid("Ogiltigt ruttorder-ID format").optional(),
}).strict()

// GET bookings for logged-in user
export async function GET(request: NextRequest) {
  // Rate limiting: 100 requests per minute per IP
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()

    const bookingRepo = new PrismaBookingRepository()
    let bookings

    if (session.user.userType === "provider") {
      const providerRepo = new ProviderRepository()
      const provider = await providerRepo.findByUserId(session.user.id)

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      bookings = await bookingRepo.findByProviderIdWithDetails(provider.id)
    } else {
      bookings = await bookingRepo.findByCustomerIdWithDetails(session.user.id)
    }

    return NextResponse.json(bookings)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch bookings", error as Error, {})
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}

// POST - Create new booking (delegated to BookingService)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Rate limiting
    const rateLimitKey = `booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        logger.security("Rate limit exceeded for booking creation", "medium", {
          userId: session.user.id,
          endpoint: "/api/bookings",
        })
        return NextResponse.json(
          {
            error: "För många bokningar",
            details: "Du kan göra max 10 bokningar per timme. Försök igen senare.",
          },
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
        { error: "Invalid request body", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Validate input
    const validatedInput = bookingInputSchema.parse(body)

    // Create BookingService with dependencies
    const bookingService = new BookingService({
      bookingRepository: new PrismaBookingRepository(),
      getService: async (id) => {
        const service = await prisma.service.findUnique({
          where: { id },
          select: {
            id: true,
            providerId: true,
            durationMinutes: true,
            isActive: true,
          },
        })
        return service
      },
      getProvider: async (id) => {
        const provider = await prisma.provider.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            isActive: true,
            latitude: true,
            longitude: true,
          },
        })
        return provider
      },
      getRouteOrder: async (id) => {
        const routeOrder = await prisma.routeOrder.findUnique({
          where: { id },
          select: {
            dateFrom: true,
            dateTo: true,
            status: true,
            providerId: true,
          },
        })
        if (!routeOrder || !routeOrder.providerId) {
          return null
        }
        return {
          dateFrom: routeOrder.dateFrom,
          dateTo: routeOrder.dateTo,
          status: routeOrder.status,
          providerId: routeOrder.providerId,
        }
      },
      getCustomerLocation: async (customerId) => {
        const user = await prisma.user.findUnique({
          where: { id: customerId },
          select: {
            latitude: true,
            longitude: true,
            address: true,
          },
        })
        return user
      },
      travelTimeService: new TravelTimeService(),
    })

    // Delegate to BookingService
    const result = await bookingService.createBooking({
      customerId: session.user.id,
      providerId: validatedInput.providerId,
      serviceId: validatedInput.serviceId,
      bookingDate: new Date(validatedInput.bookingDate),
      startTime: validatedInput.startTime,
      endTime: validatedInput.endTime,
      routeOrderId: validatedInput.routeOrderId,
      horseId: validatedInput.horseId,
      horseName: validatedInput.horseName,
      horseInfo: validatedInput.horseInfo,
      customerNotes: validatedInput.customerNotes,
    })

    if (result.isFailure) {
      const status = mapBookingErrorToStatus(result.error)
      const message = mapBookingErrorToMessage(result.error)

      if (result.error.type === 'OVERLAP') {
        return NextResponse.json(
          { error: message, details: "Vänligen välj en annan tid eller datum" },
          { status }
        )
      }

      if (result.error.type === 'INSUFFICIENT_TRAVEL_TIME') {
        return NextResponse.json(
          {
            error: message,
            details: `Krävs ${result.error.requiredMinutes} minuter mellan bokningar, endast ${result.error.actualMinutes} minuter tillgängligt. Vänligen välj en tid med mer marginal.`,
            requiredMinutes: result.error.requiredMinutes,
            actualMinutes: result.error.actualMinutes,
          },
          { status }
        )
      }

      return NextResponse.json({ error: message }, { status })
    }

    // Log success
    try {
      logger.info("Booking created successfully", {
        bookingId: result.value.id,
        customerId: session.user.id,
        providerId: validatedInput.providerId,
      })
    } catch (logError) {
      // Logger itself failed - use console as last resort
      console.error("Logger failed:", logError)
    }

    // Send confirmation email (async, don't block)
    sendBookingConfirmationNotification(result.value.id).catch((err) => {
      logger.error("Failed to send booking confirmation email", err instanceof Error ? err : new Error(String(err)))
    })

    return NextResponse.json(result.value, { status: 201 })
  } catch (err: unknown) {
    const error = err as Error

    if (error instanceof Response) {
      return error
    }

    // Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    // Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Bokningen finns redan" }, { status: 409 })
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Ogiltig referens - kontrollera att tjänst och leverantör finns" },
          { status: 400 }
        )
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Tjänst eller leverantör hittades inte" },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: "Databasfel uppstod" }, { status: 500 })
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ error: "Databasen är inte tillgänglig" }, { status: 503 })
    }

    logger.error("Unexpected error during booking", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
  }
}
