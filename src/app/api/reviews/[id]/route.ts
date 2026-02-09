import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { ReviewRepository } from "@/infrastructure/persistence/review/ReviewRepository"

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
}).strict()

const reviewRepo = new ReviewRepository()

// PUT - Update a review (customer only, must own it)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: reviewId } = await params

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

    const validated = updateReviewSchema.parse(body)

    // Atomic update with authorization (IDOR-safe)
    const updated = await reviewRepo.updateWithAuth(
      reviewId,
      { rating: validated.rating, comment: validated.comment ?? null },
      session.user.id
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

    logger.error("Error updating review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera omdöme" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a review (customer only, must own it)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: reviewId } = await params

    if (session.user.userType !== "customer") {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Atomic delete with authorization (IDOR-safe)
    const deleted = await reviewRepo.deleteWithAuth(reviewId, session.user.id)

    if (!deleted) {
      // Could be "not found" or "not authorized" - check which
      const exists = await reviewRepo.exists(reviewId)
      if (!exists) {
        return NextResponse.json({ error: "Omdöme hittades inte" }, { status: 404 })
      }
      return NextResponse.json({ error: "Ej behörig" }, { status: 403 })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error deleting review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte ta bort omdöme" },
      { status: 500 }
    )
  }
}
