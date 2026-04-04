import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ReviewService } from "@/domain/review/ReviewService"
import { mapReviewErrorToStatus } from "@/domain/review/mapReviewErrorToStatus"
import { ReviewRepository } from "@/infrastructure/persistence/review/ReviewRepository"

const replySchema = z.object({
  reply: z.string().min(1, "Svar krävs").max(500, "Svar kan vara max 500 tecken"),
}).strict()

async function resolveAuth(request: NextRequest): Promise<{ userId: string; userType: string }> {
  const authUser = await getAuthUser(request)
  if (!authUser) {
    throw NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  return { userId: authUser.id, userType: authUser.userType }
}

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST - Add a reply to a review (provider only)
export async function POST(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "none", schema: replySchema },
    async ({ request: req, body }) => {
      const { userId, userType } = await resolveAuth(req)
      const { id: reviewId } = await context.params

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

      const result = await reviewService.addReply({
        reviewId,
        reply: body.reply,
        providerId: provider.id,
      })

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapReviewErrorToStatus(result.error) }
        )
      }

      return NextResponse.json(result.value)
    },
  )(request)
}

// DELETE - Remove a reply from a review (provider only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "none" },
    async ({ request: req }) => {
      const { userId, userType } = await resolveAuth(req)
      const { id: reviewId } = await context.params

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

      return new NextResponse(null, { status: 204 })
    },
  )(request)
}
