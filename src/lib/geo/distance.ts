/**
 * Distance calculation utilities using the Haversine formula.
 * Shared across client-side filtering and server-side calculations.
 */

const EARTH_RADIUS_KM = 6371

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Filter items by distance from a center point.
 * Items without coordinates (null lat/lng) are always included.
 * If center is null, all items are returned (no filtering).
 */
export function filterByDistance<T>(
  items: T[],
  getCoords: (item: T) => { lat: number | null; lng: number | null },
  center: { lat: number; lng: number } | null,
  radiusKm: number
): T[] {
  if (!center) return items

  return items.filter((item) => {
    const coords = getCoords(item)
    if (coords.lat == null || coords.lng == null) return true
    return calculateDistance(center.lat, center.lng, coords.lat, coords.lng) <= radiusKm
  })
}
