import { describe, it, expect } from 'vitest'
import { TimeSlot } from './TimeSlot'

describe('TimeSlot', () => {
  describe('validate', () => {
    it('should return valid for correct time slot', () => {
      const result = TimeSlot.validate('10:00', '11:00')

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject when end time is before start time', () => {
      const result = TimeSlot.validate('11:00', '10:00')

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Sluttid måste vara efter starttid')
    })

    it('should reject when end time equals start time', () => {
      const result = TimeSlot.validate('10:00', '10:00')

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Sluttid måste vara efter starttid')
    })

    it('should reject duration less than 15 minutes', () => {
      const result = TimeSlot.validate('10:00', '10:10')

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Bokning måste vara minst 15 minuter')
    })

    it('should accept exactly 15 minutes duration', () => {
      const result = TimeSlot.validate('10:00', '10:15')

      expect(result.isValid).toBe(true)
    })

    it('should reject duration over 8 hours', () => {
      const result = TimeSlot.validate('08:00', '16:30') // 8.5 hours

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Bokning kan inte överstiga 8 timmar')
    })

    it('should accept exactly 8 hours duration', () => {
      const result = TimeSlot.validate('08:00', '16:00')

      expect(result.isValid).toBe(true)
    })

    it('should reject start time before business hours (08:00)', () => {
      const result = TimeSlot.validate('07:00', '08:00')

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Bokning måste vara inom öppettider (08:00-18:00)')
    })

    it('should reject end time after business hours (18:00)', () => {
      const result = TimeSlot.validate('17:00', '19:00')

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Bokning måste vara inom öppettider (08:00-18:00)')
    })

    it('should accept booking at business hours boundaries', () => {
      // 08:00-16:00 is 8 hours (max allowed)
      const result = TimeSlot.validate('08:00', '16:00')

      expect(result.isValid).toBe(true)
    })

    it('should accept booking ending at 18:00', () => {
      const result = TimeSlot.validate('10:00', '18:00')

      expect(result.isValid).toBe(true)
    })

    it('should reject invalid start time format', () => {
      const result = TimeSlot.validate('invalid', '11:00')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Ogiltig starttid')
    })

    it('should reject invalid end time format', () => {
      const result = TimeSlot.validate('10:00', '25:00')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Ogiltig sluttid')
    })
  })

  describe('create', () => {
    it('should create TimeSlot for valid input', () => {
      const result = TimeSlot.create('10:00', '11:00')

      expect(result.isSuccess).toBe(true)
      expect(result.value.startTime).toBe('10:00')
      expect(result.value.endTime).toBe('11:00')
      expect(result.value.durationMinutes).toBe(60)
    })

    it('should fail for invalid input', () => {
      const result = TimeSlot.create('11:00', '10:00')

      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('Sluttid måste vara efter starttid')
    })

    it('should normalize time with seconds', () => {
      const result = TimeSlot.create('10:00:00', '11:00:00')

      expect(result.isSuccess).toBe(true)
      expect(result.value.startTime).toBe('10:00')
      expect(result.value.endTime).toBe('11:00')
    })

    it('should calculate correct duration', () => {
      const result = TimeSlot.create('09:30', '11:45')

      expect(result.isSuccess).toBe(true)
      expect(result.value.durationMinutes).toBe(135) // 2h 15m
    })
  })

  describe('fromDuration', () => {
    it('should create TimeSlot from start time and duration', () => {
      const result = TimeSlot.fromDuration('10:00', 60)

      expect(result.isSuccess).toBe(true)
      expect(result.value.startTime).toBe('10:00')
      expect(result.value.endTime).toBe('11:00')
      expect(result.value.durationMinutes).toBe(60)
    })

    it('should handle durations that cross hour boundaries', () => {
      const result = TimeSlot.fromDuration('10:30', 45)

      expect(result.isSuccess).toBe(true)
      expect(result.value.endTime).toBe('11:15')
    })

    it('should fail if resulting time is outside business hours', () => {
      const result = TimeSlot.fromDuration('17:00', 120) // Ends at 19:00

      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('öppettider')
    })

    it('should fail for invalid start time', () => {
      const result = TimeSlot.fromDuration('invalid', 60)

      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('Ogiltig starttid')
    })
  })

  describe('overlaps', () => {
    it('should detect overlapping time slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('10:30', '11:30').value

      expect(slot1.overlaps(slot2)).toBe(true)
      expect(slot2.overlaps(slot1)).toBe(true)
    })

    it('should not detect overlap for adjacent time slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('11:00', '12:00').value

      expect(slot1.overlaps(slot2)).toBe(false)
      expect(slot2.overlaps(slot1)).toBe(false)
    })

    it('should detect overlap when one contains the other', () => {
      const slot1 = TimeSlot.create('10:00', '12:00').value
      const slot2 = TimeSlot.create('10:30', '11:30').value

      expect(slot1.overlaps(slot2)).toBe(true)
      expect(slot2.overlaps(slot1)).toBe(true)
    })

    it('should not detect overlap for non-overlapping slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('12:00', '13:00').value

      expect(slot1.overlaps(slot2)).toBe(false)
      expect(slot2.overlaps(slot1)).toBe(false)
    })
  })

  describe('contains', () => {
    it('should return true when slot contains another', () => {
      const outer = TimeSlot.create('10:00', '12:00').value
      const inner = TimeSlot.create('10:30', '11:30').value

      expect(outer.contains(inner)).toBe(true)
    })

    it('should return false when slot does not contain another', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('10:30', '11:30').value

      expect(slot1.contains(slot2)).toBe(false)
    })

    it('should return true for identical slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('10:00', '11:00').value

      expect(slot1.contains(slot2)).toBe(true)
    })
  })

  describe('isAdjacentTo', () => {
    it('should return true for adjacent slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('11:00', '12:00').value

      expect(slot1.isAdjacentTo(slot2)).toBe(true)
      expect(slot2.isAdjacentTo(slot1)).toBe(true)
    })

    it('should return false for non-adjacent slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('12:00', '13:00').value

      expect(slot1.isAdjacentTo(slot2)).toBe(false)
    })

    it('should return false for overlapping slots', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('10:30', '11:30').value

      expect(slot1.isAdjacentTo(slot2)).toBe(false)
    })
  })

  describe('toString', () => {
    it('should return formatted string', () => {
      const slot = TimeSlot.create('10:00', '11:30').value

      expect(slot.toString()).toBe('10:00-11:30')
    })
  })

  describe('equals (inherited from ValueObject)', () => {
    it('should be equal for same times', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('10:00', '11:00').value

      expect(slot1.equals(slot2)).toBe(true)
    })

    it('should not be equal for different times', () => {
      const slot1 = TimeSlot.create('10:00', '11:00').value
      const slot2 = TimeSlot.create('10:00', '12:00').value

      expect(slot1.equals(slot2)).toBe(false)
    })
  })

  describe('constants', () => {
    it('should have correct business rule constants', () => {
      expect(TimeSlot.MIN_DURATION_MINUTES).toBe(15)
      expect(TimeSlot.MAX_DURATION_MINUTES).toBe(480)
      expect(TimeSlot.BUSINESS_HOURS_START).toBe(8)
      expect(TimeSlot.BUSINESS_HOURS_END).toBe(18)
    })
  })
})
