/**
 * IServiceRepository - Repository interface for Service aggregate
 *
 * Defines data access operations for services.
 * Domain layer depends on this interface, not the implementation.
 */
import { IRepository } from '../BaseRepository'

// Service entity type (simplified for MVP)
// Will be replaced with proper Domain Entity in future sprints
export interface Service {
  id: string
  providerId: string
  name: string
  description: string | null
  price: number
  durationMinutes: number
  isActive: boolean
  createdAt: Date
}

export interface ServiceFilters {
  providerId?: string
  isActive?: boolean
  search?: string // Search in name or description
}

export interface IServiceRepository extends IRepository<Service> {
  /**
   * Find all services with optional filters
   */
  findAll(filters?: ServiceFilters): Promise<Service[]>

  /**
   * Find all services for a specific provider
   */
  findByProviderId(providerId: string): Promise<Service[]>

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Find service by ID only if it belongs to the provider
   *
   * @param id - Service ID
   * @param providerId - Provider ID for authorization
   * @returns Service if found and authorized, null otherwise
   */
  findByIdForProvider(id: string, providerId: string): Promise<Service | null>

  /**
   * Update service with atomic authorization check
   *
   * @param id - Service ID
   * @param data - Fields to update
   * @param providerId - Provider ID for authorization
   * @returns Updated service, or null if not found/unauthorized
   */
  updateWithAuth(
    id: string,
    data: Partial<Omit<Service, 'id' | 'providerId' | 'createdAt'>>,
    providerId: string
  ): Promise<Service | null>

  /**
   * Delete service with atomic authorization check
   *
   * @param id - Service ID
   * @param providerId - Provider ID for authorization
   * @returns true if deleted, false if not found/unauthorized
   */
  deleteWithAuth(id: string, providerId: string): Promise<boolean>
}
