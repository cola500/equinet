/**
 * MobileTokenService - Domain service for mobile API tokens
 *
 * Handles JWT generation, verification, refresh (with rotation), and revocation
 * for iOS widget and future native screens. Stores SHA-256 hash of JWT in DB.
 *
 * JWT design:
 * - Signing: HMAC-SHA256 via jose
 * - Claims: { sub: userId, type: "mobile", jti: tokenId, iat, exp }
 * - Expiry: 90 days (configurable)
 * - DB storage: SHA-256 hash of JWT (never plaintext)
 */
import { SignJWT, jwtVerify } from "jose"
import { createHash, randomUUID } from "crypto"
import type { IMobileTokenRepository } from "@/infrastructure/persistence/mobile-token"
import { logger } from "@/lib/logger"

const MAX_ACTIVE_TOKENS_PER_USER = 5

export interface MobileTokenServiceDeps {
  repository: IMobileTokenRepository
  secret: string
  expiryDays?: number
}

export interface GenerateTokenResult {
  jwt: string
  expiresAt: Date
}

export interface VerifyTokenResult {
  userId: string
  tokenId: string
}

function hashToken(jwt: string): string {
  return createHash("sha256").update(jwt).digest("hex")
}

export class MobileTokenService {
  private readonly repo: IMobileTokenRepository
  private readonly secretKey: Uint8Array
  private readonly expiryDays: number

  constructor(deps: MobileTokenServiceDeps) {
    this.repo = deps.repository
    this.secretKey = new TextEncoder().encode(deps.secret)
    this.expiryDays = deps.expiryDays ?? 90
  }

  async generateToken(
    userId: string,
    deviceName?: string,
    options?: { skipMaxCheck?: boolean }
  ): Promise<GenerateTokenResult> {
    // Check max active tokens (skip during refresh -- old token is being revoked atomically)
    if (!options?.skipMaxCheck) {
      const activeCount = await this.repo.countActiveForUser(userId)
      if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) {
        throw new MaxTokensExceededError(userId)
      }
    }

    const tokenId = randomUUID()
    const expiresAt = new Date(
      Date.now() + this.expiryDays * 24 * 60 * 60 * 1000
    )

    const jwt = await new SignJWT({
      sub: userId,
      type: "mobile",
      jti: tokenId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.secretKey)

    const tokenHash = hashToken(jwt)

    await this.repo.create({
      token: tokenHash,
      userId,
      deviceName,
      expiresAt,
    })

    return { jwt, expiresAt }
  }

  async verifyToken(jwt: string): Promise<VerifyTokenResult | null> {
    try {
      const { payload } = await jwtVerify(jwt, this.secretKey, {
        algorithms: ["HS256"],
      })

      if (payload.type !== "mobile" || !payload.sub || !payload.jti) {
        return null
      }

      const tokenHash = hashToken(jwt)
      const storedToken = await this.repo.findByTokenHash(tokenHash)

      if (!storedToken) {
        return null
      }

      if (storedToken.revokedAt) {
        return null
      }

      if (storedToken.expiresAt < new Date()) {
        return null
      }

      // Update lastUsedAt (fire-and-forget)
      this.repo.updateLastUsedAt(storedToken.id).catch((err) => {
        logger.error("Failed to update lastUsedAt for mobile token", { error: err })
      })

      return {
        userId: payload.sub,
        tokenId: storedToken.id,
      }
    } catch {
      // Invalid JWT signature, expired, malformed, etc.
      return null
    }
  }

  async refreshToken(
    oldJwt: string
  ): Promise<GenerateTokenResult | null> {
    const verified = await this.verifyToken(oldJwt)
    if (!verified) {
      return null
    }

    // Generate new JWT
    const tokenId = randomUUID()
    const expiresAt = new Date(
      Date.now() + this.expiryDays * 24 * 60 * 60 * 1000
    )

    const jwt = await new SignJWT({
      sub: verified.userId,
      type: "mobile",
      jti: tokenId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.secretKey)

    const tokenHash = hashToken(jwt)

    // Atomic: revoke old + create new in single transaction
    await this.repo.revokeAndCreate(verified.tokenId, {
      token: tokenHash,
      userId: verified.userId,
      expiresAt,
    })

    return { jwt, expiresAt }
  }

  async revokeToken(tokenId: string, userId: string): Promise<void> {
    const token = await this.repo.findById(tokenId)
    if (token && token.userId === userId) {
      await this.repo.revoke(tokenId)
    }
  }

  async revokeAllForUser(userId: string): Promise<number> {
    return this.repo.revokeAllForUser(userId)
  }
}

export class MaxTokensExceededError extends Error {
  constructor(public readonly userId: string) {
    super(`Max antal aktiva tokens uppnått för användare ${userId}`)
    this.name = "MaxTokensExceededError"
  }
}
