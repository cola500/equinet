import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { getClientVisibleFlags } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"

export const dynamic = 'force-dynamic'

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

    return NextResponse.json(
      { flags: await getClientVisibleFlags() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    logger.error("Failed to fetch feature flags", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
