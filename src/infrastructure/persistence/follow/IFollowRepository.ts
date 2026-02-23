/**
 * IFollowRepository - Repository interface for Follow aggregate
 *
 * Defines data access operations for customer->provider follows.
 * Used for route announcement notifications.
 */

export interface Follow {
  id: string
  customerId: string
  providerId: string
  createdAt: Date
}

export interface FollowWithProvider extends Follow {
  provider: {
    id: string
    businessName: string
    profileImageUrl: string | null
  }
}

export interface FollowerInfo {
  userId: string
  email: string
  firstName: string
}

export interface IFollowRepository {
  create(customerId: string, providerId: string): Promise<Follow>
  delete(customerId: string, providerId: string): Promise<boolean>
  findByCustomerAndProvider(customerId: string, providerId: string): Promise<Follow | null>
  findByCustomerIdWithProvider(customerId: string): Promise<FollowWithProvider[]>
  findFollowersInMunicipality(providerId: string, municipality: string): Promise<FollowerInfo[]>
  countByProvider(providerId: string): Promise<number>
}
