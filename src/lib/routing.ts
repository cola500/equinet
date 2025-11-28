/**
 * Routing utility using OSRM (Open Source Routing Machine)
 *
 * Fetches actual driving routes instead of straight lines between coordinates.
 */

export interface RouteResult {
  coordinates: [number, number][]
  distance: number // in meters
  duration: number // in seconds
}

/**
 * Get driving route between multiple coordinates using OSRM
 *
 * @param coordinates Array of [lat, lon] coordinates
 * @returns Route with actual road geometry
 */
export async function getRoute(
  coordinates: [number, number][]
): Promise<RouteResult> {
  if (coordinates.length < 2) {
    throw new Error('Need at least 2 coordinates for routing')
  }

  try {
    // Use our own API proxy to avoid CSP issues
    const response = await fetch('/api/routing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coordinates }),
    })

    if (!response.ok) {
      throw new Error(`Routing API returned ${response.status}`)
    }

    const data = await response.json()

    return {
      coordinates: data.coordinates,
      distance: data.distance, // meters
      duration: data.duration, // seconds
    }
  } catch (error) {
    console.error('Routing error:', error)
    throw error
  }
}

/**
 * Get route with fallback to straight lines if routing fails
 */
export async function getRouteWithFallback(
  coordinates: [number, number][]
): Promise<[number, number][]> {
  try {
    const result = await getRoute(coordinates)
    return result.coordinates
  } catch (error) {
    console.warn('Routing failed, using straight lines as fallback:', error)
    // Return original coordinates as fallback
    return coordinates
  }
}
