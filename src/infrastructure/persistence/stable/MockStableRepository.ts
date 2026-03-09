/**
 * MockStableRepository - In-memory test double for IStableRepository
 */
import type {
  IStableRepository,
  Stable,
  StableWithCounts,
  StableSpot,
  StableFilters,
  CreateStableData,
  UpdateStableData,
  CreateStableSpotData,
  UpdateStableSpotData,
} from "./IStableRepository"
import { randomUUID } from "crypto"

export class MockStableRepository implements IStableRepository {
  private stables = new Map<string, Stable>()
  private spots = new Map<string, StableSpot>()

  // Test helpers
  clear(): void {
    this.stables.clear()
    this.spots.clear()
  }

  getAllStables(): Stable[] {
    return Array.from(this.stables.values())
  }

  getAllSpots(): StableSpot[] {
    return Array.from(this.spots.values())
  }

  // Stable CRUD
  async create(data: CreateStableData): Promise<Stable> {
    const now = new Date()
    const stable: Stable = {
      id: randomUUID(),
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      postalCode: data.postalCode ?? null,
      municipality: data.municipality ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      profileImageUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    this.stables.set(stable.id, stable)
    return stable
  }

  async findById(id: string): Promise<Stable | null> {
    return this.stables.get(id) ?? null
  }

  async findByUserId(userId: string): Promise<Stable | null> {
    for (const stable of this.stables.values()) {
      if (stable.userId === userId) return stable
    }
    return null
  }

  async updateByUserId(userId: string, data: UpdateStableData): Promise<Stable | null> {
    const stable = await this.findByUserId(userId)
    if (!stable) return null

    const updated: Stable = {
      ...stable,
      ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      updatedAt: new Date(),
    }
    this.stables.set(updated.id, updated)
    return updated
  }

  async findPublicById(id: string): Promise<StableWithCounts | null> {
    const stable = this.stables.get(id)
    if (!stable || !stable.isActive) return null
    const counts = await this.countSpots(id)
    return {
      ...stable,
      _count: { spots: counts.total, availableSpots: counts.available },
    }
  }

  async findAll(filters: StableFilters): Promise<StableWithCounts[]> {
    let results = Array.from(this.stables.values())

    if (filters.isActive !== undefined) {
      results = results.filter((s) => s.isActive === filters.isActive)
    }
    if (filters.municipality) {
      results = results.filter(
        (s) => s.municipality?.toLowerCase() === filters.municipality!.toLowerCase()
      )
    }
    if (filters.city) {
      results = results.filter(
        (s) => s.city?.toLowerCase() === filters.city!.toLowerCase()
      )
    }
    if (filters.search) {
      const term = filters.search.toLowerCase()
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.description?.toLowerCase().includes(term)
      )
    }
    if (filters.hasAvailableSpots) {
      const withSpots: Stable[] = []
      for (const s of results) {
        const counts = await this.countSpots(s.id)
        if (counts.available > 0) withSpots.push(s)
      }
      results = withSpots
    }

    const withCounts: StableWithCounts[] = []
    for (const s of results) {
      const counts = await this.countSpots(s.id)
      withCounts.push({
        ...s,
        _count: { spots: counts.total, availableSpots: counts.available },
      })
    }
    return withCounts
  }

  // Spots CRUD
  async createSpot(data: CreateStableSpotData): Promise<StableSpot> {
    const now = new Date()
    const spot: StableSpot = {
      id: randomUUID(),
      stableId: data.stableId,
      label: data.label ?? null,
      status: data.status ?? "available",
      pricePerMonth: data.pricePerMonth ?? null,
      availableFrom: data.availableFrom ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.spots.set(spot.id, spot)
    return spot
  }

  async findSpotById(id: string): Promise<StableSpot | null> {
    return this.spots.get(id) ?? null
  }

  async findSpotsByStableId(stableId: string): Promise<StableSpot[]> {
    return Array.from(this.spots.values()).filter((s) => s.stableId === stableId)
  }

  async updateSpot(id: string, stableId: string, data: UpdateStableSpotData): Promise<StableSpot | null> {
    const spot = this.spots.get(id)
    if (!spot || spot.stableId !== stableId) return null

    const updated: StableSpot = {
      ...spot,
      ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      updatedAt: new Date(),
    }
    this.spots.set(updated.id, updated)
    return updated
  }

  async deleteSpot(id: string, stableId: string): Promise<boolean> {
    const spot = this.spots.get(id)
    if (!spot || spot.stableId !== stableId) return false
    this.spots.delete(id)
    return true
  }

  async countSpots(stableId: string): Promise<{ total: number; available: number }> {
    const spots = Array.from(this.spots.values()).filter((s) => s.stableId === stableId)
    return {
      total: spots.length,
      available: spots.filter((s) => s.status === "available").length,
    }
  }
}
