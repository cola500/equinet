/**
 * MockBookingRepository - In-memory implementation for testing
 *
 * Useful for unit tests where we don't want database dependencies.
 */
import { BaseRepository } from '../BaseRepository'
import { IBookingRepository, Booking } from './IBookingRepository'

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
}
