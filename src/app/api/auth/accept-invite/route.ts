import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createAuthService } from "@/domain/auth/AuthService"
import { mapAuthErrorToStatus } from "@/domain/auth/mapAuthErrorToStatus"

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(8, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(/[A-Z]/, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(/[a-z]/, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(/[0-9]/, "Lösenordet måste innehålla minst en siffra")
    .regex(/[^A-Za-z0-9]/, "Lösenordet måste innehålla minst ett specialtecken"),
}).strict()

// POST /api/auth/accept-invite -- Unauthenticated endpoint
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = acceptInviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data

    const authService = createAuthService()
    const result = await authService.acceptInvite(token, password)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapAuthErrorToStatus(result.error) }
      )
    }

    return NextResponse.json({ message: result.value.message })
  } catch (error) {
    logger.error(
      "Failed to accept invite",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte aktivera kontot" },
      { status: 500 }
    )
  }
}
