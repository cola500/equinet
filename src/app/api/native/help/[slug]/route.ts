/**
 * GET /api/native/help/[slug] - Single help article for native iOS app
 *
 * Auth: Bearer > Supabase.
 * Returns full article with content blocks.
 * Feature flag: help_center
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { getArticle } from "@/lib/help"
import type { HelpRole } from "@/lib/help"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Feature flag
    const enabled = await isFeatureEnabled("help_center")
    if (!enabled) {
      return NextResponse.json({ error: "Funktionen är inte aktiverad" }, { status: 404 })
    }

    // 3. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 4. Get slug and role
    const { slug } = await params
    const role: HelpRole = authUser.userType === "provider" ? "provider" : "customer"

    // 5. Find article
    const article = getArticle(slug, role)
    if (!article) {
      return NextResponse.json({ error: "Artikeln hittades inte" }, { status: 404 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    logger.error("Error fetching help article", { error })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
