/**
 * Mobile auth helper - Bearer token authentication for iOS widget and native screens.
 *
 * Extracts Bearer token from Authorization header, verifies via MobileTokenService.
 * Used by /api/widget/* and /api/auth/mobile-token/refresh endpoints.
 */
import { MobileTokenService } from "@/domain/auth/MobileTokenService"
import { mobileTokenRepository } from "@/infrastructure/persistence/mobile-token"
import { SignJWT } from "jose"

// Singleton service using NEXTAUTH_SECRET
let mobileTokenService: MobileTokenService | null = null

export function getMobileTokenService(): MobileTokenService {
  if (!mobileTokenService) {
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET is not configured")
    }
    mobileTokenService = new MobileTokenService({
      repository: mobileTokenRepository,
      secret,
    })
  }
  return mobileTokenService
}

export interface MobileAuthResult {
  userId: string
  tokenId: string
}

/**
 * Authenticate a request using Bearer token (mobile token).
 *
 * @returns auth result or null if invalid/missing token
 */
export async function authFromMobileToken(
  request: Request
): Promise<MobileAuthResult | null> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  const jwt = authHeader.slice(7)
  if (!jwt) {
    return null
  }

  const service = getMobileTokenService()
  return service.verifyToken(jwt)
}

export interface SessionCookieResult {
  name: string
  value: string
  maxAge: number
  secure: boolean
  domain: string
}

/**
 * Create a NextAuth-compatible session cookie for native login.
 *
 * Signs a JWT matching NextAuth's jwt callback claims (auth.config.ts:13-19).
 * The cookie can be injected into WKWebView's WKHTTPCookieStore.
 */
export async function createSessionCookieValue(user: {
  id: string
  name: string
  userType: string
  isAdmin: boolean
  providerId: string | null
}): Promise<SessionCookieResult> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured")
  }

  const isProduction = process.env.NODE_ENV === "production"
  const cookieName = isProduction
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"

  const domain = isProduction
    ? process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).hostname
      : "equinet.vercel.app"
    : "localhost"

  const maxAge = 24 * 60 * 60 // 24h, matches auth.config.ts:54
  const now = Math.floor(Date.now() / 1000)

  const encodedSecret = new TextEncoder().encode(secret)
  const jwt = await new SignJWT({
    sub: user.id,
    id: user.id,
    name: user.name,
    userType: user.userType,
    isAdmin: user.isAdmin,
    providerId: user.providerId,
    iat: now,
    exp: now + maxAge,
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(encodedSecret)

  return {
    name: cookieName,
    value: jwt,
    maxAge,
    secure: isProduction,
    domain,
  }
}
