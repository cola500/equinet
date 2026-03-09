/**
 * StableService - Domain service for Stable aggregate
 *
 * Handles stable profile CRUD with business rules.
 * Constructor injection for testability.
 */
import { Result } from "@/domain/shared"
import type {
  IStableRepository,
  Stable,
  StableWithCounts,
  CreateStableData,
  UpdateStableData,
} from "@/infrastructure/persistence/stable/IStableRepository"

export type StableError = "ALREADY_EXISTS" | "NOT_FOUND"

export class StableService {
  constructor(private readonly repo: IStableRepository) {}

  async createStable(
    userId: string,
    data: Omit<CreateStableData, "userId">
  ): Promise<Result<Stable, StableError>> {
    // Check if user already has a stable
    const existing = await this.repo.findByUserId(userId)
    if (existing) {
      return Result.fail("ALREADY_EXISTS")
    }

    const stable = await this.repo.create({ userId, ...data })
    return Result.ok(stable)
  }

  async getByUserId(userId: string): Promise<Stable | null> {
    return this.repo.findByUserId(userId)
  }

  async getById(id: string): Promise<Stable | null> {
    return this.repo.findById(id)
  }

  async updateStable(
    userId: string,
    data: UpdateStableData
  ): Promise<Result<Stable, StableError>> {
    const updated = await this.repo.updateByUserId(userId, data)
    if (!updated) {
      return Result.fail("NOT_FOUND")
    }
    return Result.ok(updated)
  }

  async getPublicById(id: string): Promise<StableWithCounts | null> {
    return this.repo.findPublicById(id)
  }
}
