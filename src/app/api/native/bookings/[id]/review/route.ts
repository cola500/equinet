/**
 * POST /api/native/bookings/[id]/review - Create customer review from native iOS app
 *
 * Auth: Bearer > Supabase.
 * Domain rules: booking must be completed, owned by provider, not already reviewed.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Betyg måste vara minst 1").max(5, "Betyg måste vara max 5"),
  comment: z.string().max(500, "Kommentar kan vara max 500 tecken").optional(),
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params

    // 1. Auth (dual-auth)
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Parse and validate body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = reviewSchema.parse(body)

    // 5. Find booking with ownership check
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        status: true,
        customerReview: { select: { id: true } },
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokning hittades inte" },
        { status: 404 }
      )
    }

    if (booking.providerId !== provider.id) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    if (booking.status !== "completed") {
      return NextResponse.json(
        { error: "Bara genomförda bokningar kan recenseras" },
        { status: 400 }
      )
    }

    if (booking.customerReview) {
      return NextResponse.json(
        { error: "Recension finns redan för denna bokning" },
        { status: 409 }
      )
    }

    // 6. Create review
    const review = await prisma.customerReview.create({
      data: {
        rating: validated.rating,
        comment: validated.comment || null,
        bookingId: booking.id,
        providerId: provider.id,
        customerId: booking.customerId,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
      },
    })

    logger.info("Native customer review created", {
      reviewId: review.id,
      bookingId,
      providerId: provider.id,
    })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error creating customer review", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte skapa kundrecension" },
      { status: 500 }
    )
  }
}
