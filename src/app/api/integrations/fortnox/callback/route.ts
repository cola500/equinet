import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { encrypt } from "@/lib/encryption"
import { exchangeCodeForTokens } from "@/lib/fortnox-client"

// GET /api/integrations/fortnox/callback - OAuth callback
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.redirect(new URL("/", request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Check for OAuth error
    if (error) {
      logger.warn("Fortnox OAuth denied", {
        error,
        userId: session.user.id,
      })
      return NextResponse.redirect(
        new URL("/provider/settings/integrations?error=denied", request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/provider/settings/integrations?error=missing_params", request.url)
      )
    }

    // Validate CSRF state
    const storedState = request.cookies.get("fortnox_oauth_state")?.value
    if (!storedState || storedState !== state) {
      logger.security("Fortnox OAuth state mismatch", "high", {
        userId: session.user.id,
      })
      return NextResponse.redirect(
        new URL("/provider/settings/integrations?error=state_mismatch", request.url)
      )
    }

    // Exchange code for tokens
    const clientId = process.env.FORTNOX_CLIENT_ID!
    const clientSecret = process.env.FORTNOX_CLIENT_SECRET!
    const redirectUri = process.env.FORTNOX_REDIRECT_URI!

    const tokens = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    )

    // Get provider ID
    const providerId = (session.user as any).providerId
    if (!providerId) {
      return NextResponse.redirect(
        new URL("/provider/settings/integrations?error=no_provider", request.url)
      )
    }

    // Store encrypted tokens
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await prisma.fortnoxConnection.upsert({
      where: { providerId },
      create: {
        providerId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
      },
    })

    logger.info("Fortnox connected", {
      userId: session.user.id,
      providerId,
    })

    // Clear state cookie and redirect to success page
    const response = NextResponse.redirect(
      new URL("/provider/settings/integrations?success=true", request.url)
    )
    response.cookies.delete("fortnox_oauth_state")

    return response
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Fortnox OAuth callback failed", error as Error)
    return NextResponse.redirect(
      new URL("/provider/settings/integrations?error=token_exchange", request.url)
    )
  }
}
