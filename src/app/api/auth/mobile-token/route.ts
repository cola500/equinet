/**
 * POST /api/auth/mobile-token - Generate a new mobile token
 * DELETE /api/auth/mobile-token - Revoke current mobile token
 *
 * POST uses session cookie auth (called from WKWebView).
 * DELETE uses Bearer token auth (called from native).
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { getMobileTokenService, authFromMobileToken } from "@/lib/mobile-auth"
import { MaxTokensExceededError } from "@/domain/auth/MobileTokenService"
import { logger } from "@/lib/logger"

const postBodySchema = z
  .object({
    deviceName: z.string().max(100).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    // Auth (dual: Bearer > NextAuth > Supabase)
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Rate limit
    const clientIP = getClientIP(request)
    const isAllowed = await rateLimiters.mobileToken(
      `${authUser.id}:${clientIP}`
    )
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar, försök igen senare" },
        { status: 429 }
      )
    }

    // Parse body
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK (deviceName is optional)
    }

    // Validate
    const parsed = postBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const service = getMobileTokenService()
    const result = await service.generateToken(
      authUser.id,
      parsed.data.deviceName
    )

    logger.info("Mobile token generated", {
      userId: authUser.id,
      deviceName: parsed.data.deviceName,
    })

    return NextResponse.json({
      token: result.jwt,
      expiresAt: result.expiresAt.toISOString(),
    })
  } catch (error) {
    // Re-throw auth errors (401 responses)
    if (error instanceof Response) throw error

    if (error instanceof MaxTokensExceededError) {
      return NextResponse.json(
        { error: "Max antal aktiva tokens uppnått. Ta bort ett befintligt token först." },
        { status: 409 }
      )
    }

    logger.error("Failed to generate mobile token", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Auth (Bearer token)
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const service = getMobileTokenService()
    await service.revokeToken(authResult.tokenId, authResult.userId)

    logger.info("Mobile token revoked", {
      userId: authResult.userId,
      tokenId: authResult.tokenId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Failed to revoke mobile token", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
