import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
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
    await requireAdmin(session)

    // Database health check
    let dbHealthy = false
    let dbResponseTimeMs = 0
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1 as result`
      dbHealthy = true
    } catch {
      dbHealthy = false
    }
    dbResponseTimeMs = Date.now() - dbStart

    // Cron status - check latest reminder notification
    const [lastReminder, remindersCount] = await Promise.all([
      prisma.notification.findFirst({
        where: { type: "REMINDER_REBOOK" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.notification.count({
        where: { type: "REMINDER_REBOOK" },
      }),
    ])

    return NextResponse.json({
      database: {
        healthy: dbHealthy,
        responseTimeMs: dbResponseTimeMs,
      },
      cron: {
        lastReminderRun: lastReminder?.createdAt ?? null,
        remindersCount,
      },
      email: {
        disabledByEnv: process.env.DISABLE_EMAILS === "true",
      },
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    logger.error("Failed to fetch admin system status", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
