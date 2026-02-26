import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { ReviewService } from "@/domain/review/ReviewService"
import { mapReviewErrorToStatus } from "@/domain/review/mapReviewErrorToStatus"
import { ReviewRepository } from "@/infrastructure/persistence/review/ReviewRepository"
import { notificationService } from "@/domain/notification/NotificationService"

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
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate
    const validated = createReviewSchema.parse(body)

    const reviewService = new ReviewService({
      reviewRepository: new ReviewRepository(),
      getBooking: async (id) => {
        const booking = await prisma.booking.findUnique({
          where: { id },
          select: {
            id: true,
            customerId: true,
            providerId: true,
            status: true,
            review: { select: { id: true } },
            customer: { select: { firstName: true, lastName: true } },
            service: { select: { name: true } },
          },
        })
        if (!booking) return null
        return {
          id: booking.id,
          customerId: booking.customerId,
          providerId: booking.providerId,
          status: booking.status,
          hasReview: !!booking.review,
          customer: booking.customer,
          service: booking.service,
        }
      },
      getProviderUserId: async (providerId) => {
        const provider = await prisma.provider.findUnique({
          where: { id: providerId },
          select: { userId: true },
        })
        return provider?.userId ?? null
      },
      notificationService,
    })

    const result = await reviewService.createReview({
      bookingId: validated.bookingId,
      customerId: session.user.id,
      rating: validated.rating,
      comment: validated.comment || null,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapReviewErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value, { status: 201 })
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

    logger.error("Error creating review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte skapa omdöme" },
      { status: 500 }
    )
  }
}
