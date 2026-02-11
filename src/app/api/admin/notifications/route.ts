import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { sanitizeString } from "@/lib/sanitize"

const postSchema = z.object({
  target: z.enum(["all", "customers", "providers"]),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  linkUrl: z.string().max(200).optional(),
}).strict()

export async function POST(request: NextRequest) {
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

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = postSchema.parse(body)
    const title = sanitizeString(parsed.title)
    const message = sanitizeString(parsed.message)
    const linkUrl = parsed.linkUrl || null

    // Build user filter based on target
    const where: Record<string, unknown> = {}
    if (parsed.target === "customers") {
      where.userType = "customer"
    } else if (parsed.target === "providers") {
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

    logger.security(`Admin sent system notification to ${parsed.target} (${result.count} users)`, "medium", {
      adminId: admin.id,
      target: parsed.target,
      count: result.count,
    })

    return NextResponse.json({ sent: result.count })
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
    logger.error("Failed to send admin notification", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
