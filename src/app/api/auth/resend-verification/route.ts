import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { z } from "zod"
import { logger } from "@/lib/logger"

const resendSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const clientIP = getClientIP(request)
    const isAllowed = await rateLimiters.resendVerification(clientIP)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många försök. Vänta 15 minuter innan du försöker igen." },
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
    const result = resendSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: result.error.issues },
        { status: 400 }
      )
    }

    // Delegate to AuthService
    const service = createAuthService()
    await service.resendVerification(result.data.email.toLowerCase())

    // Always return same response to prevent email enumeration
    return NextResponse.json({
      message:
        "Om e-postadressen finns i vårt system och inte redan är verifierad, har vi skickat ett nytt verifieringsmail.",
    })
  } catch (error) {
    logger.error("Resend verification error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel. Försök igen senare." },
      { status: 500 }
    )
  }
}
