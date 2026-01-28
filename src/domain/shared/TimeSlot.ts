/**
 * TimeSlot Value Object
 *
 * Represents a time interval with validation for booking business rules.
 * Immutable and self-validating.
 *
 * Business Rules:
 * - Minimum duration: 15 minutes
 * - Maximum duration: 8 hours (480 minutes)
 * - Business hours: 08:00-18:00
 * - End time must be after start time
 */
import { ValueObject } from './base/ValueObject'
import { Result } from './types/Result'

interface TimeSlotProps {
  startTime: string // "HH:MM" format
  endTime: string   // "HH:MM" format
  durationMinutes: number
}

export interface TimeSlotValidation {
  isValid: boolean
  error?: string
}

export class TimeSlot extends ValueObject<TimeSlotProps> {
  // Business rule constants
  static readonly MIN_DURATION_MINUTES = 15
  static readonly MAX_DURATION_MINUTES = 480 // 8 hours
  static readonly BUSINESS_HOURS_START = 8   // 08:00
  static readonly BUSINESS_HOURS_END = 18    // 18:00

  private constructor(props: TimeSlotProps) {
    super(props)
  }

  /**
   * Validate time slot without creating an instance
   *
   * Useful for validation in forms before creating the object.
   */
  static validate(startTime: string, endTime: string): TimeSlotValidation {
    // Parse times
    const startParsed = TimeSlot.parseTime(startTime)
    const endParsed = TimeSlot.parseTime(endTime)

    if (!startParsed.isValid) {
      return { isValid: false, error: `Ogiltig starttid: ${startParsed.error}` }
    }

    if (!endParsed.isValid) {
      return { isValid: false, error: `Ogiltig sluttid: ${endParsed.error}` }
    }

    const startMinutes = startParsed.minutes!
    const endMinutes = endParsed.minutes!
    const durationMinutes = endMinutes - startMinutes

    // End time must be after start time
    if (endMinutes <= startMinutes) {
      return { isValid: false, error: 'Sluttid måste vara efter starttid' }
    }

    // Minimum duration
    if (durationMinutes < TimeSlot.MIN_DURATION_MINUTES) {
      return { isValid: false, error: 'Bokning måste vara minst 15 minuter' }
    }

    // Maximum duration
    if (durationMinutes > TimeSlot.MAX_DURATION_MINUTES) {
      return { isValid: false, error: 'Bokning kan inte överstiga 8 timmar' }
    }

    // Business hours
    const startHour = Math.floor(startMinutes / 60)
    const endHour = Math.floor(endMinutes / 60)

    if (startHour < TimeSlot.BUSINESS_HOURS_START || endHour > TimeSlot.BUSINESS_HOURS_END) {
      return { isValid: false, error: 'Bokning måste vara inom öppettider (08:00-18:00)' }
    }

    return { isValid: true }
  }

  /**
   * Create a TimeSlot with validation
   *
   * @returns Result with TimeSlot on success, error message on failure
   */
  static create(startTime: string, endTime: string): Result<TimeSlot, string> {
    const validation = TimeSlot.validate(startTime, endTime)

    if (!validation.isValid) {
      return Result.fail(validation.error!)
    }

    const startMinutes = TimeSlot.toMinutes(startTime)
    const endMinutes = TimeSlot.toMinutes(endTime)
    const durationMinutes = endMinutes - startMinutes

    return Result.ok(new TimeSlot({
      startTime: TimeSlot.normalizeTime(startTime),
      endTime: TimeSlot.normalizeTime(endTime),
      durationMinutes,
    }))
  }

  /**
   * Create a TimeSlot from start time and duration
   *
   * Useful when creating from service duration.
   */
  static fromDuration(startTime: string, durationMinutes: number): Result<TimeSlot, string> {
    const startParsed = TimeSlot.parseTime(startTime)

    if (!startParsed.isValid) {
      return Result.fail(`Ogiltig starttid: ${startParsed.error}`)
    }

    const startMinutes = startParsed.minutes!
    const endMinutes = startMinutes + durationMinutes

    // Convert back to HH:MM
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`

    return TimeSlot.create(startTime, endTime)
  }

  // ==========================================
  // Getters
  // ==========================================

  get startTime(): string {
    return this.props.startTime
  }

  get endTime(): string {
    return this.props.endTime
  }

  get durationMinutes(): number {
    return this.props.durationMinutes
  }

  // ==========================================
  // Business Logic Methods
  // ==========================================

  /**
   * Check if this time slot overlaps with another
   */
  overlaps(other: TimeSlot): boolean {
    const thisStart = TimeSlot.toMinutes(this.startTime)
    const thisEnd = TimeSlot.toMinutes(this.endTime)
    const otherStart = TimeSlot.toMinutes(other.startTime)
    const otherEnd = TimeSlot.toMinutes(other.endTime)

    // Overlap: start1 < end2 && start2 < end1
    return thisStart < otherEnd && otherStart < thisEnd
  }

  /**
   * Check if this time slot contains another
   */
  contains(other: TimeSlot): boolean {
    const thisStart = TimeSlot.toMinutes(this.startTime)
    const thisEnd = TimeSlot.toMinutes(this.endTime)
    const otherStart = TimeSlot.toMinutes(other.startTime)
    const otherEnd = TimeSlot.toMinutes(other.endTime)

    return thisStart <= otherStart && thisEnd >= otherEnd
  }

  /**
   * Check if this time slot is adjacent to another (end of one = start of other)
   */
  isAdjacentTo(other: TimeSlot): boolean {
    const thisEnd = TimeSlot.toMinutes(this.endTime)
    const otherStart = TimeSlot.toMinutes(other.startTime)
    const otherEnd = TimeSlot.toMinutes(other.endTime)
    const thisStart = TimeSlot.toMinutes(this.startTime)

    return thisEnd === otherStart || otherEnd === thisStart
  }

  /**
   * Get a human-readable string representation
   */
  toString(): string {
    return `${this.startTime}-${this.endTime}`
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Parse time string "HH:MM" to validation result
   */
  private static parseTime(time: string): { isValid: boolean; minutes?: number; error?: string } {
    if (!time || typeof time !== 'string') {
      return { isValid: false, error: 'Tid krävs' }
    }

    // Normalize to HH:MM (remove seconds if present)
    const normalized = time.substring(0, 5)
    const match = normalized.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/)

    if (!match) {
      return { isValid: false, error: 'Måste vara i format HH:MM (00:00-23:59)' }
    }

    const hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)

    return { isValid: true, minutes: hours * 60 + minutes }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private static toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Normalize time string to HH:MM format
   */
  private static normalizeTime(time: string): string {
    return time.substring(0, 5)
  }
}
