/**
 * MockMobileTokenRepository - In-memory implementation for testing
 */
import { randomUUID } from "crypto"
import type {
  IMobileTokenRepository,
  MobileToken,
  CreateMobileTokenData,
} from "./IMobileTokenRepository"

export class MockMobileTokenRepository implements IMobileTokenRepository {
  private tokens: Map<string, MobileToken> = new Map()

  async create(data: CreateMobileTokenData): Promise<MobileToken> {
    const token: MobileToken = {
      id: randomUUID(),
      token: data.token,
      userId: data.userId,
      deviceName: data.deviceName ?? null,
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    }
    this.tokens.set(token.id, token)
    return token
  }

  async findByTokenHash(tokenHash: string): Promise<MobileToken | null> {
    for (const token of this.tokens.values()) {
      if (token.token === tokenHash) return token
    }
    return null
  }

  async findById(id: string): Promise<MobileToken | null> {
    return this.tokens.get(id) ?? null
  }

  async updateLastUsedAt(id: string): Promise<void> {
    const token = this.tokens.get(id)
    if (token) {
      token.lastUsedAt = new Date()
    }
  }

  async revoke(id: string): Promise<void> {
    const token = this.tokens.get(id)
    if (token) {
      token.revokedAt = new Date()
    }
  }

  async revokeAndCreate(
    revokeId: string,
    data: CreateMobileTokenData
  ): Promise<MobileToken> {
    await this.revoke(revokeId)
    return this.create(data)
  }

  async countActiveForUser(userId: string): Promise<number> {
    const now = new Date()
    let count = 0
    for (const token of this.tokens.values()) {
      if (
        token.userId === userId &&
        !token.revokedAt &&
        token.expiresAt > now
      ) {
        count++
      }
    }
    return count
  }

  async revokeAllForUser(userId: string): Promise<number> {
    let count = 0
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = new Date()
        count++
      }
    }
    return count
  }
}
