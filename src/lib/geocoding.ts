/**
 * Geocoding utilities using Google Maps Geocoding API
 * Converts addresses to geographic coordinates (latitude/longitude)
 */

export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
}

export interface GeocodingError {
  error: string
  status: string
}

/**
 * Geocode an address to latitude/longitude coordinates using Google Maps API
 *
 * @param address - Street address (e.g., "Storgatan 1")
 * @param city - City name (e.g., "Alingsås")
 * @param postalCode - Postal code (e.g., "44130")
 * @returns GeocodingResult with lat/lon or null if geocoding failed
 *
 * @example
 * const result = await geocodeAddress('Storgatan 1', 'Alingsås', '44130')
 * if (result) {
 *   console.log(`Coordinates: ${result.latitude}, ${result.longitude}`)
 * }
 */
export async function geocodeAddress(
  address: string,
  city?: string,
  postalCode?: string
): Promise<GeocodingResult | null> {
  // Validate API key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY is not set in environment variables')
    return null
  }

  // Build query string: "Storgatan 1, Alingsås, 44130"
  const components = [address, city, postalCode].filter(Boolean)
  if (components.length === 0) {
    console.error('geocodeAddress: No address components provided')
    return null
  }

  const query = components.join(', ')

  try {
    // Call Google Maps Geocoding API
    // region=se biases results towards Sweden
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=se&key=${apiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Geocoding API returned ${response.status}: ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // Check API response status
    if (data.status !== 'OK') {
      console.warn(`Geocoding failed for "${query}": ${data.status}`)

      // Log specific error messages
      if (data.status === 'ZERO_RESULTS') {
        console.warn('No results found for the provided address')
      } else if (data.status === 'INVALID_REQUEST') {
        console.error('Invalid geocoding request')
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        console.error('Google Maps API quota exceeded')
      }

      return null
    }

    // Extract coordinates from first result
    const result = data.results[0]
    if (!result || !result.geometry || !result.geometry.location) {
      console.error('Invalid response structure from Geocoding API')
      return null
    }

    const { lat, lng } = result.geometry.location

    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address
    }

  } catch (error) {
    console.error('Exception during geocoding:', error)
    return null
  }
}

/**
 * Geocode an address with retry logic for rate limiting
 *
 * @param address - Street address
 * @param city - City name
 * @param postalCode - Postal code
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 1000)
 * @returns GeocodingResult or null
 */
export async function geocodeAddressWithRetry(
  address: string,
  city?: string,
  postalCode?: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<GeocodingResult | null> {
  let lastError: string | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await geocodeAddress(address, city, postalCode)

      if (result) {
        return result
      }

      // If no result and not last attempt, wait before retry
      if (attempt < maxRetries) {
        console.log(`Geocoding attempt ${attempt} failed, retrying in ${retryDelay}ms...`)
        await sleep(retryDelay)
        // Exponential backoff
        retryDelay *= 2
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Geocoding attempt ${attempt} threw exception:`, error)

      if (attempt < maxRetries) {
        await sleep(retryDelay)
        retryDelay *= 2
      }
    }
  }

  console.error(`Geocoding failed after ${maxRetries} attempts. Last error: ${lastError}`)
  return null
}

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
  //
  // Note: These bounds are conservative to avoid false positives
  // from neighboring countries (Denmark, Norway, Finland)

  const inLatitudeRange = latitude >= 55.3 && latitude <= 69.2
  const inLongitudeRange = longitude >= 11.0 && longitude <= 24.2

  // Special case: exclude Copenhagen area (lat 55.6-55.8, lon 12.4-12.7)
  const isInCopenhagen = latitude >= 55.6 && latitude <= 55.8 && longitude >= 12.4 && longitude <= 12.7

  return inLatitudeRange && inLongitudeRange && !isInCopenhagen
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
