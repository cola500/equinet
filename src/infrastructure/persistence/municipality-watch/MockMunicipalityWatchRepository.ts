/**
 * MockMunicipalityWatchRepository - In-memory implementation for testing
 */
import { randomUUID } from "crypto"
import type { FollowerInfo } from "@/infrastructure/persistence/follow/IFollowRepository"
import type {
  IMunicipalityWatchRepository,
  MunicipalityWatch,
} from "./IMunicipalityWatchRepository"

interface MockUserData {
  email: string
  firstName: string
}

export class MockMunicipalityWatchRepository implements IMunicipalityWatchRepository {
  private watches: Map<string, MunicipalityWatch> = new Map()
  private users: Map<string, MockUserData> = new Map()

  /** Test helper: set user data for watcher matching */
  setUserData(userId: string, data: MockUserData): void {
    this.users.set(userId, data)
  }

  private compositeKey(customerId: string, municipality: string, serviceTypeName: string): string {
    return `${customerId}:${municipality}:${serviceTypeName}`
  }

  async create(
    customerId: string,
    municipality: string,
    serviceTypeName: string
  ): Promise<MunicipalityWatch> {
    const key = this.compositeKey(customerId, municipality, serviceTypeName)
    const existing = this.watches.get(key)
    if (existing) return existing

    const watch: MunicipalityWatch = {
      id: randomUUID(),
      customerId,
      municipality,
      serviceTypeName,
      createdAt: new Date(),
    }
    this.watches.set(key, watch)
    return watch
  }

  async delete(id: string, customerId: string): Promise<boolean> {
    for (const [key, watch] of this.watches.entries()) {
      if (watch.id === id && watch.customerId === customerId) {
        this.watches.delete(key)
        return true
      }
    }
    return false
  }

  async findByCustomerId(customerId: string): Promise<MunicipalityWatch[]> {
    return Array.from(this.watches.values()).filter(
      (w) => w.customerId === customerId
    )
  }

  async countByCustomerId(customerId: string): Promise<number> {
    let count = 0
    for (const watch of this.watches.values()) {
      if (watch.customerId === customerId) count++
    }
    return count
  }

  async findWatchersForAnnouncement(
    municipality: string,
    serviceTypeNames: string[]
  ): Promise<FollowerInfo[]> {
    const lowerNames = serviceTypeNames.map((n) => n.toLowerCase())
    const seen = new Set<string>()
    const result: FollowerInfo[] = []

    for (const watch of this.watches.values()) {
      if (watch.municipality !== municipality) continue
      if (!lowerNames.includes(watch.serviceTypeName.toLowerCase())) continue
      if (seen.has(watch.customerId)) continue

      seen.add(watch.customerId)
      const userData = this.users.get(watch.customerId)
      if (!userData) continue

      result.push({
        userId: watch.customerId,
        email: userData.email,
        firstName: userData.firstName,
      })
    }
    return result
  }
}
