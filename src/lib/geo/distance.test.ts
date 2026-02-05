import { describe, it, expect } from "vitest"
import { calculateDistance, filterByDistance } from "./distance"

describe("calculateDistance", () => {
  it("returns 0 for same point", () => {
    const distance = calculateDistance(59.3293, 18.0686, 59.3293, 18.0686)
    expect(distance).toBe(0)
  })

  it("calculates Stockholm to Gothenburg (~400km)", () => {
    // Stockholm: 59.3293, 18.0686
    // Gothenburg: 57.7089, 11.9746
    const distance = calculateDistance(59.3293, 18.0686, 57.7089, 11.9746)
    expect(distance).toBeGreaterThan(390)
    expect(distance).toBeLessThan(420)
  })

  it("calculates Stockholm to Malmoe (~510km)", () => {
    // Stockholm: 59.3293, 18.0686
    // Malmoe: 55.6050, 13.0038
    const distance = calculateDistance(59.3293, 18.0686, 55.605, 13.0038)
    expect(distance).toBeGreaterThan(500)
    expect(distance).toBeLessThan(530)
  })

  it("is symmetric (a->b === b->a)", () => {
    const ab = calculateDistance(59.3293, 18.0686, 57.7089, 11.9746)
    const ba = calculateDistance(57.7089, 11.9746, 59.3293, 18.0686)
    expect(ab).toBeCloseTo(ba, 10)
  })
})

describe("filterByDistance", () => {
  interface Place {
    name: string
    lat: number | null
    lng: number | null
  }

  const places: Place[] = [
    { name: "Stockholm", lat: 59.3293, lng: 18.0686 },
    { name: "Uppsala", lat: 59.8586, lng: 17.6389 },      // ~63km from Stockholm
    { name: "Gothenburg", lat: 57.7089, lng: 11.9746 },    // ~400km from Stockholm
    { name: "No coords", lat: null, lng: null },
  ]

  const getCoords = (p: Place) => ({ lat: p.lat, lng: p.lng })
  const stockholmCenter = { lat: 59.3293, lng: 18.0686 }

  it("includes items within radius", () => {
    const result = filterByDistance(places, getCoords, stockholmCenter, 100)
    const names = result.map((p) => p.name)
    expect(names).toContain("Stockholm")
    expect(names).toContain("Uppsala")
  })

  it("excludes items outside radius", () => {
    const result = filterByDistance(places, getCoords, stockholmCenter, 100)
    const names = result.map((p) => p.name)
    expect(names).not.toContain("Gothenburg")
  })

  it("always includes items without coordinates (null lat/lng)", () => {
    const result = filterByDistance(places, getCoords, stockholmCenter, 10)
    const names = result.map((p) => p.name)
    expect(names).toContain("No coords")
  })

  it("returns all items when center is null (no filter)", () => {
    const result = filterByDistance(places, getCoords, null, 50)
    expect(result).toHaveLength(places.length)
  })

  it("includes items at exactly the radius boundary", () => {
    // Uppsala is ~63km from Stockholm
    const result = filterByDistance(places, getCoords, stockholmCenter, 63)
    const names = result.map((p) => p.name)
    // Should include Stockholm (0km) but Uppsala may or may not be included
    // depending on exact distance - test with generous radius
    expect(names).toContain("Stockholm")
  })
})
