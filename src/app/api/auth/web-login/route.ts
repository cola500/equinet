/**
 * POST /api/auth/web-login - Web login with structured error types
 *
 * Validates credentials and returns error type so the login page can
 * distinguish between invalid credentials vs unverified email.
 * NextAuth's signIn() swallows the actual error message, so we need
 * this route to surface structured errors to the client.
 *
 * The login page calls this first, then signIn("credentials") on success
 * to create the session.
 *
 * TODO: auth.ts authorize() does NOT rate-limit (known gap). Rate limiting
 * only happens here (web-login) and in native-login. The second signIn()
 * call from the login page bypasses rate limiting entirely. This is
 * acceptable because web-login already validated credentials, but should
 * be addressed when NextAuth is upgraded or replaced.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rateLimiters, resetRateLimit } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { mapAuthErrorToStatus } from "@/domain/auth/mapAuthErrorToStatus"
import { logger } from "@/lib/logger"

const bodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
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

    const { email, password } = parsed.data
    const identifier = email.toLowerCase()

    // Rate limit (by email, before auth)
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
      const { type, message } = result.error
      const status = mapAuthErrorToStatus(result.error)

      const errorMessages: Record<string, string> = {
        EMAIL_NOT_VERIFIED: "Din e-post är inte verifierad",
        ACCOUNT_BLOCKED: message,
        INVALID_CREDENTIALS: "Ogiltig email eller lösenord",
      }

      return NextResponse.json(
        { error: errorMessages[type] ?? message, type },
        { status }
      )
    }

    // Reset rate limit on success
    await resetRateLimit(identifier)

    logger.info("Web login credentials verified", { userId: result.value.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Web login failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
