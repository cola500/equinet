import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
}).strict()

// PUT - Update a review (customer only, must own it)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: reviewId } = await params

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

    const validated = updateReviewSchema.parse(body)

    // Find review with ownership check
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, customerId: true },
    })

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    if (review.customerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Update review
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: validated.rating,
        comment: validated.comment ?? null,
      },
    })

    return NextResponse.json(updated)
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

    logger.error("Error updating review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to update review" },
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find review with ownership check
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, customerId: true },
    })

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    if (review.customerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    await prisma.review.delete({ where: { id: reviewId } })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error deleting review", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    )
  }
}
