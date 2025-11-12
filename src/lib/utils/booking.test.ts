import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateBookingEndTime,
  isBookingInPast,
  doBookingsOverlap,
  formatBookingStatus,
} from './booking'

describe('calculateBookingEndTime', () => {
  it('should calculate end time correctly for 60 minutes', () => {
    const startTime = '2025-11-15T10:00:00.000Z'
    const duration = 60
    const endTime = calculateBookingEndTime(startTime, duration)

    expect(endTime).toBe('2025-11-15T11:00:00.000Z')
  })

  it('should calculate end time correctly for 90 minutes', () => {
    const startTime = '2025-11-15T14:30:00.000Z'
    const duration = 90
    const endTime = calculateBookingEndTime(startTime, duration)

    expect(endTime).toBe('2025-11-15T16:00:00.000Z')
  })

  it('should handle overnight bookings', () => {
    const startTime = '2025-11-15T23:00:00.000Z'
    const duration = 120
    const endTime = calculateBookingEndTime(startTime, duration)

    expect(endTime).toBe('2025-11-16T01:00:00.000Z')
  })
})

describe('isBookingInPast', () => {
  beforeEach(() => {
    // Mock current time to 2025-11-15 12:00:00
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-11-15T12:00:00.000Z'))
  })

  it('should return true for past bookings', () => {
    const pastTime = '2025-11-15T10:00:00.000Z'
    expect(isBookingInPast(pastTime)).toBe(true)
  })

  it('should return false for future bookings', () => {
    const futureTime = '2025-11-15T14:00:00.000Z'
    expect(isBookingInPast(futureTime)).toBe(false)
  })

  it('should return false for bookings at current time', () => {
    const currentTime = '2025-11-15T12:00:00.000Z'
    expect(isBookingInPast(currentTime)).toBe(false)
  })
})

describe('doBookingsOverlap', () => {
  it('should detect overlapping bookings', () => {
    const booking1Start = '2025-11-15T10:00:00.000Z'
    const booking1Duration = 60 // 10:00 - 11:00
    const booking2Start = '2025-11-15T10:30:00.000Z'
    const booking2Duration = 60 // 10:30 - 11:30

    expect(
      doBookingsOverlap(
        booking1Start,
        booking1Duration,
        booking2Start,
        booking2Duration
      )
    ).toBe(true)
  })

  it('should not detect overlap when bookings are consecutive', () => {
    const booking1Start = '2025-11-15T10:00:00.000Z'
    const booking1Duration = 60 // 10:00 - 11:00
    const booking2Start = '2025-11-15T11:00:00.000Z'
    const booking2Duration = 60 // 11:00 - 12:00

    expect(
      doBookingsOverlap(
        booking1Start,
        booking1Duration,
        booking2Start,
        booking2Duration
      )
    ).toBe(false)
  })

  it('should not detect overlap when bookings are separate', () => {
    const booking1Start = '2025-11-15T10:00:00.000Z'
    const booking1Duration = 60 // 10:00 - 11:00
    const booking2Start = '2025-11-15T14:00:00.000Z'
    const booking2Duration = 60 // 14:00 - 15:00

    expect(
      doBookingsOverlap(
        booking1Start,
        booking1Duration,
        booking2Start,
        booking2Duration
      )
    ).toBe(false)
  })

  it('should detect overlap when one booking is inside another', () => {
    const booking1Start = '2025-11-15T10:00:00.000Z'
    const booking1Duration = 180 // 10:00 - 13:00
    const booking2Start = '2025-11-15T11:00:00.000Z'
    const booking2Duration = 60 // 11:00 - 12:00

    expect(
      doBookingsOverlap(
        booking1Start,
        booking1Duration,
        booking2Start,
        booking2Duration
      )
    ).toBe(true)
  })
})

describe('formatBookingStatus', () => {
  it('should format pending status', () => {
    expect(formatBookingStatus('pending')).toBe('Väntande')
  })

  it('should format confirmed status', () => {
    expect(formatBookingStatus('confirmed')).toBe('Bekräftad')
  })

  it('should format completed status', () => {
    expect(formatBookingStatus('completed')).toBe('Genomförd')
  })

  it('should format cancelled status', () => {
    expect(formatBookingStatus('cancelled')).toBe('Avbokad')
  })
})
