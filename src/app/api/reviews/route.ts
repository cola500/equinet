import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"

const createReviewSchema = z.object({
  bookingId: z.string().min(1, "Booking ID krävs"),
  rating: z.number().int().min(1, "Betyg måste vara minst 1").max(5, "Betyg måste vara max 5"),
  comment: z.string().max(500, "Kommentar kan vara max 500 tecken").optional(),
}).strict()

// POST - Create a review for a completed booking
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Validate
    const validated = createReviewSchema.parse(body)

    // Find booking with review status (atomic ownership check)
    const booking = await prisma.booking.findUnique({
      where: { id: validated.bookingId },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        status: true,
        review: { select: { id: true } },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Authorization: customer must own the booking
    if (booking.customerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Business rule: booking must be completed
    if (booking.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed bookings can be reviewed" },
        { status: 400 }
      )
    }

    // Business rule: one review per booking
    if (booking.review) {
      return NextResponse.json(
        { error: "Review already exists for this booking" },
        { status: 409 }
      )
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        rating: validated.rating,
        comment: validated.comment || null,
        bookingId: booking.id,
        customerId: session.user.id,
        providerId: booking.providerId,
      },
    })

    return NextResponse.json(review, { status: 201 })
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

    logger.error("Error creating review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    )
  }
}
