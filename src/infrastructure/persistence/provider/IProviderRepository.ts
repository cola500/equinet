/**
 * IProviderRepository - Repository interface for Provider aggregate
 *
 * Defines data access operations for providers.
 * Domain layer depends on this interface, not the implementation.
 */
import { IRepository } from '../BaseRepository'

// Provider entity type (simplified for MVP)
// Will be replaced with proper Domain Entity in future sprints
export interface Provider {
  id: string
  userId: string
  businessName: string
  description: string | null
  city: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ProviderFilters {
  city?: string
  isActive?: boolean
  search?: string // Search in businessName or description
}

export interface IProviderRepository extends IRepository<Provider> {
  /**
   * Find all providers with optional filters
   */
  findAll(filters?: ProviderFilters): Promise<Provider[]>

  /**
   * Find provider by user ID
   */
  findByUserId(userId: string): Promise<Provider | null>
}
