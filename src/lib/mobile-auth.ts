/**
 * Mobile auth helper - Bearer token authentication for iOS widget and native screens.
 *
 * Extracts Bearer token from Authorization header, verifies via MobileTokenService.
 * Used by /api/widget/* and /api/auth/mobile-token/refresh endpoints.
 */
import { MobileTokenService } from "@/domain/auth/MobileTokenService"
import { mobileTokenRepository } from "@/infrastructure/persistence/mobile-token"

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
