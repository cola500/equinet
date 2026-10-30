/**
 * In-house route optimization for a provider's day.
 *
 * Orders stops for a round trip from a start location using nearest neighbour
 * followed by 2-opt improvement. Runs inside Equinet so no customer locations
 * are sent to third parties. Distances are straight-line (Haversine); the
 * route planning page measures real road distance with OSRM afterwards.
 */

import { calculateDistance } from "@/lib/geo/distance"

/** Max orders per optimization, shared by the API route and the page. */
export const MAX_OPTIMIZE_ORDERS = 100

export interface GeoPoint {
  lat: number
  lon: number
}

export interface StopOrderResult {
  /** Stop indices (into the input array) in optimized visiting order */
  route: number[]
  num_stops: number
  /** Round trip distance in the optimized order (km) */
  total_distance_km: number
  /** Round trip distance in the order the stops were given (km) */
  baseline_distance_km: number
  improvement_percent: number
}

// Node 0 is the start location, node i + 1 is stops[i]
function buildDistanceMatrix(start: GeoPoint, stops: GeoPoint[]): number[][] {
  const nodes = [start, ...stops]
  return nodes.map((a) =>
    nodes.map((b) => calculateDistance(a.lat, a.lon, b.lat, b.lon))
  )
}

// Tour = node indices starting with 0; it returns to 0 after the last node
function tourLength(tour: number[], dist: number[][]): number {
  let total = 0
  for (let i = 0; i < tour.length; i++) {
    total += dist[tour[i]][tour[(i + 1) % tour.length]]
  }
  return total
}

function nearestNeighbourTour(dist: number[][]): number[] {
  const n = dist.length
  const visited = new Set<number>([0])
  const tour = [0]
  while (tour.length < n) {
    const current = tour[tour.length - 1]
    let next = -1
    for (let candidate = 1; candidate < n; candidate++) {
      if (visited.has(candidate)) continue
      // Strict < keeps ties on the lowest index, which makes the result deterministic
      if (next === -1 || dist[current][candidate] < dist[current][next]) {
        next = candidate
      }
    }
    visited.add(next)
    tour.push(next)
  }
  return tour
}

function twoOpt(initial: number[], dist: number[][]): number[] {
  const tour = [...initial]
  const n = tour.length
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const before = tour[i - 1]
        const first = tour[i]
        const last = tour[k]
        const after = tour[(k + 1) % n]
        const delta =
          dist[before][last] + dist[first][after] - dist[before][first] - dist[last][after]
        if (delta < -1e-9) {
          tour.splice(i, k - i + 1, ...tour.slice(i, k + 1).reverse())
          improved = true
        }
      }
    }
  }
  return tour
}

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function optimizeStopOrder(start: GeoPoint, stops: GeoPoint[]): StopOrderResult {
  const dist = buildDistanceMatrix(start, stops)
  const givenTour = [0, ...stops.map((_, i) => i + 1)]

  // Improving both the greedy tour and the given order guarantees we never
  // return something longer than what the provider already had
  const greedy = twoOpt(nearestNeighbourTour(dist), dist)
  const improvedGiven = twoOpt(givenTour, dist)
  const greedyLength = tourLength(greedy, dist)
  const improvedGivenLength = tourLength(improvedGiven, dist)
  const best = greedyLength <= improvedGivenLength ? greedy : improvedGiven

  const total = round(Math.min(greedyLength, improvedGivenLength), 2)
  const baseline = round(tourLength(givenTour, dist), 2)
  const improvement = baseline > 0 ? round(((baseline - total) / baseline) * 100, 1) : 0

  return {
    route: best.slice(1).map((node) => node - 1),
    num_stops: stops.length,
    total_distance_km: total,
    baseline_distance_km: baseline,
    improvement_percent: improvement,
  }
}
