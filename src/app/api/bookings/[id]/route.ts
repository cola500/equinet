import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { sendBookingConfirmationNotification, sendBookingStatusChangeNotification, sendPaymentConfirmationNotification } from "@/lib/email"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/domain/notification/NotificationService"
import { customerName } from "@/lib/notification-helpers"
import { sanitizeString } from "@/lib/sanitize"
import {
  createBookingService,
  createBookingEventDispatcher,
  createBookingStatusChangedEvent,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from "@/domain/booking"

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
  cancellationMessage: z.string().max(500, "Meddelandet får vara max 500 tecken").optional(),
}).strict()

// PUT - Update booking status (delegated to BookingService)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      logger.warn("Invalid JSON in request body", { error: String(jsonError) })
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    const validatedData = updateBookingSchema.parse(body)

    // Build auth context for the service
    const providerRepo = new ProviderRepository()
    let providerId: string | undefined
    let customerId: string | undefined

    if (session.user.userType === "provider") {
      const provider = await providerRepo.findByUserId(session.user.id)

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      providerId = provider.id
    } else {
      customerId = session.user.id
    }

    // Only include cancellationMessage when actually cancelling
    const cancellationMessage = validatedData.status === "cancelled" && validatedData.cancellationMessage
      ? sanitizeString(validatedData.cancellationMessage)
      : undefined

    // Delegate to BookingService for status transition validation
    const bookingService = createBookingService()
    const result = await bookingService.updateStatus({
      bookingId: id,
      newStatus: validatedData.status,
      providerId,
      customerId,
      cancellationMessage,
    })

    if (result.isFailure) {
      const status = mapBookingErrorToStatus(result.error)
      const message = mapBookingErrorToMessage(result.error)
      return NextResponse.json({ error: message }, { status })
    }

    const updatedBooking = result.value

    // --- Side effects via domain events ---
    const providerUser = await prisma.provider.findUnique({
      where: { id: updatedBooking.providerId },
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

      const cName = updatedBooking.customer
        ? customerName(updatedBooking.customer.firstName, updatedBooking.customer.lastName)
        : "Kund"

      await dispatcher.dispatch(createBookingStatusChangedEvent({
        bookingId: id,
        customerId: updatedBooking.customerId,
        providerId: updatedBooking.providerId,
        providerUserId: providerUser.userId,
        customerName: cName,
        providerName: updatedBooking.provider?.businessName || "Leverantör",
        serviceName: updatedBooking.service?.name || "Bokning",
        bookingDate: updatedBooking.bookingDate instanceof Date
          ? updatedBooking.bookingDate.toISOString()
          : String(updatedBooking.bookingDate),
        startTime: updatedBooking.startTime,
        oldStatus: updatedBooking.status, // Note: already updated by service
        newStatus: validatedData.status,
        changedByUserType: session.user.userType as 'provider' | 'customer',
        cancellationMessage,
      }))
    }

    return NextResponse.json(updatedBooking)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error updating booking", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera bokning" },
      { status: 500 }
    )
  }
}

// DELETE - Cancel/Delete booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    const bookingRepo = new PrismaBookingRepository()
    const providerRepo = new ProviderRepository()

    let authContext: { providerId?: string; customerId?: string }

    if (session.user.userType === "provider") {
      const provider = await providerRepo.findByUserId(session.user.id)

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      authContext = { providerId: provider.id }
    } else {
      authContext = { customerId: session.user.id }
    }

    const deleted = await bookingRepo.deleteWithAuth(id, authContext)

    if (!deleted) {
      return NextResponse.json(
        { error: "Bokningen hittades inte eller så saknar du behörighet att ta bort den" },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: "Booking deleted" })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error deleting booking", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte ta bort bokning" },
      { status: 500 }
    )
  }
}
