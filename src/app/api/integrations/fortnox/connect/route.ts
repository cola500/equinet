import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { randomBytes } from "crypto"

// GET /api/integrations/fortnox/connect - Start OAuth flow
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantorer kan koppla Fortnox" },
        { status: 403 }
      )
    }

    const clientId = process.env.FORTNOX_CLIENT_ID
    const redirectUri = process.env.FORTNOX_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Fortnox-integration ar inte konfigurerad" },
        { status: 503 }
      )
    }

    // Generate CSRF state token
    const state = randomBytes(32).toString("hex")

    // Store state in cookie for validation in callback
    const response = NextResponse.redirect(
      `https://apps.fortnox.se/oauth-v1/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=invoice` +
        `&state=${state}` +
        `&response_type=code`
    )

    response.cookies.set("fortnox_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    })

    logger.info("Fortnox OAuth flow started", {
      userId: session.user.id,
    })

    return response
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to start Fortnox OAuth", error as Error)
    return NextResponse.json(
      { error: "Kunde inte starta Fortnox-koppling" },
      { status: 500 }
    )
  }
}
