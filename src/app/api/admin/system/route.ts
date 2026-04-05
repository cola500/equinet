import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

export const GET = withApiHandler(
  { auth: "admin" },
  async () => {
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
  },
)
