import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    try {
      await rateLimiters.api(getClientIP(req))
    } catch (err) {
      if (err instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    const supabase = await createSupabaseServerClient()

    const [factorsResult, aalResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])

    if (factorsResult.error) {
      logger.error("Failed to list MFA factors", { error: factorsResult.error.message })
      return NextResponse.json({ error: "Kunde inte hämta MFA-status" }, { status: 500 })
    }

    if (aalResult.error) {
      logger.error("Failed to get AAL", { error: aalResult.error.message })
      return NextResponse.json({ error: "Kunde inte hämta MFA-status" }, { status: 500 })
    }

    const totpFactors = factorsResult.data.totp ?? []
    const verifiedFactors = totpFactors.filter(
      (f: { status: string }) => f.status === "verified"
    )

    return NextResponse.json({
      enrolled: verifiedFactors.length > 0,
      currentLevel: aalResult.data.currentLevel,
      nextLevel: aalResult.data.nextLevel,
      factors: verifiedFactors,
    })
  } catch (err) {
    logger.error("MFA status error", { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
