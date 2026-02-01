import { NextRequest, NextResponse } from "next/server"
import { createAuthService } from "@/domain/auth/AuthService"
import { mapAuthErrorToStatus } from "@/domain/auth/mapAuthErrorToStatus"
import { z } from "zod"
import { logger } from "@/lib/logger"

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token krävs"),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate input
    const result = verifyEmailSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: result.error.issues },
        { status: 400 }
      )
    }

    // Delegate to AuthService
    const service = createAuthService()
    const verifyResult = await service.verifyEmail(result.data.token)

    if (verifyResult.isFailure) {
      return NextResponse.json(
        { error: verifyResult.error.message },
        { status: mapAuthErrorToStatus(verifyResult.error) }
      )
    }

    return NextResponse.json({
      message: "E-postadressen har verifierats",
      email: verifyResult.value.email,
    })
  } catch (error) {
    logger.error("Verify email error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel vid verifiering" },
      { status: 500 }
    )
  }
}
