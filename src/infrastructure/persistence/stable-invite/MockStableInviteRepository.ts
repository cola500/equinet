/**
 * MockStableInviteRepository - In-memory implementation for testing
 */
import type {
  IStableInviteRepository,
  CreateStableInviteData,
  StableInviteTokenWithStable,
  StableInviteListItem,
} from "./IStableInviteRepository"

export class MockStableInviteRepository implements IStableInviteRepository {
  private tokens: Map<string, StableInviteTokenWithStable> = new Map()
  private stableNames: Map<string, { name: string; municipality: string | null }> = new Map()

  seedStable(stableId: string, name: string, municipality: string | null = null) {
    this.stableNames.set(stableId, { name, municipality })
  }

  async create(data: CreateStableInviteData): Promise<void> {
    const stable = this.stableNames.get(data.stableId)
    this.tokens.set(data.token, {
      id: `invite-${Date.now()}`,
      token: data.token,
      email: data.email,
      stableId: data.stableId,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdAt: new Date(),
      stableName: stable?.name ?? "Test Stall",
      stableMunicipality: stable?.municipality ?? null,
    })
  }

  async findByToken(token: string): Promise<StableInviteTokenWithStable | null> {
    return this.tokens.get(token) ?? null
  }

  async findByStableId(stableId: string): Promise<StableInviteListItem[]> {
    return Array.from(this.tokens.values())
      .filter((t) => t.stableId === stableId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ id, email, expiresAt, usedAt, createdAt }) => ({
        id, email, expiresAt, usedAt, createdAt,
      }))
  }

  async invalidatePending(email: string, stableId: string): Promise<void> {
    for (const [key, token] of this.tokens) {
      if (token.email === email && token.stableId === stableId && !token.usedAt) {
        this.tokens.set(key, { ...token, usedAt: new Date() })
      }
    }
  }

  async markUsed(tokenId: string): Promise<void> {
    for (const [key, token] of this.tokens) {
      if (token.id === tokenId) {
        this.tokens.set(key, { ...token, usedAt: new Date() })
      }
    }
  }

  async revoke(id: string, stableId: string): Promise<boolean> {
    for (const [key, token] of this.tokens) {
      if (token.id === id && token.stableId === stableId && !token.usedAt) {
        this.tokens.set(key, { ...token, usedAt: new Date() })
        return true
      }
    }
    return false
  }

  clear() {
    this.tokens.clear()
    this.stableNames.clear()
  }
}
