import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { sendBookingConfirmationNotification, sendBookingStatusChangeNotification, sendPaymentConfirmationNotification } from "@/lib/email"
import { z } from "zod"
import {
  createBookingService,
  createBookingEventDispatcher,
  createBookingCreatedEvent,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from "@/domain/booking"
import { notificationService } from "@/domain/notification/NotificationService"
import { customerName } from "@/lib/notification-helpers"

// Zod schema for manual booking input
const manualBookingSchema = z.object({
  serviceId: z.string().uuid(),
  bookingDate: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  // Customer: either ID or manual fields
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(2).max(100).trim().optional(),
  customerPhone: z.string().max(20).trim()
    .regex(/^(\+46|0)\d[\d\s-]{5,15}$/, 'Ogiltigt telefonnummerformat')
    .optional(),
  customerEmail: z.string().email().toLowerCase().trim().optional(),
  // Horse
  horseId: z.string().uuid().optional(),
  horseName: z.string().max(100).optional(),
  horseInfo: z.string().max(500).optional(),
  customerNotes: z.string().max(500).optional(),
}).refine(
  data => data.customerId || data.customerName,
  { message: 'Ange antingen kund-ID eller kundnamn' }
)

// POST - Create manual booking (provider-only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Provider-only endpoint
    if (session.user.userType !== 'provider') {
      return NextResponse.json(
        { error: "Bara leverantörer kan skapa manuella bokningar" },
        { status: 403 }
      )
    }

    // Rate limiting
    const rateLimitKey = `manual-booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        logger.security("Rate limit exceeded for manual booking", "medium", {
          userId: session.user.id,
          endpoint: "/api/bookings/manual",
        })
        return NextResponse.json(
          { error: "För många bokningar. Försök igen senare." },
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
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    // Validate input
    const validated = manualBookingSchema.parse(body)

    // Get provider ID from session (IDOR protection)
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Create BookingService with ghost user support
    const bookingService = createBookingService()

    // Delegate to BookingService.createManualBooking()
    const result = await bookingService.createManualBooking({
      providerId: provider.id,
      serviceId: validated.serviceId,
      bookingDate: new Date(validated.bookingDate),
      startTime: validated.startTime,
      endTime: validated.endTime,
      customerId: validated.customerId,
      customerName: validated.customerName,
      customerPhone: validated.customerPhone,
      customerEmail: validated.customerEmail,
      horseId: validated.horseId,
      horseName: validated.horseName,
      horseInfo: validated.horseInfo,
      customerNotes: validated.customerNotes,
    })

    if (result.isFailure) {
      const status = mapBookingErrorToStatus(result.error)
      const message = mapBookingErrorToMessage(result.error)
      return NextResponse.json({ error: message }, { status })
    }

    // Audit trail
    logger.security("Manual booking created", "low", {
      bookingId: result.value.id,
      providerId: provider.id,
      providerUserId: session.user.id,
      customerId: result.value.customerId,
      isGhostUser: !validated.customerId,
    })

    // Dispatch domain event
    const b = result.value
    const providerUser = await prisma.provider.findUnique({
      where: { id: provider.id },
      select: { userId: true },
    })

    if (providerUser) {
      const dispatcher = createBookingEventDispatcher({
        emailService: {
          sendBookingConfirmation: sendBookingConfirmationNotification,
          sendBookingStatusChange: sendBookingStatusChangeNotification,
          sendPaymentConfirmation: sendPaymentConfirmationNotification,
        },
        notificationService,
        logger,
      })

      await dispatcher.dispatch(createBookingCreatedEvent({
        bookingId: b.id,
        customerId: b.customerId,
        providerId: provider.id,
        providerUserId: providerUser.userId,
        customerName: b.customer ? customerName(b.customer.firstName, b.customer.lastName) : validated.customerName || "Kund",
        serviceName: b.service?.name || "Tjänst",
        bookingDate: b.bookingDate instanceof Date ? b.bookingDate.toISOString() : String(b.bookingDate),
        startTime: b.startTime,
        horseName: b.horseName,
      }))
    }

    return NextResponse.json(result.value, { status: 201 })
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

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Bokningen finns redan" }, { status: 409 })
      }
      return NextResponse.json({ error: "Databasfel uppstod" }, { status: 500 })
    }

    logger.error("Unexpected error during manual booking", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Kunde inte skapa bokning" }, { status: 500 })
  }
}
