import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { sanitizeString } from "@/lib/sanitize"

const postSchema = z.object({
  target: z.enum(["all", "customers", "providers"]),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  linkUrl: z.string().max(200).optional(),
}).strict()

export const POST = withApiHandler(
  { auth: "admin", schema: postSchema },
  async ({ user, body }) => {
    const title = sanitizeString(body.title)
    const message = sanitizeString(body.message)
    const linkUrl = body.linkUrl || null

    // Build user filter based on target
    const where: Record<string, unknown> = {}
    if (body.target === "customers") {
      where.userType = "customer"
    } else if (body.target === "providers") {
      where.userType = "provider"
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const notificationMessage = `${title}: ${message}`

    const result = await prisma.notification.createMany({
      data: users.map((u: { id: string }) => ({
        userId: u.id,
        type: "system_notification",
        message: notificationMessage,
        linkUrl,
      })),
    })

    logger.security(`Admin sent system notification to ${body.target} (${result.count} users)`, "medium", {
      adminId: user.userId,
      target: body.target,
      count: result.count,
    })

    return NextResponse.json({ sent: result.count })
  },
)
