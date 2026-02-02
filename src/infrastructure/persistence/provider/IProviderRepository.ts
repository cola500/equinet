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
  city: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ProviderFilters {
  city?: string
  isActive?: boolean
  search?: string // Search in businessName or description
  boundingBox?: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }
}

// Provider with services and user details (for public API)
export interface ProviderWithDetails extends Provider {
  latitude?: number | null
  longitude?: number | null
  serviceAreaKm?: number | null
  profileImageUrl?: string | null
  isVerified: boolean
  services: Array<{
    id: string
    name: string
    price: number
  }>
  user: {
    firstName: string
    lastName: string
  }
}

export interface IProviderRepository extends IRepository<Provider> {
  /**
   * Find all providers with optional filters
   */
  findAll(filters?: ProviderFilters): Promise<Provider[]>

  /**
   * Find all providers with services and user details (for public API)
   */
  findAllWithDetails(filters?: ProviderFilters): Promise<ProviderWithDetails[]>

  /**
   * Find provider by user ID
   */
  findByUserId(userId: string): Promise<Provider | null>

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Find provider by ID with full details for public API
   * Only returns active providers with active services
   */
  findByIdWithPublicDetails(id: string): Promise<ProviderWithFullDetails | null>

  /**
   * Find provider by ID for owner (includes all fields for editing)
   *
   * @param id - Provider ID
   * @param userId - User ID for authorization
   * @returns Provider if found and user owns it, null otherwise
   */
  findByIdForOwner(id: string, userId: string): Promise<ProviderForEdit | null>

  /**
   * Update provider with atomic authorization check
   *
   * @param id - Provider ID
   * @param data - Fields to update
   * @param userId - User ID for authorization
   * @returns Updated provider, or null if not found/unauthorized
   */
  updateWithAuth(
    id: string,
    data: Partial<Omit<Provider, 'id' | 'userId' | 'createdAt'>>,
    userId: string
  ): Promise<Provider | null>
}

// Provider with full public details (for single provider view)
export interface ProviderWithFullDetails extends Provider {
  latitude?: number | null
  longitude?: number | null
  serviceAreaKm?: number | null
  profileImageUrl?: string | null
  isVerified: boolean
  verifiedAt?: Date | null
  address?: string | null
  postalCode?: string | null
  services: Array<{
    id: string
    name: string
    price: number
    durationMinutes: number
  }>
  availability: Array<{
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    isActive: boolean
  }>
  verifications?: Array<{
    id: string
    type: string
    title: string
    description: string | null
    issuer: string | null
    year: number | null
    status: string
    images: Array<{
      id: string
      url: string
    }>
  }>
  user: {
    firstName: string
    lastName: string
    phone: string | null
  }
}

// Provider for editing (owner view)
export interface ProviderForEdit {
  id: string
  userId: string
  address: string | null
  city: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
}
