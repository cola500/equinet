import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { CustomerReviewService } from "@/domain/customer-review/CustomerReviewService"
import { mapCustomerReviewErrorToStatus } from "@/domain/customer-review/mapCustomerReviewErrorToStatus"
import { CustomerReviewRepository } from "@/infrastructure/persistence/customer-review/CustomerReviewRepository"

const createCustomerReviewSchema = z.object({
  bookingId: z.string().min(1, "Booking ID krävs"),
  rating: z.number().int().min(1, "Betyg måste vara minst 1").max(5, "Betyg måste vara max 5"),
  comment: z.string().max(500, "Kommentar kan vara max 500 tecken").optional(),
}).strict()

// POST - Create a customer review (provider only)
export const POST = withApiHandler(
  { auth: "provider", schema: createCustomerReviewSchema },
  async ({ user, body }) => {
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
      bookingId: body.bookingId,
      providerId: user.providerId,
      rating: body.rating,
      comment: body.comment || null,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapCustomerReviewErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value, { status: 201 })
  },
)

// GET - List provider's customer reviews (provider only)
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user }) => {
    const repository = new CustomerReviewRepository()
    const reviews = await repository.findByProviderId(user.providerId)

    return NextResponse.json(reviews)
  },
)
