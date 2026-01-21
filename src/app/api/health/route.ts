import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
export async function GET() {
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
    console.error("Health check failed:", error)

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
