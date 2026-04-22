import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bodySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/),
}).strict()

/**
 * POST /api/admin/mfa/verify
 * Server-side MFA challenge + verify with rate limiting.
 * Rate limited to 3 attempts per 15 minutes per admin user.
 * Called from the /admin/mfa/verify page instead of calling Supabase directly.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    const allowed = await rateLimiters.mfaVerify(user.id).catch((err: unknown) => {
      if (err instanceof RateLimitServiceError) {
        return null // null = service error
      }
      throw err
    })

    if (allowed === null) {
      return NextResponse.json(
        { error: "Tjänsten är tillfälligt otillgänglig" },
        { status: 503 }
      )
    }

    if (!allowed) {
      logger.warn("MFA verify rate limited", { userId: user.id, ip: getClientIP(req) })
      return NextResponse.json(
        { error: "För många misslyckade försök. Försök igen om 15 minuter." },
        { status: 429 }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { factorId, code } = parsed.data
    const supabase = await createSupabaseServerClient()

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })

    if (challengeError) {
      logger.error("MFA challenge failed", { error: challengeError.message, userId: user.id })
      return NextResponse.json(
        { error: "MFA-verifiering misslyckades. Kontrollera att din factor är aktiv." },
        { status: 401 }
      )
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    })

    if (verifyError) {
      logger.warn("MFA verify failed (wrong code)", { userId: user.id })
      prisma.adminAuditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: "POST /api/admin/mfa/verify",
          ipAddress: getClientIP(req),
          userAgent: req.headers.get("user-agent") ?? undefined,
          statusCode: 401,
        },
      }).catch((err: unknown) => {
        logger.error("Failed to write MFA audit log", err instanceof Error ? err : new Error(String(err)))
      })
      return NextResponse.json(
        { error: "Felaktig kod. Kontrollera din authenticator-app och försök igen." },
        { status: 401 }
      )
    }

    logger.info("MFA verify success", { userId: user.id })

    // Fire-and-forget audit log (same pattern as withApiHandler)
    prisma.adminAuditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "POST /api/admin/mfa/verify",
        ipAddress: getClientIP(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
        statusCode: 200,
      },
    }).catch((err: unknown) => {
      logger.error("Failed to write MFA audit log", err instanceof Error ? err : new Error(String(err)))
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error("MFA verify error", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
