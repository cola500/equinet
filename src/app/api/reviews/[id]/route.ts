import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { z } from "zod"
import { ReviewRepository } from "@/infrastructure/persistence/review/ReviewRepository"

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
}).strict()

const reviewRepo = new ReviewRepository()

type RouteContext = {
  params: Promise<{ id: string }>
}

// PUT - Update a review (customer only, must own it)
export async function PUT(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "customer", schema: updateReviewSchema },
    async ({ user, body }) => {
      const { id: reviewId } = await context.params

      // Atomic update with authorization (IDOR-safe)
      const updated = await reviewRepo.updateWithAuth(
        reviewId,
        { rating: body.rating, comment: body.comment ?? null },
        user.userId
      )

      if (!updated) {
        // Could be "not found" or "not authorized" - check which
        const exists = await reviewRepo.exists(reviewId)
        if (!exists) {
          return NextResponse.json({ error: "Omdöme hittades inte" }, { status: 404 })
        }
        return NextResponse.json({ error: "Ej behörig" }, { status: 403 })
      }

      return NextResponse.json(updated)
    },
  )(request)
}

// DELETE - Delete a review (customer only, must own it)
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "customer" },
    async ({ user }) => {
      const { id: reviewId } = await context.params

      // Atomic delete with authorization (IDOR-safe)
      const deleted = await reviewRepo.deleteWithAuth(reviewId, user.userId)

      if (!deleted) {
        // Could be "not found" or "not authorized" - check which
        const exists = await reviewRepo.exists(reviewId)
        if (!exists) {
          return NextResponse.json({ error: "Omdöme hittades inte" }, { status: 404 })
        }
        return NextResponse.json({ error: "Ej behörig" }, { status: 403 })
      }

      return new NextResponse(null, { status: 204 })
    },
  )(request)
}
