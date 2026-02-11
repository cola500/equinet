import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

const deleteSchema = z.object({
  type: z.enum(["review", "customerReview"]),
}).strict()

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    const admin = await requireAdmin(session)
    const { id } = await context.params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = deleteSchema.parse(body)
    const { type } = parsed

    if (type === "review") {
      const existing = await prisma.review.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!existing) {
        return NextResponse.json(
          { error: "Recensionen hittades inte" },
          { status: 404 }
        )
      }
      await prisma.review.delete({ where: { id } })
    } else {
      const existing = await prisma.customerReview.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!existing) {
        return NextResponse.json(
          { error: "Recensionen hittades inte" },
          { status: 404 }
        )
      }
      await prisma.customerReview.delete({ where: { id } })
    }

    logger.security(`Admin deleted ${type} ${id}`, "high", {
      adminId: admin.id,
      reviewId: id,
      reviewType: type,
    })

    return NextResponse.json({ deleted: true })
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
    logger.error("Failed to delete admin review", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
