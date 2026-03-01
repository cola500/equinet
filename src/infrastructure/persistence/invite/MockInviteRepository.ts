/**
 * MockInviteRepository - In-memory implementation for testing
 */
import type {
  IInviteRepository,
  CreateInviteTokenData,
  InviteTokenWithUser,
} from './IInviteRepository'

interface StoredInviteToken {
  id: string
  token: string
  userId: string
  invitedByProviderId: string
  expiresAt: Date
  usedAt: Date | null
}

interface StoredUser {
  id: string
  email: string
  firstName: string
  isManualCustomer: boolean
  passwordHash: string
  emailVerified: boolean
}

export class MockInviteRepository implements IInviteRepository {
  private tokens: Map<string, StoredInviteToken> = new Map()
  private users: Map<string, StoredUser> = new Map()
  private idCounter = 0

  async createInviteToken(data: CreateInviteTokenData): Promise<void> {
    const id = `invite-token-${++this.idCounter}`
    this.tokens.set(id, {
      id,
      token: data.token,
      userId: data.userId,
      invitedByProviderId: data.invitedByProviderId,
      expiresAt: data.expiresAt,
      usedAt: null,
    })
  }

  async findInviteToken(token: string): Promise<InviteTokenWithUser | null> {
    for (const stored of this.tokens.values()) {
      if (stored.token === token) {
        const user = this.users.get(stored.userId)
        if (!user) return null
        return {
          id: stored.id,
          token: stored.token,
          userId: stored.userId,
          expiresAt: stored.expiresAt,
          usedAt: stored.usedAt,
          userEmail: user.email,
          userFirstName: user.firstName,
          isManualCustomer: user.isManualCustomer,
        }
      }
    }
    return null
  }

  async invalidatePendingInvites(userId: string): Promise<void> {
    for (const stored of this.tokens.values()) {
      if (stored.userId === userId && !stored.usedAt) {
        stored.usedAt = new Date()
      }
    }
  }

  async acceptInvite(tokenId: string, userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId)
    if (user) {
      user.passwordHash = passwordHash
      user.isManualCustomer = false
      user.emailVerified = true
    }
    for (const stored of this.tokens.values()) {
      if (stored.id === tokenId) {
        stored.usedAt = new Date()
      }
    }
  }

  // -----------------------------------------------------------
  // Test helpers
  // -----------------------------------------------------------

  seedUser(user: StoredUser): void {
    this.users.set(user.id, user)
  }

  seedToken(token: StoredInviteToken): void {
    this.tokens.set(token.id, token)
  }

  getTokens(): StoredInviteToken[] {
    return Array.from(this.tokens.values())
  }

  getUsers(): StoredUser[] {
    return Array.from(this.users.values())
  }

  clear(): void {
    this.tokens.clear()
    this.users.clear()
    this.idCounter = 0
  }
}
