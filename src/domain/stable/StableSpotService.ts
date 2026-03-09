/**
 * StableSpotService - Domain service for StableSpot CRUD
 *
 * Handles spot management with ownership validation via stableId.
 */
import { Result } from "@/domain/shared"
import type {
  IStableRepository,
  StableSpot,
  CreateStableSpotData,
  UpdateStableSpotData,
} from "@/infrastructure/persistence/stable/IStableRepository"

export type SpotError = "NOT_FOUND"

export class StableSpotService {
  constructor(private readonly repo: IStableRepository) {}

  async createSpot(
    stableId: string,
    data: Omit<CreateStableSpotData, "stableId">
  ): Promise<Result<StableSpot, SpotError>> {
    const spot = await this.repo.createSpot({ stableId, ...data })
    return Result.ok(spot)
  }

  async getSpots(stableId: string): Promise<StableSpot[]> {
    return this.repo.findSpotsByStableId(stableId)
  }

  async updateSpot(
    spotId: string,
    stableId: string,
    data: UpdateStableSpotData
  ): Promise<Result<StableSpot, SpotError>> {
    const updated = await this.repo.updateSpot(spotId, stableId, data)
    if (!updated) {
      return Result.fail("NOT_FOUND")
    }
    return Result.ok(updated)
  }

  async deleteSpot(
    spotId: string,
    stableId: string
  ): Promise<Result<void, SpotError>> {
    const deleted = await this.repo.deleteSpot(spotId, stableId)
    if (!deleted) {
      return Result.fail("NOT_FOUND")
    }
    return Result.ok(undefined)
  }

  async getCounts(stableId: string): Promise<{ total: number; available: number }> {
    return this.repo.countSpots(stableId)
  }
}
