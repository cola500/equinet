/**
 * POST /api/auth/mobile-token/refresh - Refresh a mobile token (rotation)
 *
 * Auth: Bearer token. Old token is revoked, new one returned.
 */
import { NextRequest, NextResponse } from "next/server"
import { getMobileTokenService } from "@/lib/mobile-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    // Extract Bearer token
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const oldJwt = authHeader.slice(7)
    if (!oldJwt) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Rate limit
    const clientIP = getClientIP(request)
    const isAllowed = await rateLimiters.mobileToken(clientIP)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar, försök igen senare" },
        { status: 429 }
      )
    }

    const service = getMobileTokenService()
    const result = await service.refreshToken(oldJwt)

    if (!result) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    logger.info("Mobile token refreshed")

    return NextResponse.json({
      token: result.jwt,
      expiresAt: result.expiresAt.toISOString(),
    })
  } catch (error) {
    logger.error("Failed to refresh mobile token", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
