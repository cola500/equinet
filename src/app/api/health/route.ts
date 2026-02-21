import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

/**
 * Lightweight connectivity probe for offline detection.
 *
 * Used by useOnlineStatus() to proactively detect network loss on iOS Safari
 * where navigator.onLine stays true even when WiFi drops. Returns 200 with
 * no body -- the client only cares whether the request throws (offline) or not.
 */
export async function HEAD() {
  return new Response(null, { status: 200 })
}

/**
 * Health check endpoint for uptime monitoring
 *
 * Used by:
 * - Uptime monitoring services (Pingdom, UptimeRobot)
 * - Load balancers (health checks)
 * - Internal monitoring dashboards
 *
 * Returns:
 * - 200 OK: All systems operational
 * - 503 Service Unavailable: Database connection failed
 */
export async function GET(request: NextRequest) {
  // Rate limit before database query
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "For manga forfragningar. Forsok igen om en minut." },
      { status: 429 }
    )
  }

  try {
    // Check database connectivity
    // Using a lightweight query instead of raw SQL for Prisma compatibility
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        checks: {
          database: "connected",
        },
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error("Health check failed", error instanceof Error ? error : new Error(String(error)))

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        checks: {
          database: "disconnected",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    )
  }
}
