import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { ReviewService, type ReviewError } from "@/domain/review/ReviewService"
import { mapReviewErrorToStatus } from "@/domain/review/mapReviewErrorToStatus"
import { ReviewRepository } from "@/infrastructure/persistence/review/ReviewRepository"

const replySchema = z.object({
  reply: z.string().min(1, "Svar krävs").max(500, "Svar kan vara max 500 tecken"),
}).strict()

// POST - Add a reply to a review (provider only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: reviewId } = await params

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = replySchema.parse(body)

    // Find the provider for the current user
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    const reviewService = new ReviewService({
      reviewRepository: new ReviewRepository(),
      getBooking: async () => null,
      getProviderUserId: async () => null,
    })

    const result = await reviewService.addReply({
      reviewId,
      reply: validated.reply,
      providerId: provider.id,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapReviewErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
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

    logger.error("Error adding reply", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte lägga till svar" },
      { status: 500 }
    )
  }
}

// DELETE - Remove a reply from a review (provider only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: reviewId } = await params

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Find the provider for the current user
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    const reviewService = new ReviewService({
      reviewRepository: new ReviewRepository(),
      getBooking: async () => null,
      getProviderUserId: async () => null,
    })

    const result = await reviewService.deleteReply({
      reviewId,
      providerId: provider.id,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapReviewErrorToStatus(result.error) }
      )
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error deleting reply", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte ta bort svar" },
      { status: 500 }
    )
  }
}
