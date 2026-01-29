/**
 * TravelTimeService - Domain service for travel time validation
 *
 * Validates that there's enough travel time between bookings based on
 * geographic locations. Uses Haversine distance with configurable
 * speed and margin.
 *
 * Business Rules:
 * - Minimum buffer: 60 min (1 timme mellan bokningar för förberedelse/efterarbete)
 * - Default fallback: 60 min (when location data is missing)
 * - Travel speed: 50 km/h average
 * - Margin factor: 1.2 (20% extra for real road distance vs straight line)
 */
import { Location } from '@/domain/shared/Location'

/**
 * Configuration for travel time calculations
 */
export interface TravelTimeConfig {
  /** Average travel speed in km/h (default: 50) */
  averageSpeedKmh?: number
  /** Minimum buffer between bookings in minutes (default: 60) */
  minBufferMinutes?: number
  /** Default buffer when location data is missing (default: 60) */
  defaultBufferMinutes?: number
  /** Margin factor for road distance vs straight line (default: 1.2) */
  marginFactor?: number
}

/**
 * Booking data with optional location
 */
export interface BookingWithLocation {
  id: string
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  location?: Location
}

/**
 * Result of travel time validation
 */
export interface TravelTimeValidationResult {
  /** Whether there's enough travel time */
  valid: boolean
  /** Error message if invalid */
  error?: string
  /** Calculated travel time from previous booking (minutes) */
  travelTimeMinutes?: number
  /** Required gap between bookings (minutes) */
  requiredGapMinutes?: number
  /** Actual gap between bookings (minutes) */
  actualGapMinutes?: number
}

export class TravelTimeService {
  private readonly config: Required<TravelTimeConfig>

  constructor(config?: TravelTimeConfig) {
    this.config = {
      averageSpeedKmh: config?.averageSpeedKmh ?? 50,
      minBufferMinutes: config?.minBufferMinutes ?? 60,
      defaultBufferMinutes: config?.defaultBufferMinutes ?? 60,
      marginFactor: config?.marginFactor ?? 1.2,
    }
  }

  /**
   * Check if there's enough travel time for a new booking
   *
   * @param newBooking - The booking to validate
   * @param existingBookings - Other bookings for the same provider on same day
   * @returns Validation result with travel time details
   */
  hasEnoughTravelTime(
    newBooking: BookingWithLocation,
    existingBookings: BookingWithLocation[]
  ): TravelTimeValidationResult {
    if (existingBookings.length === 0) {
      return { valid: true }
    }

    // Sort existing bookings by start time
    const sorted = [...existingBookings].sort((a, b) =>
      this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
    )

    const newStart = this.timeToMinutes(newBooking.startTime)
    const newEnd = this.timeToMinutes(newBooking.endTime)

    // Find previous booking (ends before new booking starts)
    const previousBooking = this.findPreviousBooking(sorted, newStart)

    // Find next booking (starts after new booking ends)
    const nextBooking = this.findNextBooking(sorted, newEnd)

    // Validate gap from previous booking
    if (previousBooking) {
      const previousEnd = this.timeToMinutes(previousBooking.endTime)
      const gapMinutes = newStart - previousEnd

      const requiredGap = this.calculateRequiredGap(
        previousBooking.location,
        newBooking.location
      )

      if (gapMinutes < requiredGap) {
        return {
          valid: false,
          error: this.formatError(requiredGap, gapMinutes, 'föregående'),
          requiredGapMinutes: requiredGap,
          actualGapMinutes: gapMinutes,
        }
      }
    }

    // Validate gap to next booking
    if (nextBooking) {
      const nextStart = this.timeToMinutes(nextBooking.startTime)
      const gapMinutes = nextStart - newEnd

      const requiredGap = this.calculateRequiredGap(
        newBooking.location,
        nextBooking.location
      )

      if (gapMinutes < requiredGap) {
        return {
          valid: false,
          error: this.formatError(requiredGap, gapMinutes, 'nästa'),
          requiredGapMinutes: requiredGap,
          actualGapMinutes: gapMinutes,
        }
      }
    }

    // Calculate travel time from previous for return value
    let travelTimeMinutes: number | undefined
    if (previousBooking && previousBooking.location && newBooking.location) {
      travelTimeMinutes = this.calculateTravelTimeMinutes(
        previousBooking.location,
        newBooking.location
      )
    }

    return {
      valid: true,
      travelTimeMinutes,
    }
  }

  /**
   * Calculate travel time between two locations with margin
   *
   * @param from - Origin location
   * @param to - Destination location
   * @returns Travel time in minutes (including margin)
   */
  calculateTravelTimeMinutes(from: Location, to: Location): number {
    const baseTime = from.travelTimeTo(to, this.config.averageSpeedKmh)
    return Math.ceil(baseTime * this.config.marginFactor)
  }

  /**
   * Calculate required gap between two bookings
   */
  private calculateRequiredGap(
    fromLocation: Location | undefined,
    toLocation: Location | undefined
  ): number {
    // If either location is missing, use default buffer
    if (!fromLocation || !toLocation) {
      return this.config.defaultBufferMinutes
    }

    // Calculate travel time
    const travelTime = this.calculateTravelTimeMinutes(fromLocation, toLocation)

    // Always require at least minimum buffer (for wrap-up/setup)
    return Math.max(travelTime + this.config.minBufferMinutes, this.config.minBufferMinutes)
  }

  /**
   * Find the booking that ends closest before the given time
   */
  private findPreviousBooking(
    sortedBookings: BookingWithLocation[],
    beforeMinutes: number
  ): BookingWithLocation | undefined {
    let previous: BookingWithLocation | undefined

    for (const booking of sortedBookings) {
      const endMinutes = this.timeToMinutes(booking.endTime)
      if (endMinutes <= beforeMinutes) {
        previous = booking
      } else {
        break
      }
    }

    return previous
  }

  /**
   * Find the booking that starts closest after the given time
   */
  private findNextBooking(
    sortedBookings: BookingWithLocation[],
    afterMinutes: number
  ): BookingWithLocation | undefined {
    for (const booking of sortedBookings) {
      const startMinutes = this.timeToMinutes(booking.startTime)
      if (startMinutes >= afterMinutes) {
        return booking
      }
    }

    return undefined
  }

  /**
   * Convert time string "HH:MM" to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Format error message for insufficient travel time
   */
  private formatError(
    required: number,
    actual: number,
    direction: 'föregående' | 'nästa'
  ): string {
    if (required === this.config.minBufferMinutes) {
      return `Otillräcklig tid till ${direction} bokning. Krävs minst ${required} minuter buffert.`
    }

    return `Otillräcklig restid till ${direction} bokning. ` +
      `Krävs ${required} minuter (inkl. buffert), endast ${actual} minuter tillgängligt.`
  }
}
