/**
 * GET /api/native/help - Help center articles for native iOS app
 *
 * Auth: Bearer > Supabase.
 * Returns articles filtered by user role, with optional search.
 * Feature flag: help_center
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { getAllArticles, getArticleSections, searchArticles } from "@/lib/help"
import type { HelpRole } from "@/lib/help"

export async function GET(request: NextRequest) {
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

    // 4. Determine role from user type
    const role: HelpRole = authUser.userType === "provider" ? "provider" : "customer"

    // 5. Optional search
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    const articles = query
      ? searchArticles(query, role)
      : getAllArticles(role)

    const sections = getArticleSections(role)

    // Strip content from list response (only slug, title, section, summary)
    const articleSummaries = articles.map(({ slug, title, section, summary, role: r, keywords }) => ({
      slug,
      title,
      section,
      summary,
      role: r,
      keywords,
    }))

    return NextResponse.json({ articles: articleSummaries, sections })
  } catch (error) {
    logger.error("Error fetching help articles", { error })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
