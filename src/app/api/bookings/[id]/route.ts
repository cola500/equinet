import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { sendBookingStatusChangeNotification } from "@/lib/email"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"

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
      console.error("Invalid JSON in request body:", jsonError)
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
        console.error("Failed to send status change notification:", err)
      })
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

    console.error("Error updating booking:", error)
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

    console.error("Error deleting booking:", error)
    return NextResponse.json(
      { error: "Failed to delete booking" },
      { status: 500 }
    )
  }
}
