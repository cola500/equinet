import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { ReviewService } from "@/domain/review/ReviewService"
import { mapReviewErrorToStatus } from "@/domain/review/mapReviewErrorToStatus"
import { ReviewRepository } from "@/infrastructure/persistence/review/ReviewRepository"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

const replySchema = z.object({
  reply: z.string().min(1, "Svar krävs").max(500, "Svar kan vara max 500 tecken"),
}).strict()

/**
 * Dual-auth: try Bearer JWT first, fall back to session.
 * Returns { userId, userType } or throws/returns 401 Response.
 */
async function resolveAuth(request: NextRequest): Promise<{ userId: string; userType: string }> {
  const mobileAuth = await authFromMobileToken(request)
  if (mobileAuth) {
    // Mobile tokens are provider-only (issued at login for providers)
    return { userId: mobileAuth.userId, userType: "provider" }
  }
  // Fall back to session auth
  const session = await auth()
  if (!session) {
    throw NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  return { userId: session.user.id, userType: (session.user as { userType: string }).userType }
}

// POST - Add a reply to a review (provider only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, userType } = await resolveAuth(request)

    // Rate limiting (fail-closed)
    try {
      const clientIp = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIp)
      if (!isAllowed) {
        return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
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

    const { id: reviewId } = await params

    if (userType !== "provider") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
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
      where: { userId },
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
    const { userId, userType } = await resolveAuth(request)

    // Rate limiting (fail-closed)
    try {
      const clientIp = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIp)
      if (!isAllowed) {
        return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
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

    const { id: reviewId } = await params

    if (userType !== "provider") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    // Find the provider for the current user
    const provider = await prisma.provider.findUnique({
      where: { userId },
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
