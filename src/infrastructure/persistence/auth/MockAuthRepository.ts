/**
 * MockAuthRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * No database required.
 */
import type {
  IAuthRepository,
  AuthUser,
  AuthUserWithCredentials,
  UserForResend,
  VerificationTokenWithUser,
  CreateUserData,
  CreateProviderData,
  CreateVerificationTokenData,
} from './IAuthRepository'

interface StoredUser {
  id: string
  email: string
  firstName: string
  lastName: string
  userType: string
  passwordHash: string
  emailVerified: boolean
  phone?: string
}

interface StoredProvider {
  id: string
  userId: string
  businessName: string
  description?: string
  city?: string
}

interface StoredToken {
  id: string
  token: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

export class MockAuthRepository implements IAuthRepository {
  private users: Map<string, StoredUser> = new Map()
  private providers: Map<string, StoredProvider> = new Map()
  private tokens: Map<string, StoredToken> = new Map()
  private idCounter = 0

  // -----------------------------------------------------------
  // IAuthRepository implementation
  // -----------------------------------------------------------

  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return { id: user.id }
    }
    return null
  }

  async findUserWithCredentials(email: string): Promise<AuthUserWithCredentials | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        const provider = this.findProviderByUserId(user.id)
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          passwordHash: user.passwordHash,
          emailVerified: user.emailVerified,
          provider: provider ? { id: provider.id } : null,
        }
      }
    }
    return null
  }

  async findUserForResend(email: string): Promise<UserForResend | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return {
          id: user.id,
          firstName: user.firstName,
          email: user.email,
          emailVerified: user.emailVerified,
        }
      }
    }
    return null
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    const id = `user-${++this.idCounter}`
    const user: StoredUser = {
      id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      userType: data.userType,
      passwordHash: data.passwordHash,
      emailVerified: false,
      phone: data.phone,
    }
    this.users.set(id, user)
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
    }
  }

  async createProvider(data: CreateProviderData): Promise<void> {
    const id = `provider-${++this.idCounter}`
    this.providers.set(id, {
      id,
      userId: data.userId,
      businessName: data.businessName,
      description: data.description,
      city: data.city,
    })
  }

  async createVerificationToken(data: CreateVerificationTokenData): Promise<void> {
    const id = `token-${++this.idCounter}`
    this.tokens.set(id, {
      id,
      token: data.token,
      userId: data.userId,
      expiresAt: data.expiresAt,
      usedAt: null,
    })
  }

  async findVerificationToken(token: string): Promise<VerificationTokenWithUser | null> {
    for (const stored of this.tokens.values()) {
      if (stored.token === token) {
        const user = this.findUserById(stored.userId)
        if (!user) return null
        return {
          id: stored.id,
          token: stored.token,
          userId: stored.userId,
          expiresAt: stored.expiresAt,
          usedAt: stored.usedAt,
          userEmail: user.email,
        }
      }
    }
    return null
  }

  async verifyEmail(userId: string, tokenId: string): Promise<void> {
    const user = this.users.get(userId)
    if (user) {
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

  /**
   * Seed a user for testing (e.g., verify/resend without going through register)
   */
  seedUser(user: StoredUser): void {
    this.users.set(user.id, user)
  }

  /**
   * Seed a provider for testing
   */
  seedProvider(provider: StoredProvider): void {
    this.providers.set(provider.id, provider)
  }

  /**
   * Seed a verification token for testing
   */
  seedToken(token: StoredToken): void {
    this.tokens.set(token.id, token)
  }

  clear(): void {
    this.users.clear()
    this.providers.clear()
    this.tokens.clear()
    this.idCounter = 0
  }

  getUsers(): StoredUser[] {
    return Array.from(this.users.values())
  }

  getProviders(): StoredProvider[] {
    return Array.from(this.providers.values())
  }

  getTokens(): StoredToken[] {
    return Array.from(this.tokens.values())
  }

  // -----------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------

  private findUserById(id: string): StoredUser | undefined {
    return this.users.get(id)
  }

  private findProviderByUserId(userId: string): StoredProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.userId === userId) return provider
    }
    return undefined
  }
}
