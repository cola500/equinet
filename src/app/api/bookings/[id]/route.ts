import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { sendBookingStatusChangeNotification } from "@/lib/email"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { notificationService, NotificationType } from "@/domain/notification/NotificationService"

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
}).strict()

// PUT - Update booking status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Auth handled by middleware
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

    // Use repositories instead of direct Prisma access
    const bookingRepo = new PrismaBookingRepository()
    const providerRepo = new ProviderRepository()

    // Build authorization context based on user type
    let authContext: { providerId?: string; customerId?: string }

    if (session.user.userType === "provider") {
      const provider = await providerRepo.findByUserId(session.user.id)

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      // Provider can only update their own bookings
      authContext = { providerId: provider.id }
    } else {
      // Customer can only update their own bookings
      authContext = { customerId: session.user.id }
    }

    // Update with authorization check (atomic WHERE clause in repository)
    const updatedBooking = await bookingRepo.updateStatusWithAuth(
      id,
      validatedData.status,
      authContext
    )

    if (!updatedBooking) {
      return NextResponse.json(
        { error: "Booking not found or you don't have permission to update it" },
        { status: 404 }
      )
    }

    // Send status change notification email (async, don't block response)
    // Only send for meaningful status changes (not when customer updates their own booking)
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
      // Determine the recipient: notify the "other party"
      if (session.user.userType === "provider" && updatedBooking.customerId) {
        // Provider changed status -> notify customer
        notificationService.createAsync({
          userId: updatedBooking.customerId,
          type: notifType as any,
          message: `Din bokning har blivit ${statusLabels[validatedData.status] || validatedData.status}`,
          linkUrl: "/customer/bookings",
          metadata: { bookingId: id },
        })
      } else if (session.user.userType === "customer") {
        // Customer changed status (e.g. cancelled) -> notify provider
        const providerUser = await prisma.provider.findUnique({
          where: { id: updatedBooking.providerId },
          select: { userId: true },
        })
        if (providerUser) {
          notificationService.createAsync({
            userId: providerUser.userId,
            type: notifType as any,
            message: `En bokning har blivit ${statusLabels[validatedData.status] || validatedData.status}`,
            linkUrl: "/provider/bookings",
            metadata: { bookingId: id },
          })
        }
      }
    }

    return NextResponse.json(updatedBooking)
  } catch (error) {
    // If error is a Response (from auth()), return it
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
    // Auth handled by middleware
    const session = await auth()

    // Use repositories instead of direct Prisma access
    const bookingRepo = new PrismaBookingRepository()
    const providerRepo = new ProviderRepository()

    // Build authorization context based on user type
    let authContext: { providerId?: string; customerId?: string }

    if (session.user.userType === "provider") {
      const provider = await providerRepo.findByUserId(session.user.id)

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      // Provider can only delete their own bookings
      authContext = { providerId: provider.id }
    } else {
      // Customer can only delete their own bookings
      authContext = { customerId: session.user.id }
    }

    // Delete with authorization check (atomic WHERE clause in repository)
    const deleted = await bookingRepo.deleteWithAuth(id, authContext)

    if (!deleted) {
      return NextResponse.json(
        { error: "Booking not found or you don't have permission to delete it" },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: "Booking deleted" })
  } catch (error) {
    // If error is a Response (from auth()), return it
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
