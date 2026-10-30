import { describe, it, expect } from "vitest"
import { optimizeStopOrder } from "./route-optimization"

// Points along a single latitude, ~55 km apart per 1 degree of longitude at 60°N
const start = { lat: 60, lon: 15 }
const at = (lon: number) => ({ lat: 60, lon })

describe("optimizeStopOrder", () => {
  it("returns every stop index exactly once", () => {
    const stops = [at(16), at(18), at(17), at(15.5)]

    const result = optimizeStopOrder(start, stops)

    expect([...result.route].sort()).toEqual([0, 1, 2, 3])
    expect(result.num_stops).toBe(4)
  })

  it("visits stops on a line in geographic order instead of zig-zagging", () => {
    // Sent order zig-zags: 18 -> 16 -> 17
    const stops = [at(18), at(16), at(17)]

    const result = optimizeStopOrder(start, stops)

    // Either direction of the round trip is optimal
    expect([[1, 2, 0], [0, 2, 1]]).toContainEqual(result.route)
    expect(result.total_distance_km).toBeLessThan(result.baseline_distance_km)
    expect(result.improvement_percent).toBeGreaterThan(0)
  })

  it("measures the baseline as a round trip in the order sent", () => {
    const stops = [at(16), at(17)]

    const result = optimizeStopOrder(start, stops)

    // start -> 16 -> 17 -> start = 2 degrees of longitude out and back
    expect(result.baseline_distance_km).toBeCloseTo(result.total_distance_km, 2)
    expect(result.baseline_distance_km).toBeGreaterThan(200)
    expect(result.baseline_distance_km).toBeLessThan(240)
    expect(result.improvement_percent).toBe(0)
  })

  it("never returns a longer route than the order sent", () => {
    // Deterministic pseudo-random spread around Örebro
    const stops = Array.from({ length: 40 }, (_, i) => ({
      lat: 59.27 + Math.sin(i * 12.9898) * 0.8,
      lon: 15.21 + Math.cos(i * 78.233) * 1.2,
    }))

    const result = optimizeStopOrder(start, stops)

    expect(result.total_distance_km).toBeLessThanOrEqual(result.baseline_distance_km)
    expect(new Set(result.route).size).toBe(40)
  })

  it("handles several horses at the same stable without NaN", () => {
    const stable = { lat: 59.3, lon: 15.2 }
    const stops = [stable, stable, at(16), stable]

    const result = optimizeStopOrder(start, stops)

    expect(Number.isFinite(result.total_distance_km)).toBe(true)
    expect(Number.isFinite(result.improvement_percent)).toBe(true)
    // The three stops at the stable are visited back to back
    const stablePositions = [0, 1, 3].map((i) => result.route.indexOf(i)).sort((a, b) => a - b)
    expect(stablePositions[2] - stablePositions[0]).toBe(2)
  })

  it("reports 0 % improvement when all stops are at the start", () => {
    const result = optimizeStopOrder(start, [start, start])

    expect(result.baseline_distance_km).toBe(0)
    expect(result.improvement_percent).toBe(0)
  })

  it("is deterministic for the same input", () => {
    const stops = [at(18), at(16), at(17), at(15.2), at(16.5)]

    expect(optimizeStopOrder(start, stops)).toEqual(optimizeStopOrder(start, stops))
  })

  it("optimizes 100 stops quickly", () => {
    const stops = Array.from({ length: 100 }, (_, i) => ({
      lat: 59 + Math.sin(i * 3.1) * 1.5,
      lon: 15 + Math.cos(i * 1.7) * 2.5,
    }))

    const t0 = performance.now()
    const result = optimizeStopOrder(start, stops)
    const elapsed = performance.now() - t0

    expect(result.route).toHaveLength(100)
    expect(elapsed).toBeLessThan(500)
  })
})
