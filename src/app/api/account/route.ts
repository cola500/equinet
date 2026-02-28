/**
 * DELETE /api/account -- GDPR Art. 17 account deletion
 *
 * Anonymizes user data and deletes personal records.
 * Requires password confirmation and typing "RADERA".
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { createAccountDeletionService } from "@/domain/account/AccountDeletionService"

const deleteAccountSchema = z
  .object({
    confirmation: z.literal("RADERA"),
    password: z.string().min(1),
  })
  .strict()

export async function DELETE(request: NextRequest) {
  try {
    // 1. Auth
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limit
    const ip = getClientIP(request)
    const isAllowed = await rateLimiters.profileUpdate(ip)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    // 3. Parse JSON
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Validate
    const parsed = deleteAccountSchema.parse(body)

    // 5. Execute deletion
    const service = createAccountDeletionService()
    const result = await service.deleteAccount(
      session.user.id,
      parsed.password,
      parsed.confirmation
    )

    // 6. Handle errors
    if (result.isFailure) {
      const error = result.error
      const statusMap: Record<string, number> = {
        USER_NOT_FOUND: 404,
        INVALID_PASSWORD: 401,
        ADMIN_ACCOUNT: 403,
        INVALID_CONFIRMATION: 400,
      }
      const status = statusMap[error.type] || 500
      return NextResponse.json({ error: error.message }, { status })
    }

    // 7. Success
    logger.security("Account deleted", "high", { userId: session.user.id })
    return NextResponse.json({
      success: true,
      message: "Ditt konto har raderats",
    })
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error(
      "Error deleting account",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
