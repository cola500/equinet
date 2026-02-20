/**
 * TravelTimeService - Unit Tests
 *
 * Tests for travel time validation between bookings.
 */
import { describe, it, expect } from 'vitest'
import { TravelTimeService, BookingWithLocation } from './TravelTimeService'
import { Location } from '@/domain/shared/Location'

describe('TravelTimeService', () => {
  // Test locations (approximate Swedish coordinates)
  const goteborg = Location.create(57.7089, 11.9746, 'Göteborg').value!
  const alingsas = Location.create(57.9296, 12.5327, 'Alingsås').value! // ~40 km from Göteborg
  const boras = Location.create(57.7210, 12.9401, 'Borås').value! // ~60 km from Göteborg
  const stockholm = Location.create(59.3293, 18.0686, 'Stockholm').value! // ~400 km from Göteborg

  // Default service instance
  const service = new TravelTimeService()

  // Helper to create booking with location
  function createBooking(
    startTime: string,
    endTime: string,
    location?: Location
  ): BookingWithLocation {
    return {
      id: `booking-${startTime}`,
      startTime,
      endTime,
      location,
    }
  }

  // ==========================================
  // Basic Validation
  // ==========================================

  describe('hasEnoughTravelTime', () => {
    it('should pass when no existing bookings', () => {
      const newBooking = createBooking('10:00', '11:00', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, [])

      expect(result.valid).toBe(true)
    })

    it('should pass when enough time between bookings (same location)', () => {
      // Existing: 09:00-10:00 in Göteborg
      // New: 11:00-12:00 in Göteborg (60 min gap, same place - matches minimum buffer)
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('11:00', '12:00', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(true)
    })

    it('should fail when not enough time between bookings (different locations)', () => {
      // Existing: 09:00-10:00 in Göteborg
      // New: 10:15-11:15 in Alingsås (~40 km, needs ~48 min travel + 10 min buffer)
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('10:15', '11:15', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('restid')
      expect(result.requiredGapMinutes).toBeGreaterThan(50) // ~48 min travel + 10 min buffer
    })

    it('should pass when enough time for travel between different locations', () => {
      // Existing: 09:00-10:00 in Göteborg
      // New: 12:00-13:00 in Alingsås (120 min gap, ~59 min travel + 60 min buffer = 119 min needed)
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('12:00', '13:00', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(true)
    })
  })

  // ==========================================
  // Multiple Bookings
  // ==========================================

  describe('multiple existing bookings', () => {
    it('should check both previous and next bookings', () => {
      // Existing: 08:00-09:00 in Göteborg, 16:00-17:00 in Borås
      // New: 12:00-13:00 in Alingsås
      // Gap FROM Göteborg (09:00) TO new (12:00) = 180 min, needs ~59 min travel + 60 buffer = 119 min
      // Gap FROM new (13:00) TO Borås (16:00) = 180 min, needs ~48 min travel + 60 buffer = 108 min
      const existing = [
        createBooking('08:00', '09:00', goteborg),
        createBooking('16:00', '17:00', boras),
      ]
      const newBooking = createBooking('12:00', '13:00', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(true)
    })

    it('should fail if not enough time to NEXT booking', () => {
      // Existing: 09:00-10:00 in Göteborg, 12:00-13:00 in Stockholm
      // New: 11:00-11:30 in Borås
      // Gap from new (11:30) to Stockholm (12:00) = 30 min
      // Travel Borås -> Stockholm ≈ 350 km ≈ 420 min... way too short!
      const existing = [
        createBooking('09:00', '10:00', goteborg),
        createBooking('12:00', '13:00', stockholm),
      ]
      const newBooking = createBooking('11:00', '11:30', boras)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(false)
    })

    it('should handle bookings in any order (sorts by time)', () => {
      // Existing bookings given out of order
      // Same scenario as above but with different order in the array
      const existing = [
        createBooking('16:00', '17:00', boras),
        createBooking('08:00', '09:00', goteborg),
      ]
      const newBooking = createBooking('12:00', '13:00', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(true)
    })
  })

  // ==========================================
  // Fallback Behavior (Missing Location)
  // ==========================================

  describe('fallback when location is missing', () => {
    it('should use default buffer when new booking has no location', () => {
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('10:30', '11:30', undefined) // No location

      const result = service.hasEnoughTravelTime(newBooking, existing)

      // Should fail because gap (30 min) < default fallback (60 min)
      expect(result.valid).toBe(false)
    })

    it('should use default buffer when existing booking has no location', () => {
      const existing = [createBooking('09:00', '10:00', undefined)] // No location
      const newBooking = createBooking('10:30', '11:30', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      // Should fail because gap (30 min) < default fallback (60 min)
      expect(result.valid).toBe(false)
    })

    it('should pass with default buffer when enough gap', () => {
      const existing = [createBooking('09:00', '10:00', undefined)]
      const newBooking = createBooking('11:00', '12:00', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      // Gap (60 min) >= default fallback (60 min)
      expect(result.valid).toBe(true)
    })
  })

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('edge cases', () => {
    it('should handle booking at start of day (no previous)', () => {
      const existing = [createBooking('14:00', '15:00', alingsas)]
      const newBooking = createBooking('08:00', '09:00', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      // Only need to check gap TO next (14:00 - 09:00 = 5 hours, plenty)
      expect(result.valid).toBe(true)
    })

    it('should handle booking at end of day (no next)', () => {
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('16:00', '17:00', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      // Only need to check gap FROM previous (6 hours, plenty)
      expect(result.valid).toBe(true)
    })

    it('should enforce minimum buffer even for same location', () => {
      // Same location but only 30 min gap (less than 60 min minimum)
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('10:30', '11:30', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('minst 60 minuter')
    })

    it('should pass with exactly minimum buffer at same location', () => {
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('11:00', '12:00', goteborg)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(true)
    })
  })

  // ==========================================
  // Travel Time Calculation
  // ==========================================

  describe('calculateTravelTimeMinutes', () => {
    it('should calculate correct travel time with margin', () => {
      // Distance ~40 km at 50 km/h = 48 min, with 20% margin = ~58 min
      const travelTime = service.calculateTravelTimeMinutes(goteborg, alingsas)

      expect(travelTime).toBeGreaterThan(50)
      expect(travelTime).toBeLessThan(70)
    })

    it('should return 0 for same location', () => {
      const travelTime = service.calculateTravelTimeMinutes(goteborg, goteborg)

      expect(travelTime).toBe(0)
    })
  })

  // ==========================================
  // Custom Configuration
  // ==========================================

  describe('custom configuration', () => {
    it('should respect custom speed', () => {
      const fastService = new TravelTimeService({
        averageSpeedKmh: 80, // Faster than default 50
        minBufferMinutes: 10, // Use legacy buffer for this test
      })

      // 41 km at 80 km/h = 31 min * 1.2 = 37 min + 10 buffer = 47 min
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('10:50', '11:50', alingsas) // 50 min gap

      const result = fastService.hasEnoughTravelTime(newBooking, existing)

      // 50 min gap should be enough for ~37 min travel + 10 min buffer = 47 min
      expect(result.valid).toBe(true)
    })

    it('should respect custom minimum buffer', () => {
      const strictService = new TravelTimeService({
        minBufferMinutes: 20, // Stricter than default 10
      })

      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('10:15', '11:15', goteborg) // 15 min gap, same location

      const result = strictService.hasEnoughTravelTime(newBooking, existing)

      // 15 min < 20 min minimum
      expect(result.valid).toBe(false)
    })

    it('should respect custom fallback buffer', () => {
      const relaxedService = new TravelTimeService({
        defaultBufferMinutes: 10, // Less strict than default 15
      })

      const existing = [createBooking('09:00', '10:00', undefined)]
      const newBooking = createBooking('10:12', '11:12', undefined) // 12 min gap

      const result = relaxedService.hasEnoughTravelTime(newBooking, existing)

      // 12 min > 10 min fallback
      expect(result.valid).toBe(true)
    })
  })

  // ==========================================
  // Required Gap Information
  // ==========================================

  describe('required gap information', () => {
    it('should return travel time in minutes when valid', () => {
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('12:00', '13:00', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(true)
      expect(result.travelTimeMinutes).toBeGreaterThan(0)
    })

    it('should return required gap when invalid', () => {
      const existing = [createBooking('09:00', '10:00', goteborg)]
      const newBooking = createBooking('10:15', '11:15', alingsas)

      const result = service.hasEnoughTravelTime(newBooking, existing)

      expect(result.valid).toBe(false)
      expect(result.requiredGapMinutes).toBeDefined()
      expect(result.actualGapMinutes).toBe(15)
    })
  })
})
