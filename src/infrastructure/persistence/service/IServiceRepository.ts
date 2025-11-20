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
}
