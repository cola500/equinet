/**
 * FollowService - Domain service for customer->provider follows
 *
 * Handles follow/unfollow logic with provider validation.
 */
import type {
  IFollowRepository,
  Follow,
  FollowWithProvider,
} from "@/infrastructure/persistence/follow/IFollowRepository"

type FollowError = "PROVIDER_NOT_FOUND" | "PROVIDER_INACTIVE"

type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

interface ProviderLookup {
  findProvider(id: string): Promise<{ isActive: boolean } | null>
}

export class FollowService {
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly providers: ProviderLookup
  ) {}

  async follow(customerId: string, providerId: string): Promise<Result<Follow, FollowError>> {
    const provider = await this.providers.findProvider(providerId)
    if (!provider) {
      return { ok: false, error: "PROVIDER_NOT_FOUND" }
    }
    if (!provider.isActive) {
      return { ok: false, error: "PROVIDER_INACTIVE" }
    }

    const follow = await this.followRepo.create(customerId, providerId)
    return { ok: true, value: follow }
  }

  async unfollow(customerId: string, providerId: string): Promise<Result<void, never>> {
    await this.followRepo.delete(customerId, providerId)
    return { ok: true, value: undefined }
  }

  async isFollowing(customerId: string, providerId: string): Promise<boolean> {
    const follow = await this.followRepo.findByCustomerAndProvider(customerId, providerId)
    return follow !== null
  }

  async getFollowedProviders(customerId: string): Promise<FollowWithProvider[]> {
    return this.followRepo.findByCustomerIdWithProvider(customerId)
  }

  async getFollowerCount(providerId: string): Promise<number> {
    return this.followRepo.countByProvider(providerId)
  }
}
