import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { CustomerReviewService, type CustomerReviewError } from "@/domain/customer-review/CustomerReviewService"
import { mapCustomerReviewErrorToStatus } from "@/domain/customer-review/mapCustomerReviewErrorToStatus"
import { CustomerReviewRepository } from "@/infrastructure/persistence/customer-review/CustomerReviewRepository"

const createCustomerReviewSchema = z.object({
  bookingId: z.string().min(1, "Booking ID krävs"),
  rating: z.number().int().min(1, "Betyg måste vara minst 1").max(5, "Betyg måste vara max 5"),
  comment: z.string().max(500, "Kommentar kan vara max 500 tecken").optional(),
}).strict()

// POST - Create a customer review (provider only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const providerId = session.user.providerId

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate
    const validated = createCustomerReviewSchema.parse(body)

    const reviewService = new CustomerReviewService({
      customerReviewRepository: new CustomerReviewRepository(),
      getBooking: async (id) => {
        const booking = await prisma.booking.findUnique({
          where: { id },
          select: {
            id: true,
            customerId: true,
            providerId: true,
            status: true,
            customerReview: { select: { id: true } },
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
          hasCustomerReview: !!booking.customerReview,
          customer: booking.customer,
          service: booking.service,
        }
      },
    })

    const result = await reviewService.createReview({
      bookingId: validated.bookingId,
      providerId,
      rating: validated.rating,
      comment: validated.comment || null,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapCustomerReviewErrorToStatus(result.error) }
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

    logger.error("Error creating customer review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte skapa kundrecension" },
      { status: 500 }
    )
  }
}

// GET - List provider's customer reviews (provider only)
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const repository = new CustomerReviewRepository()
    const reviews = await repository.findByProviderId(session.user.providerId)

    return NextResponse.json(reviews)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching customer reviews", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta kundrecensioner" },
      { status: 500 }
    )
  }
}
