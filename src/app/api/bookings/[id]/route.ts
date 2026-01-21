import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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

    // Build authorization filter based on user type
    let whereClause: { id: string; customerId?: string; providerId?: string } = { id }

    if (session.user.userType === "provider") {
      const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
      })

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      // Provider can only update their own bookings
      whereClause.providerId = provider.id
    } else {
      // Customer can only update their own bookings
      whereClause.customerId = session.user.id
    }

    // Update with authorization check in WHERE clause (prevents IDOR + race conditions)
    const updatedBooking = await prisma.booking.update({
      where: whereClause,
      data: { status: validatedData.status },
      include: {
        service: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

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

    // Handle Prisma P2025: Record not found (booking doesn't exist or user doesn't own it)
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: "Booking not found or you don't have permission to update it" },
        { status: 404 }
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

    // Build authorization filter based on user type
    let whereClause: { id: string; customerId?: string; providerId?: string } = { id }

    if (session.user.userType === "provider") {
      const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
      })

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      // Provider can only delete their own bookings
      whereClause.providerId = provider.id
    } else {
      // Customer can only delete their own bookings
      whereClause.customerId = session.user.id
    }

    // Delete with authorization check in WHERE clause (prevents IDOR + race conditions)
    await prisma.booking.delete({
      where: whereClause,
    })

    return NextResponse.json({ message: "Booking deleted" })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    // Handle Prisma P2025: Record not found (booking doesn't exist or user doesn't own it)
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: "Booking not found or you don't have permission to delete it" },
        { status: 404 }
      )
    }

    console.error("Error deleting booking:", error)
    return NextResponse.json(
      { error: "Failed to delete booking" },
      { status: 500 }
    )
  }
}
