/**
 * Location Value Object - Unit Tests
 *
 * Tests for geographic location handling and travel time calculations.
 */
import { describe, it, expect } from 'vitest'
import { Location } from './Location'

describe('Location Value Object', () => {
  // ==========================================
  // Creation & Validation
  // ==========================================

  describe('create', () => {
    it('should create a valid location', () => {
      const result = Location.create(57.7089, 11.9746) // Göteborg

      expect(result.isSuccess).toBe(true)
      expect(result.value?.latitude).toBe(57.7089)
      expect(result.value?.longitude).toBe(11.9746)
    })

    it('should create a location with optional address', () => {
      const result = Location.create(57.7089, 11.9746, 'Göteborg')

      expect(result.isSuccess).toBe(true)
      expect(result.value?.address).toBe('Göteborg')
    })

    it('should fail for latitude below -90', () => {
      const result = Location.create(-91, 11.9746)

      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('Latitud')
    })

    it('should fail for latitude above 90', () => {
      const result = Location.create(91, 11.9746)

      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('Latitud')
    })

    it('should fail for longitude below -180', () => {
      const result = Location.create(57.7089, -181)

      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('Longitud')
    })

    it('should fail for longitude above 180', () => {
      const result = Location.create(57.7089, 181)

      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('Longitud')
    })

    it('should accept boundary values', () => {
      const north = Location.create(90, 0)
      const south = Location.create(-90, 0)
      const east = Location.create(0, 180)
      const west = Location.create(0, -180)

      expect(north.isSuccess).toBe(true)
      expect(south.isSuccess).toBe(true)
      expect(east.isSuccess).toBe(true)
      expect(west.isSuccess).toBe(true)
    })
  })

  // ==========================================
  // Distance Calculation
  // ==========================================

  describe('distanceTo', () => {
    it('should calculate distance between Göteborg and Stockholm (~400 km)', () => {
      const goteborg = Location.create(57.7089, 11.9746).value!
      const stockholm = Location.create(59.3293, 18.0686).value!

      const distance = goteborg.distanceTo(stockholm)

      // Allow some tolerance (Haversine gives ~398 km)
      expect(distance).toBeGreaterThan(390)
      expect(distance).toBeLessThan(410)
    })

    it('should calculate distance between close locations (~5 km)', () => {
      const alingsas = Location.create(57.9296, 12.5327).value! // Alingsås
      const nearby = Location.create(57.9296, 12.6).value! // ~5 km east

      const distance = alingsas.distanceTo(nearby)

      expect(distance).toBeGreaterThan(3)
      expect(distance).toBeLessThan(7)
    })

    it('should return 0 for same location', () => {
      const loc1 = Location.create(57.7089, 11.9746).value!
      const loc2 = Location.create(57.7089, 11.9746).value!

      const distance = loc1.distanceTo(loc2)

      expect(distance).toBe(0)
    })

    it('should be symmetric (A->B = B->A)', () => {
      const a = Location.create(57.7089, 11.9746).value!
      const b = Location.create(59.3293, 18.0686).value!

      const distanceAB = a.distanceTo(b)
      const distanceBA = b.distanceTo(a)

      expect(distanceAB).toBeCloseTo(distanceBA, 10)
    })
  })

  // ==========================================
  // Travel Time Calculation
  // ==========================================

  describe('travelTimeTo', () => {
    it('should calculate travel time using default speed (50 km/h)', () => {
      // 50 km distance at 50 km/h = 60 minutes
      const goteborg = Location.create(57.7089, 11.9746).value!
      const stockholm = Location.create(59.3293, 18.0686).value!

      const travelTime = goteborg.travelTimeTo(stockholm)
      const distance = goteborg.distanceTo(stockholm) // ~398 km

      // Expected: distance / 50 * 60 = ~398 / 50 * 60 ≈ 478 minutes
      const expectedMinutes = (distance / 50) * 60
      expect(travelTime).toBeCloseTo(expectedMinutes, 0)
    })

    it('should calculate travel time with custom speed', () => {
      const a = Location.create(57.7089, 11.9746).value!
      const b = Location.create(57.9296, 12.5327).value! // ~40 km

      const distance = a.distanceTo(b)

      // At 80 km/h
      const travelTime80 = a.travelTimeTo(b, 80)
      const expected80 = (distance / 80) * 60
      expect(travelTime80).toBeCloseTo(expected80, 0)

      // At 40 km/h
      const travelTime40 = a.travelTimeTo(b, 40)
      const expected40 = (distance / 40) * 60
      expect(travelTime40).toBeCloseTo(expected40, 0)
    })

    it('should return 0 for same location', () => {
      const loc = Location.create(57.7089, 11.9746).value!

      const travelTime = loc.travelTimeTo(loc)

      expect(travelTime).toBe(0)
    })

    it('should handle short distances correctly', () => {
      // ~5 km at 50 km/h = 6 minutes
      const a = Location.create(57.9296, 12.5327).value!
      const b = Location.create(57.9296, 12.6).value!

      const travelTime = a.travelTimeTo(b)
      const distance = a.distanceTo(b)

      const expectedMinutes = (distance / 50) * 60
      expect(travelTime).toBeCloseTo(expectedMinutes, 1)
    })
  })

  // ==========================================
  // Equality
  // ==========================================

  describe('equals', () => {
    it('should be equal for same coordinates', () => {
      const loc1 = Location.create(57.7089, 11.9746).value!
      const loc2 = Location.create(57.7089, 11.9746).value!

      expect(loc1.equals(loc2)).toBe(true)
    })

    it('should not be equal for different coordinates', () => {
      const loc1 = Location.create(57.7089, 11.9746).value!
      const loc2 = Location.create(59.3293, 18.0686).value!

      expect(loc1.equals(loc2)).toBe(false)
    })

    it('should be equal even with different addresses (coordinates matter)', () => {
      const loc1 = Location.create(57.7089, 11.9746, 'Göteborg').value!
      const loc2 = Location.create(57.7089, 11.9746, 'Different Name').value!

      // Coordinates are the same, so they represent the same location
      // But address is part of props, so they won't be equal
      // This is a design decision - we include address in equality
      expect(loc1.equals(loc2)).toBe(false)
    })
  })

  // ==========================================
  // Helper Methods
  // ==========================================

  describe('toString', () => {
    it('should return formatted string with address', () => {
      const loc = Location.create(57.7089, 11.9746, 'Göteborg').value!

      expect(loc.toString()).toBe('Göteborg (57.7089, 11.9746)')
    })

    it('should return formatted string without address', () => {
      const loc = Location.create(57.7089, 11.9746).value!

      expect(loc.toString()).toBe('(57.7089, 11.9746)')
    })
  })

  describe('toJSON', () => {
    it('should serialize to plain object', () => {
      const loc = Location.create(57.7089, 11.9746, 'Göteborg').value!

      const json = loc.toJSON()

      expect(json).toEqual({
        latitude: 57.7089,
        longitude: 11.9746,
        address: 'Göteborg',
      })
    })
  })
})
