import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { mapAuthErrorToStatus } from "@/domain/auth/mapAuthErrorToStatus"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { passwordRequirements } from "@/lib/validations/auth"

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token krävs"),
  password: z.string()
    .min(passwordRequirements.minLength, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(passwordRequirements.hasUppercase, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(passwordRequirements.hasLowercase, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(passwordRequirements.hasNumber, "Lösenordet måste innehålla minst en siffra")
    .regex(passwordRequirements.hasSpecialChar, "Lösenordet måste innehålla minst ett specialtecken"),
}).strict()

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
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
    const validation = resetPasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: validation.error.issues },
        { status: 400 }
      )
    }

    // Delegate to AuthService
    const service = createAuthService()
    const result = await service.resetPassword(validation.data.token, validation.data.password)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapAuthErrorToStatus(result.error) }
      )
    }

    return NextResponse.json({
      message: "Lösenordet har återställts. Du kan nu logga in med ditt nya lösenord.",
    })
  } catch (error) {
    logger.error("Reset password error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel. Försök igen senare." },
      { status: 500 }
    )
  }
}
