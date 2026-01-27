/**
 * Geocoding utility using OpenStreetMap Nominatim API
 * Converts addresses to geographic coordinates (latitude/longitude)
 *
 * Benefits of Nominatim:
 * - Free, no API key required
 * - Uses OpenStreetMap data
 * - Good coverage for Sweden
 *
 * Caching:
 * - Results cached in Redis for 30 days
 * - SHA-256 hashed keys for security
 * - Graceful fallback if Redis unavailable
 *
 * Limitations:
 * - Rate limited to 1 request/second (mitigated by caching)
 */

import {
  getCachedGeocode,
  setCachedGeocode,
  isGeocodingCacheAvailable,
} from "./cache/geocoding-cache"

export interface GeocodingResult {
  latitude: number
  longitude: number
}

/**
 * Geocode an address to latitude/longitude coordinates using Nominatim
 *
 * @param address - Full address string (e.g., "Storgatan 1, Göteborg")
 * @returns GeocodingResult with lat/lon or null if geocoding failed
 *
 * @example
 * const result = await geocodeAddress('Storgatan 1, Göteborg')
 * if (result) {
 *   console.log(`Coordinates: ${result.latitude}, ${result.longitude}`)
 * }
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) {
    console.error('geocodeAddress: No address provided')
    return null
  }

  // Check cache first
  const cached = await getCachedGeocode(address)
  if (cached) {
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
    }
  }

  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'Equinet/1.0 (equinet booking app)'
        }
      }
    )

    if (!response.ok) {
      console.error(`Geocoding request failed with status ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.length === 0) {
      console.warn(`No geocoding results for address: ${address}`)
      return null
    }

    const result = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon)
    }

    // Cache the result for future lookups
    await setCachedGeocode(address, result.latitude, result.longitude)

    return result
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

/**
 * Check if geocoding cache is enabled
 * Useful for monitoring dashboards
 */
export { isGeocodingCacheAvailable }

/**
 * Validate that coordinates are within reasonable bounds for Sweden
 *
 * @param latitude - Latitude to validate
 * @param longitude - Longitude to validate
 * @returns true if coordinates are plausible for Sweden
 */
export function isValidSwedishCoordinates(latitude: number, longitude: number): boolean {
  // Sweden approximate bounds:
  // Latitude: 55.3 (south, Smygehuk) to 69.1 (north, Treriksröset)
  // Longitude: 10.9 (west) to 24.2 (east)
  const inLatitudeRange = latitude >= 55.3 && latitude <= 69.2
  const inLongitudeRange = longitude >= 11.0 && longitude <= 24.2

  return inLatitudeRange && inLongitudeRange
}
