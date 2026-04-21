import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { logger } from "@/lib/logger"
import {
  getClientIP,
  rateLimiters,
  RateLimitServiceError,
} from "@/lib/rate-limit"


/**
 * POST /api/auth/native-session-exchange
 *
 * Exchanges a Supabase access token (from iOS native auth) for
 * web session cookies that WKWebView can use.
 *
 * Flow:
 * 1. iOS app logs in via Supabase Swift SDK -> gets access_token
 * 2. iOS sends access_token as Bearer header to this endpoint
 * 3. Server verifies token, creates Supabase SSR client, sets cookies
 * 4. WKWebView receives Set-Cookie headers -> authenticated
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  try {
    const ip = getClientIP(request)
    const isAllowed = await rateLimiters.api(ip)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
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

  // Extract Bearer token and refresh token
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  // Refresh token from X-Refresh-Token header (moved from body in S49-0 for transport-layer safety)
  const refreshTokenHeader = request.headers.get("X-Refresh-Token")
  const refreshToken = refreshTokenHeader?.trim() || undefined

  // Create a Supabase client that will set cookies on the response
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Verify the access token against Supabase
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken)

  if (error || !user) {
    logger.warn("native-session-exchange: invalid token", {
      error: error?.message,
    })
    return NextResponse.json({ error: "Ogiltig token" }, { status: 401 })
  }

  // Set the session -- this triggers setAll() which writes cookies
  if (refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) {
      logger.warn("native-session-exchange: setSession failed", {
        error: sessionError.message,
      })
    }
  }

  logger.info("native-session-exchange: session exchanged", {
    userId: user.id,
    hasCookies: !!refreshToken,
  })

  return response
}
