import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { z } from "zod"
import { logger } from "@/lib/logger"

const forgotPasswordSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
}).strict()

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP (3 attempts per hour)
    const clientIP = getClientIP(request)
    const isAllowed = await rateLimiters.passwordReset(clientIP)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många försök. Vänta innan du försöker igen." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate input
    const result = forgotPasswordSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: result.error.issues },
        { status: 400 }
      )
    }

    // Delegate to AuthService
    const service = createAuthService()
    await service.requestPasswordReset(result.data.email.toLowerCase())

    // Always return same response to prevent email enumeration
    return NextResponse.json({
      message:
        "Om e-postadressen finns i vårt system har vi skickat en länk för att återställa ditt lösenord.",
    })
  } catch (error) {
    logger.error("Forgot password error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel. Försök igen senare." },
      { status: 500 }
    )
  }
}
