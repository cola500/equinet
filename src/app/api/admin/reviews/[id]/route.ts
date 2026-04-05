import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

const deleteSchema = z.object({
  type: z.enum(["review", "customerReview"]),
}).strict()

export const DELETE = withApiHandler(
  { auth: "admin", schema: deleteSchema },
  async (ctx) => {
    const { user, body, request } = ctx
    // Extract id from URL path
    const url = new URL(request.url)
    const id = url.pathname.split("/").pop()!

    const { type } = body

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
      adminId: user.userId,
      reviewId: id,
      reviewType: type,
    })

    return NextResponse.json({ deleted: true })
  },
)
