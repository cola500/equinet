/**
 * POST /api/auth/native-login - Native iOS login
 *
 * Authenticates with email+password, returns mobile token + session cookie
 * for WKWebView injection. Used by the native SwiftUI login screen.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rateLimiters, resetRateLimit } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { getMobileTokenService, createSessionCookieValue } from "@/lib/mobile-auth"
import { MaxTokensExceededError } from "@/domain/auth/MobileTokenService"
import { logger } from "@/lib/logger"

const bodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    deviceName: z.string().max(100).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    // Parse JSON
    let rawBody: Record<string, unknown>
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, deviceName } = parsed.data
    const identifier = email.toLowerCase()

    // Rate limit (by email, before auth -- matches auth.ts pattern)
    const isAllowed = await rateLimiters.login(identifier)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många inloggningsförsök. Försök igen om 15 minuter." },
        { status: 429 }
      )
    }

    // Verify credentials
    const authService = createAuthService()
    const result = await authService.verifyCredentials(email, password)

    if (result.isFailure) {
      const errorType = result.error.type

      if (errorType === "EMAIL_NOT_VERIFIED") {
        return NextResponse.json(
          { error: "Kontot är inte verifierat" },
          { status: 403 }
        )
      }
      if (errorType === "ACCOUNT_BLOCKED") {
        return NextResponse.json(
          { error: result.error.message },
          { status: 403 }
        )
      }

      // INVALID_CREDENTIALS
      return NextResponse.json(
        { error: "Ogiltig email eller lösenord" },
        { status: 401 }
      )
    }

    const user = result.value

    // Reset rate limit on success
    await resetRateLimit(identifier)

    // Generate mobile token
    const tokenService = getMobileTokenService()
    const tokenResult = await tokenService.generateToken(user.id, deviceName)

    // Create session cookie
    const sessionCookie = await createSessionCookieValue({
      id: user.id,
      name: user.name,
      userType: user.userType,
      isAdmin: user.isAdmin,
      providerId: user.providerId,
    })

    logger.info("Native login successful", {
      userId: user.id,
      deviceName,
    })

    return NextResponse.json({
      token: tokenResult.jwt,
      expiresAt: tokenResult.expiresAt.toISOString(),
      sessionCookie,
      user: {
        id: user.id,
        name: user.name,
        userType: user.userType,
        providerId: user.providerId,
      },
    })
  } catch (error) {
    if (error instanceof MaxTokensExceededError) {
      return NextResponse.json(
        { error: "Max antal aktiva tokens uppnått. Ta bort ett befintligt token först." },
        { status: 409 }
      )
    }

    logger.error("Native login failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
