/**
 * IBookingRepository - Repository interface for Booking aggregate
 *
 * Defines data access operations for bookings.
 * Domain layer depends on this interface, not the implementation.
 */
import { IRepository } from '../BaseRepository'

// Placeholder for Booking entity (will be created in Sprint 2)
// For now, we use a simple type to make the code compile
export interface Booking {
  id: string
  customerId: string
  providerId: string
  serviceId: string
  routeOrderId?: string
  bookingDate: Date
  startTime: string
  endTime: string
  timezone: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  horseId?: string
  horseName?: string
  horseInfo?: string
  notes?: string
  /** Calculated travel time to this booking (minutes) */
  travelTimeMinutes?: number
  /** Whether this booking was created manually by a provider */
  isManualBooking?: boolean
  /** Provider ID that created this manual booking */
  createdByProviderId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * CreateBookingData - Data required to create a new booking
 *
 * Used by createWithOverlapCheck for atomic booking creation.
 */
export interface CreateBookingData {
  customerId: string
  providerId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  endTime: string
  routeOrderId?: string
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  /** Calculated travel time to this booking (minutes) */
  travelTimeMinutes?: number
  /** Whether this booking was created manually by a provider */
  isManualBooking?: boolean
  /** Provider ID that created this manual booking */
  createdByProviderId?: string
  /** Initial status override (default: 'pending', manual bookings use 'confirmed') */
  status?: 'pending' | 'confirmed'
}

/**
 * BookingWithCustomerLocation - Booking with customer location for travel time calculations
 *
 * Used by findByProviderAndDateWithLocation for fetching bookings with
 * their associated customer locations.
 */
export interface BookingWithCustomerLocation {
  id: string
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  customer: {
    latitude: number | null
    longitude: number | null
    address: string | null
  }
}

/**
 * BookingWithRelations - DTO for API layer (CQRS Query Side)
 *
 * Denormalized view that includes related entities for UI needs.
 * Used by query methods, NOT by domain logic.
 *
 * Security:
 * - Provider view: includes customer contact info (email, phone)
 * - Customer view: excludes provider contact info
 */
export interface BookingWithRelations {
  // Core booking fields
  id: string
  customerId: string
  providerId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  isManualBooking?: boolean
  createdByProviderId?: string
  createdAt: Date
  updatedAt: Date

  // Relations data (selectively loaded based on user type)
  customer?: {
    firstName: string
    lastName: string
    email?: string // Only for provider view
    phone?: string // Only for provider view
  }
  service?: {
    name: string
    price: number
    durationMinutes: number
  }
  provider?: {
    businessName: string
    user?: {
      firstName: string
      lastName: string
      // NEVER includes email/phone in customer view
    }
  }
  // Horse information (when horseId is linked)
  horse?: {
    id: string
    name: string
    breed?: string | null
    gender?: string | null
  } | null
  // Payment information (for customer view)
  payment?: {
    id: string
    status: string
    amount: number
    currency: string
    paidAt: Date | null
    invoiceNumber: string | null
    invoiceUrl: string | null
  } | null
}

export interface IBookingRepository extends IRepository<Booking> {
  // ==========================================
  // COMMAND SIDE (Pure Aggregate)
  // ==========================================
  // Inherited from IRepository<Booking>:
  // - findById(id: string): Promise<Booking | null>
  // - findMany(criteria?: Record<string, any>): Promise<Booking[]>
  // - save(entity: Booking): Promise<Booking>
  // - delete(id: string): Promise<void>

  /**
   * Find all bookings for a customer (pure aggregate, no relations)
   */
  findByCustomerId(customerId: string): Promise<Booking[]>

  /**
   * Find all bookings for a provider (pure aggregate, no relations)
   */
  findByProviderId(providerId: string): Promise<Booking[]>

  /**
   * Find bookings that overlap with a given time slot
   * Used for overlap validation in domain logic
   */
  findOverlapping(
    providerId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<Booking[]>

  /**
   * Find bookings by status
   */
  findByStatus(status: Booking['status']): Promise<Booking[]>

  /**
   * Find bookings for a provider on a specific date
   */
  findByProviderAndDate(providerId: string, date: Date): Promise<Booking[]>

  /**
   * Find bookings for a provider on a specific date with customer location data
   *
   * Used for travel time validation between bookings.
   * Only returns active bookings (pending, confirmed).
   *
   * @param providerId - Provider ID
   * @param date - The booking date
   * @returns Bookings with customer location (lat, lng, address)
   */
  findByProviderAndDateWithLocation(
    providerId: string,
    date: Date
  ): Promise<BookingWithCustomerLocation[]>

  /**
   * Create booking with atomic overlap check (Serializable transaction)
   *
   * Uses database-level isolation to prevent race conditions where
   * two requests check for overlaps simultaneously and both succeed.
   *
   * @param data - Booking data to create
   * @returns Created booking with relations, or null if overlap detected
   */
  createWithOverlapCheck(data: CreateBookingData): Promise<BookingWithRelations | null>

  // ==========================================
  // QUERY SIDE (Denormalized DTOs for API)
  // ==========================================

  /**
   * Find bookings for a provider with customer + service details
   *
   * Provider view - includes customer contact info (email, phone)
   * for business communication purposes.
   *
   * Performance: Single query (10-40x faster than N+1)
   * Security: Customer email/phone visible to provider
   *
   * @param providerId - Provider ID
   * @returns Bookings with customer contact info and service details
   */
  findByProviderIdWithDetails(providerId: string): Promise<BookingWithRelations[]>

  /**
   * Find bookings for a customer with provider + service details
   *
   * Customer view - excludes provider contact info (email, phone)
   * to prevent spam/unsolicited contact.
   *
   * Performance: Single query (10-40x faster than N+1)
   * Security: Provider email/phone NOT visible to customer
   *
   * @param customerId - Customer ID
   * @returns Bookings with provider info (no contact) and service details
   */
  findByCustomerIdWithDetails(customerId: string): Promise<BookingWithRelations[]>

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Authorization context for booking operations
   * Uses atomic WHERE clause to prevent IDOR vulnerabilities
   */
  // (defined inline below)

  /**
   * Update booking status with atomic authorization check
   *
   * @param id - Booking ID
   * @param status - New status
   * @param authContext - Either providerId or customerId for authorization
   * @returns Updated booking with relations, or null if not found/unauthorized
   */
  updateStatusWithAuth(
    id: string,
    status: Booking['status'],
    authContext: { providerId?: string; customerId?: string }
  ): Promise<BookingWithRelations | null>

  /**
   * Delete booking with atomic authorization check
   *
   * @param id - Booking ID
   * @param authContext - Either providerId or customerId for authorization
   * @returns true if deleted, false if not found/unauthorized
   */
  deleteWithAuth(
    id: string,
    authContext: { providerId?: string; customerId?: string }
  ): Promise<boolean>
}
