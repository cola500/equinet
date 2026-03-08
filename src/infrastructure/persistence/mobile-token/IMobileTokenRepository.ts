/**
 * IMobileTokenRepository - Repository interface for MobileToken aggregate
 *
 * Defines data access operations for mobile API tokens (iOS widget, native screens).
 * Token field stores SHA-256 hash, never plaintext JWT.
 */

export interface MobileToken {
  id: string
  token: string // SHA-256 hash of JWT
  userId: string
  deviceName: string | null
  lastUsedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
  createdAt: Date
}

export interface CreateMobileTokenData {
  token: string // SHA-256 hash
  userId: string
  deviceName?: string
  expiresAt: Date
}

export interface IMobileTokenRepository {
  create(data: CreateMobileTokenData): Promise<MobileToken>
  findByTokenHash(tokenHash: string): Promise<MobileToken | null>
  findById(id: string): Promise<MobileToken | null>
  updateLastUsedAt(id: string): Promise<void>
  revoke(id: string): Promise<void>
  revokeAndCreate(
    revokeId: string,
    data: CreateMobileTokenData
  ): Promise<MobileToken>
  revokeAllForUser(userId: string): Promise<number>
  countActiveForUser(userId: string): Promise<number>
}
