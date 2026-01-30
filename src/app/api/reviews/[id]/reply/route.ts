import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const validated = replySchema.parse(body)

    // Find the provider for the current user
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Find review
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, providerId: true, reply: true },
    })

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    // Authorization: provider must own the review's provider
    if (review.providerId !== provider.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Business rule: only one reply per review
    if (review.reply) {
      return NextResponse.json(
        { error: "Reply already exists for this review" },
        { status: 409 }
      )
    }

    // Add reply
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        reply: validated.reply,
        repliedAt: new Date(),
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

    logger.error("Error adding reply", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to add reply" },
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the provider for the current user
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Find review
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, providerId: true },
    })

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    // Authorization
    if (review.providerId !== provider.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Remove reply
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        reply: null,
        repliedAt: null,
      },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error deleting reply", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to delete reply" },
      { status: 500 }
    )
  }
}
