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
  bookingDate: Date
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  horseName?: string
  horseInfo?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface IBookingRepository extends IRepository<Booking> {
  /**
   * Find all bookings for a customer
   */
  findByCustomerId(customerId: string): Promise<Booking[]>

  /**
   * Find all bookings for a provider
   */
  findByProviderId(providerId: string): Promise<Booking[]>

  /**
   * Find bookings that overlap with a given time slot
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
}
