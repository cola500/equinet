/**
 * MockFollowRepository - In-memory implementation for testing
 */
import { randomUUID } from "crypto"
import type {
  IFollowRepository,
  Follow,
  FollowWithProvider,
  FollowerInfo,
} from "./IFollowRepository"

interface MockUserData {
  email: string
  firstName: string
  municipality: string | null
}

export class MockFollowRepository implements IFollowRepository {
  private follows: Map<string, Follow> = new Map()
  private users: Map<string, MockUserData> = new Map()

  /** Test helper: set user data for municipality matching */
  setUserData(userId: string, data: MockUserData): void {
    this.users.set(userId, data)
  }

  private compositeKey(customerId: string, providerId: string): string {
    return `${customerId}:${providerId}`
  }

  async create(customerId: string, providerId: string): Promise<Follow> {
    const key = this.compositeKey(customerId, providerId)
    const existing = this.follows.get(key)
    if (existing) return existing

    const follow: Follow = {
      id: randomUUID(),
      customerId,
      providerId,
      createdAt: new Date(),
    }
    this.follows.set(key, follow)
    return follow
  }

  async delete(customerId: string, providerId: string): Promise<boolean> {
    const key = this.compositeKey(customerId, providerId)
    return this.follows.delete(key)
  }

  async findByCustomerAndProvider(
    customerId: string,
    providerId: string
  ): Promise<Follow | null> {
    const key = this.compositeKey(customerId, providerId)
    return this.follows.get(key) || null
  }

  async findByCustomerIdWithProvider(
    customerId: string
  ): Promise<FollowWithProvider[]> {
    const result: FollowWithProvider[] = []
    for (const follow of this.follows.values()) {
      if (follow.customerId === customerId) {
        result.push({
          ...follow,
          provider: {
            id: follow.providerId,
            businessName: `Provider ${follow.providerId}`,
            profileImageUrl: null,
          },
        })
      }
    }
    return result
  }

  async findFollowersInMunicipality(
    providerId: string,
    municipality: string
  ): Promise<FollowerInfo[]> {
    const result: FollowerInfo[] = []
    for (const follow of this.follows.values()) {
      if (follow.providerId !== providerId) continue
      const userData = this.users.get(follow.customerId)
      if (!userData || userData.municipality !== municipality) continue
      result.push({
        userId: follow.customerId,
        email: userData.email,
        firstName: userData.firstName,
      })
    }
    return result
  }

  async countByProvider(providerId: string): Promise<number> {
    let count = 0
    for (const follow of this.follows.values()) {
      if (follow.providerId === providerId) count++
    }
    return count
  }
}
