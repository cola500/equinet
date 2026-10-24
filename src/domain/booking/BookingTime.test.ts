import { describe, it, expect } from 'vitest'
import { getBookingEndInstant, canMarkCompleted } from './BookingTime'

// Base example from booking-payment-scenarios.md:
// 10 November 2026, 10:00–11:00 Swedish time (winter time, UTC+1)
const winterBooking = {
  bookingDate: new Date('2026-11-10T00:00:00.000Z'),
  endTime: '11:00',
  timezone: 'Europe/Stockholm',
}

describe('getBookingEndInstant', () => {
  it('SC-BOOK-006 – sluttid 11:00 svensk vintertid är 10:00 UTC', () => {
    const result = getBookingEndInstant(winterBooking)

    expect(result.isSuccess).toBe(true)
    expect(result.value.toISOString()).toBe('2026-11-10T10:00:00.000Z')
  })

  it('SC-BOOK-007 – sluttid 11:00 på sommartidens första dag är 09:00 UTC', () => {
    const result = getBookingEndInstant({
      bookingDate: new Date('2027-03-28T00:00:00.000Z'),
      endTime: '11:00',
      timezone: 'Europe/Stockholm',
    })

    expect(result.isSuccess).toBe(true)
    expect(result.value.toISOString()).toBe('2027-03-28T09:00:00.000Z')
  })

  it.each([
    ['UTC-midnatt (API)', '2026-11-10T00:00:00.000Z'],
    ['lokal midnatt (seed/demo)', '2026-11-09T23:00:00.000Z'],
    ['lokal 10:00 (E2E-seed)', '2026-11-10T09:00:00.000Z'],
  ])('ger samma sluttid oavsett lagringsvariant: %s', (_label, stored) => {
    const result = getBookingEndInstant({ ...winterBooking, bookingDate: new Date(stored) })

    expect(result.isSuccess).toBe(true)
    expect(result.value.toISOString()).toBe('2026-11-10T10:00:00.000Z')
  })

  it('accepterar bookingDate som ISO-sträng (klientdata)', () => {
    const result = getBookingEndInstant({ ...winterBooking, bookingDate: '2026-11-09T23:00:00.000Z' })

    expect(result.isSuccess).toBe(true)
    expect(result.value.toISOString()).toBe('2026-11-10T10:00:00.000Z')
  })

  it('ogiltig tidszon ger fel i stället för en gissad förskjutning', () => {
    const result = getBookingEndInstant({ ...winterBooking, timezone: 'Mars/Olympus_Mons' })

    expect(result.isFailure).toBe(true)
    expect(result.error).toBe('INVALID_TIMEZONE')
  })

  it('ogiltig sluttid ger fel', () => {
    const result = getBookingEndInstant({ ...winterBooking, endTime: '25:99' })

    expect(result.isFailure).toBe(true)
    expect(result.error).toBe('INVALID_TIME')
  })
})

describe('canMarkCompleted', () => {
  it('SC-BOOK-004 – false en minut före sluttid', () => {
    expect(canMarkCompleted(winterBooking, new Date('2026-11-10T09:59:00.000Z'))).toBe(false)
  })

  it('SC-BOOK-005 – true exakt vid sluttid', () => {
    expect(canMarkCompleted(winterBooking, new Date('2026-11-10T10:00:00.000Z'))).toBe(true)
  })

  it('false vid ogiltig tidszon (stänger)', () => {
    expect(
      canMarkCompleted({ ...winterBooking, timezone: 'Nope/Nope' }, new Date('2030-01-01T00:00:00.000Z'))
    ).toBe(false)
  })
})
