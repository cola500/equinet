/**
 * Bounding Box utilities for geo-filtering
 *
 * Used to pre-filter database queries before exact distance calculation.
 * This dramatically reduces the dataset size for in-memory filtering.
 *
 * Security:
 * - Max radius enforced (100km) to prevent data enumeration
 * - Input validation via Zod
 */

import { z } from "zod"

const EARTH_RADIUS_KM = 6371
const MAX_RADIUS_KM = 200

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * Zod schema for geo-filtering input validation
 */
export const geoFilterSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(MAX_RADIUS_KM),
})

export type GeoFilter = z.infer<typeof geoFilterSchema>

/**
 * Calculate bounding box from center point and radius
 *
 * Uses approximation: 1 degree latitude ≈ 111km
 * Longitude varies with latitude (cos adjustment)
 *
 * @param latitude - Center latitude
 * @param longitude - Center longitude
 * @param radiusKm - Search radius in kilometers (max 100km)
 * @returns Bounding box coordinates
 */
export function calculateBoundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number
): BoundingBox {
  // Validate and clamp radius
  const clampedRadius = Math.min(Math.max(radiusKm, 1), MAX_RADIUS_KM)

  // Calculate latitude delta (approximately 111km per degree)
  const latDelta = clampedRadius / 111

  // Calculate longitude delta (varies with latitude)
  // At equator: 111km/degree, at poles: 0km/degree
  const lngDelta = clampedRadius / (111 * Math.cos(latitude * Math.PI / 180))

  return {
    minLat: Math.max(latitude - latDelta, -90),
    maxLat: Math.min(latitude + latDelta, 90),
    minLng: Math.max(longitude - lngDelta, -180),
    maxLng: Math.min(longitude + lngDelta, 180),
  }
}

/**
 * Get maximum allowed radius
 * Useful for API validation messages
 */
export function getMaxRadiusKm(): number {
  return MAX_RADIUS_KM
}
