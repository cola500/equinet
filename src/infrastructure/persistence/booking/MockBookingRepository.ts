/**
 * MockBookingRepository - In-memory implementation for testing
 *
 * Useful for unit tests where we don't want database dependencies.
 */
import { BaseRepository } from '../BaseRepository'
import {
  IBookingRepository,
  Booking,
  BookingWithRelations,
} from './IBookingRepository'

export class MockBookingRepository
  extends BaseRepository<Booking>
  implements IBookingRepository
{
  private bookings: Map<string, Booking> = new Map()

  constructor(initialData: Booking[] = []) {
    super()
    initialData.forEach((booking) => {
      this.bookings.set(booking.id, booking)
    })
  }

  async findById(id: string): Promise<Booking | null> {
    return this.bookings.get(id) ?? null
  }

  async findMany(criteria?: Record<string, any>): Promise<Booking[]> {
    let results = Array.from(this.bookings.values())

    if (criteria) {
      results = results.filter((booking) => {
        return Object.entries(criteria).every(([key, value]) => {
          return (booking as any)[key] === value
        })
      })
    }

    return results.sort(
      (a, b) => b.bookingDate.getTime() - a.bookingDate.getTime()
    )
  }

  async save(entity: Booking): Promise<Booking> {
    this.bookings.set(entity.id, { ...entity })
    return entity
  }

  async delete(id: string): Promise<void> {
    this.bookings.delete(id)
  }

  async findByCustomerId(customerId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values())
      .filter((b) => b.customerId === customerId)
      .sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime())
  }

  async findByProviderId(providerId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values())
      .filter((b) => b.providerId === providerId)
      .sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime())
  }

  async findOverlapping(
    providerId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<Booking[]> {
    const dateStr = date.toISOString().split('T')[0]

    return Array.from(this.bookings.values()).filter((booking) => {
      // Must be same provider
      if (booking.providerId !== providerId) return false

      // Must be same date
      const bookingDateStr = booking.bookingDate.toISOString().split('T')[0]
      if (bookingDateStr !== dateStr) return false

      // Must be active status
      if (!['pending', 'confirmed'].includes(booking.status)) return false

      // Check time overlap
      const bookingStart = this.parseTime(booking.startTime)
      const bookingEnd = this.parseTime(booking.endTime)
      const requestStart = this.parseTime(startTime)
      const requestEnd = this.parseTime(endTime)

      return bookingStart < requestEnd && requestStart < bookingEnd
    })
  }

  async findByStatus(status: Booking['status']): Promise<Booking[]> {
    return Array.from(this.bookings.values())
      .filter((b) => b.status === status)
      .sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime())
  }

  async findByProviderAndDate(providerId: string, date: Date): Promise<Booking[]> {
    const dateStr = date.toISOString().split('T')[0]

    return Array.from(this.bookings.values())
      .filter((b) => {
        const bookingDateStr = b.bookingDate.toISOString().split('T')[0]
        return b.providerId === providerId && bookingDateStr === dateStr
      })
      .sort((a, b) => this.parseTime(a.startTime) - this.parseTime(b.startTime))
  }

  /**
   * Clear all bookings (useful for test cleanup)
   */
  clear(): void {
    this.bookings.clear()
  }

  /**
   * Get all bookings (useful for test assertions)
   */
  getAll(): Booking[] {
    return Array.from(this.bookings.values())
  }

  /**
   * Parse time string "HH:MM" to minutes since midnight
   */
  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // ==========================================
  // QUERY METHODS (CQRS Query Side)
  // ==========================================

  /**
   * Find bookings for a provider with mock relations data
   *
   * Note: Mock implementation returns minimal mock data for relations.
   * For realistic testing, use test fixtures with proper relations setup.
   */
  async findByProviderIdWithDetails(
    providerId: string
  ): Promise<BookingWithRelations[]> {
    const bookings = await this.findByProviderId(providerId)

    // Transform to BookingWithRelations with mock relations data
    return bookings.map((booking) => ({
      ...booking,
      // Mock customer data (provider view includes contact info)
      customer: {
        firstName: 'Mock',
        lastName: 'Customer',
        email: `customer-${booking.customerId}@example.com`,
        phone: '+46701234567',
      },
      // Mock service data
      service: {
        name: 'Mock Service',
        price: 500,
        durationMinutes: 60,
      },
      // No provider relation (provider already knows their own data)
    }))
  }

  /**
   * Find bookings for a customer with mock relations data
   *
   * Note: Mock implementation returns minimal mock data for relations.
   * For realistic testing, use test fixtures with proper relations setup.
   */
  async findByCustomerIdWithDetails(
    customerId: string
  ): Promise<BookingWithRelations[]> {
    const bookings = await this.findByCustomerId(customerId)

    // Transform to BookingWithRelations with mock relations data
    return bookings.map((booking) => ({
      ...booking,
      // No customer relation (customer already knows their own data)
      // Mock provider data (customer view excludes contact info)
      provider: {
        businessName: 'Mock Provider AB',
        user: {
          firstName: 'Mock',
          lastName: 'Provider',
          // NO email/phone in customer view
        },
      },
      // Mock service data
      service: {
        name: 'Mock Service',
        price: 500,
        durationMinutes: 60,
      },
    }))
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  async updateStatusWithAuth(
    id: string,
    status: Booking['status'],
    authContext: { providerId?: string; customerId?: string }
  ): Promise<BookingWithRelations | null> {
    const booking = this.bookings.get(id)
    if (!booking) return null

    // Check authorization
    if (authContext.providerId && booking.providerId !== authContext.providerId) {
      return null
    }
    if (authContext.customerId && booking.customerId !== authContext.customerId) {
      return null
    }

    // Update status
    const updated = { ...booking, status, updatedAt: new Date() }
    this.bookings.set(id, updated)

    // Return with mock relations
    return {
      ...updated,
      customer: {
        firstName: 'Mock',
        lastName: 'Customer',
        email: `customer-${updated.customerId}@example.com`,
      },
      service: {
        name: 'Mock Service',
        price: 500,
        durationMinutes: 60,
      },
      provider: {
        businessName: 'Mock Provider AB',
        user: { firstName: 'Mock', lastName: 'Provider' },
      },
    }
  }

  async deleteWithAuth(
    id: string,
    authContext: { providerId?: string; customerId?: string }
  ): Promise<boolean> {
    const booking = this.bookings.get(id)
    if (!booking) return false

    // Check authorization
    if (authContext.providerId && booking.providerId !== authContext.providerId) {
      return false
    }
    if (authContext.customerId && booking.customerId !== authContext.customerId) {
      return false
    }

    this.bookings.delete(id)
    return true
  }
}
