import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { rateLimiters, resetRateLimit, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
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
 * Rate limit is consumed ONLY on verify failure (wrong code). Not on success,
 * zod-fail, or challenge-fail. This prevents legitimate admins from being
 * locked out due to network glitches or misconfigured factors.
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

    // Parse and validate body BEFORE rate limiting so validation errors don't consume attempts
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

    // Rate limit after validation. On success the token is reset (net zero).
    // On verify failure the token stays consumed — counts as a genuine failed attempt.
    const allowed = await rateLimiters.mfaVerify(user.id).catch((err: unknown) => {
      if (err instanceof RateLimitServiceError) {
        return null
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

    const { factorId, code } = parsed.data
    const supabase = await createSupabaseServerClient()

    // Defense-in-depth: verify factorId belongs to the session user before calling challenge.
    // Supabase docs/GoTrue source (verified 2026-04-22) are inconclusive about whether
    // mfa.challenge scopes to the authenticated user — explicit check eliminates IDOR risk.
    const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError || !factorsData) {
      // listFactors failure is infrastructure, not a user mistake — reset to avoid lockout
      await resetRateLimit(user.id, "mfaVerify")
      logger.error("MFA listFactors failed", { error: listError?.message, userId: user.id })
      return NextResponse.json(
        { error: "MFA-verifiering misslyckades. Försök igen." },
        { status: 500 }
      )
    }

    const ownsFactor = factorsData.all.some((f) => f.id === factorId)
    if (!ownsFactor) {
      // IDOR probe counts as a failed attempt — do NOT reset the rate limit token
      logger.warn("MFA verify IDOR attempt", { userId: user.id, factorId, ip: getClientIP(req) })
      prisma.adminAuditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: "mfa.verify.idor_attempt",
          ipAddress: getClientIP(req),
          userAgent: req.headers.get("user-agent") ?? undefined,
          statusCode: 403,
        },
      }).catch((err: unknown) => {
        logger.error("Failed to write MFA audit log", err instanceof Error ? err : new Error(String(err)))
      })
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })

    if (challengeError) {
      // Challenge failure is a server/factor issue, not a wrong-code attempt — reset token
      await resetRateLimit(user.id, "mfaVerify")
      logger.error("MFA challenge failed", { error: challengeError.message, userId: user.id })
      prisma.adminAuditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: "mfa.challenge.failure",
          ipAddress: getClientIP(req),
          userAgent: req.headers.get("user-agent") ?? undefined,
          statusCode: 401,
        },
      }).catch((err: unknown) => {
        logger.error("Failed to write MFA audit log", err instanceof Error ? err : new Error(String(err)))
      })
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
      // Wrong code — token stays consumed (genuine failed attempt)
      logger.warn("MFA verify failed (wrong code)", { userId: user.id })
      prisma.adminAuditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: "mfa.verify.failure",
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

    // Reset rate limit on success so the next session starts fresh
    await resetRateLimit(user.id, "mfaVerify")

    prisma.adminAuditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "mfa.verify.success",
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
