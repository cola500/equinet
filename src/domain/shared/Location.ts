/**
 * Location Value Object
 *
 * Represents a geographic location with coordinates and optional address.
 * Used for calculating distances and travel times between bookings.
 *
 * Business Rules:
 * - Latitude must be between -90 and 90
 * - Longitude must be between -180 and 180
 * - Uses Haversine formula for distance calculation
 * - Default travel speed: 50 km/h
 */
import { ValueObject } from './base/ValueObject'
import { Result } from './types/Result'
import { calculateDistance } from '@/lib/geo/distance'

interface LocationProps {
  latitude: number
  longitude: number
  address?: string
}

export class Location extends ValueObject<LocationProps> {
  // Travel time constants
  static readonly DEFAULT_SPEED_KMH = 50

  private constructor(props: LocationProps) {
    super(props)
  }

  /**
   * Create a Location with validation
   *
   * @param latitude - Latitude (-90 to 90)
   * @param longitude - Longitude (-180 to 180)
   * @param address - Optional human-readable address
   */
  static create(
    latitude: number,
    longitude: number,
    address?: string
  ): Result<Location, string> {
    // Validate latitude
    if (latitude < -90 || latitude > 90) {
      return Result.fail('Latitud måste vara mellan -90 och 90')
    }

    // Validate longitude
    if (longitude < -180 || longitude > 180) {
      return Result.fail('Longitud måste vara mellan -180 och 180')
    }

    return Result.ok(new Location({
      latitude,
      longitude,
      address,
    }))
  }

  // ==========================================
  // Getters
  // ==========================================

  get latitude(): number {
    return this.props.latitude
  }

  get longitude(): number {
    return this.props.longitude
  }

  get address(): string | undefined {
    return this.props.address
  }

  // ==========================================
  // Distance & Travel Time Methods
  // ==========================================

  /**
   * Calculate distance to another location using Haversine formula
   *
   * @param other - Target location
   * @returns Distance in kilometers
   */
  distanceTo(other: Location): number {
    return calculateDistance(
      this.latitude,
      this.longitude,
      other.latitude,
      other.longitude
    )
  }

  /**
   * Calculate travel time to another location
   *
   * @param other - Target location
   * @param speedKmh - Average travel speed in km/h (default: 50)
   * @returns Travel time in minutes
   */
  travelTimeTo(other: Location, speedKmh: number = Location.DEFAULT_SPEED_KMH): number {
    const distanceKm = this.distanceTo(other)
    const hours = distanceKm / speedKmh
    return hours * 60 // Convert to minutes
  }

  // ==========================================
  // String Representation
  // ==========================================

  /**
   * Get a human-readable string representation
   */
  toString(): string {
    if (this.address) {
      return `${this.address} (${this.latitude}, ${this.longitude})`
    }
    return `(${this.latitude}, ${this.longitude})`
  }
}
