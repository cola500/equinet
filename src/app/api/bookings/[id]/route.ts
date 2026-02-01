import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { sendBookingStatusChangeNotification } from "@/lib/email"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { notificationService, NotificationType } from "@/domain/notification/NotificationService"
import { formatNotifDate, customerName } from "@/lib/notification-helpers"
import {
  createBookingService,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from "@/domain/booking"

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
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
        { error: "Invalid request body", details: "Request body must be valid JSON" },
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

    // Delegate to BookingService for status transition validation
    const bookingService = createBookingService()
    const result = await bookingService.updateStatus({
      bookingId: id,
      newStatus: validatedData.status,
      providerId,
      customerId,
    })

    if (result.isFailure) {
      const status = mapBookingErrorToStatus(result.error)
      const message = mapBookingErrorToMessage(result.error)
      return NextResponse.json({ error: message }, { status })
    }

    const updatedBooking = result.value

    // --- Side effects: notifications (stay in route, not in domain service) ---

    // Send status change notification email (async, don't block response)
    if (["confirmed", "cancelled", "completed"].includes(validatedData.status)) {
      sendBookingStatusChangeNotification(id, validatedData.status).catch((err) => {
        logger.error("Failed to send status change notification", err instanceof Error ? err : new Error(String(err)))
      })
    }

    // Create in-app notification for the other party
    const statusLabels: Record<string, string> = {
      confirmed: "bekräftad",
      cancelled: "avbokad",
      completed: "markerad som genomförd",
    }
    const notifTypeMap: Record<string, string> = {
      confirmed: NotificationType.BOOKING_CONFIRMED,
      cancelled: NotificationType.BOOKING_CANCELLED,
      completed: NotificationType.BOOKING_COMPLETED,
    }
    const notifType = notifTypeMap[validatedData.status]
    if (notifType) {
      const sName = updatedBooking.service?.name || "Bokning"
      const dateStr = formatNotifDate(updatedBooking.bookingDate)
      const timeStr = updatedBooking.startTime ? ` kl ${updatedBooking.startTime}` : ""
      const statusLabel = statusLabels[validatedData.status] || validatedData.status

      if (session.user.userType === "provider" && updatedBooking.customerId) {
        const providerName = updatedBooking.provider?.businessName || "Leverantör"
        notificationService.createAsync({
          userId: updatedBooking.customerId,
          type: notifType as any,
          message: `${sName} hos ${providerName} den ${dateStr}${timeStr} har blivit ${statusLabel}`,
          linkUrl: "/customer/bookings",
          metadata: { bookingId: id },
        })
      } else if (session.user.userType === "customer") {
        const providerUser = await prisma.provider.findUnique({
          where: { id: updatedBooking.providerId },
          select: { userId: true },
        })
        if (providerUser) {
          const cName = updatedBooking.customer
            ? customerName(updatedBooking.customer.firstName, updatedBooking.customer.lastName)
            : "Kund"
          notificationService.createAsync({
            userId: providerUser.userId,
            type: notifType as any,
            message: `${cName} har ${statusLabel === "avbokad" ? "avbokat" : statusLabel} ${sName} den ${dateStr}`,
            linkUrl: "/provider/bookings",
            metadata: { bookingId: id },
          })
        }
      }
    }

    return NextResponse.json(updatedBooking)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error updating booking", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to update booking" },
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
        { error: "Booking not found or you don't have permission to delete it" },
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
      { error: "Failed to delete booking" },
      { status: 500 }
    )
  }
}
