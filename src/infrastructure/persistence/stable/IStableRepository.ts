/**
 * IStableRepository - Repository interface for Stable aggregate
 *
 * Defines data access operations for stables and stable spots.
 * Domain layer depends on this interface, not the implementation.
 */

export interface Stable {
  id: string
  userId: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  municipality: string | null
  latitude: number | null
  longitude: number | null
  contactEmail: string | null
  contactPhone: string | null
  profileImageUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface StableWithCounts extends Stable {
  _count: {
    spots: number
    availableSpots: number
  }
}

export interface StableSpot {
  id: string
  stableId: string
  label: string | null
  status: string
  pricePerMonth: number | null
  availableFrom: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface StableFilters {
  municipality?: string
  city?: string
  search?: string
  hasAvailableSpots?: boolean
  isActive?: boolean
}

export interface CreateStableData {
  userId: string
  name: string
  description?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  municipality?: string | null
  latitude?: number | null
  longitude?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
}

export interface UpdateStableData {
  name?: string
  description?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  municipality?: string | null
  latitude?: number | null
  longitude?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
}

export interface CreateStableSpotData {
  stableId: string
  label?: string | null
  status?: string
  pricePerMonth?: number | null
  availableFrom?: Date | null
  notes?: string | null
}

export interface UpdateStableSpotData {
  label?: string | null
  status?: string
  pricePerMonth?: number | null
  availableFrom?: Date | null
  notes?: string | null
}

export interface IStableRepository {
  // Stable CRUD
  create(data: CreateStableData): Promise<Stable>
  findById(id: string): Promise<Stable | null>
  findByUserId(userId: string): Promise<Stable | null>
  updateByUserId(userId: string, data: UpdateStableData): Promise<Stable | null>

  // Public queries
  findPublicById(id: string): Promise<StableWithCounts | null>
  findAll(filters: StableFilters): Promise<StableWithCounts[]>

  // Spots CRUD
  createSpot(data: CreateStableSpotData): Promise<StableSpot>
  findSpotById(id: string): Promise<StableSpot | null>
  findSpotsByStableId(stableId: string): Promise<StableSpot[]>
  updateSpot(id: string, stableId: string, data: UpdateStableSpotData): Promise<StableSpot | null>
  deleteSpot(id: string, stableId: string): Promise<boolean>
  countSpots(stableId: string): Promise<{ total: number; available: number }>
}
