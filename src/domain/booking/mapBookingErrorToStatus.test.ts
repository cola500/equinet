import { describe, it, expect } from 'vitest'
import { mapBookingErrorToStatus, mapBookingErrorToMessage } from './mapBookingErrorToStatus'

describe('mapBookingErrorToStatus', () => {
  it('should return 400 for validation errors', () => {
    expect(mapBookingErrorToStatus({ type: 'INVALID_TIMES', message: 'test' })).toBe(400)
    expect(mapBookingErrorToStatus({ type: 'INACTIVE_SERVICE' })).toBe(400)
    expect(mapBookingErrorToStatus({ type: 'INACTIVE_PROVIDER' })).toBe(400)
    expect(mapBookingErrorToStatus({ type: 'SELF_BOOKING' })).toBe(400)
    expect(mapBookingErrorToStatus({ type: 'SERVICE_PROVIDER_MISMATCH' })).toBe(400)
    expect(mapBookingErrorToStatus({ type: 'INVALID_ROUTE_ORDER', message: 'test' })).toBe(400)
  })

  it('should return 409 for overlap errors', () => {
    expect(mapBookingErrorToStatus({ type: 'OVERLAP', message: 'test' })).toBe(409)
  })

  it('should return 400 for INVALID_STATUS_TRANSITION', () => {
    expect(mapBookingErrorToStatus({
      type: 'INVALID_STATUS_TRANSITION',
      message: 'test',
      from: 'pending',
      to: 'completed',
    })).toBe(400)
  })

  it('should return 404 for BOOKING_NOT_FOUND', () => {
    expect(mapBookingErrorToStatus({ type: 'BOOKING_NOT_FOUND' })).toBe(404)
  })

  it('should return 400 for INVALID_CUSTOMER_DATA', () => {
    expect(mapBookingErrorToStatus({ type: 'INVALID_CUSTOMER_DATA', message: 'test' } as never)).toBe(400)
  })

  it('should return 400 for PROVIDER_CLOSED', () => {
    expect(mapBookingErrorToStatus({ type: 'PROVIDER_CLOSED', message: 'Stängd' })).toBe(400)
  })

  it('should return 403 for NEW_CUSTOMER_NOT_ACCEPTED', () => {
    expect(mapBookingErrorToStatus({ type: 'NEW_CUSTOMER_NOT_ACCEPTED' })).toBe(403)
  })

  it('should return 403 for RESCHEDULE_DISABLED', () => {
    expect(mapBookingErrorToStatus({ type: 'RESCHEDULE_DISABLED' })).toBe(403)
  })

  it('should return 400 for RESCHEDULE_WINDOW_PASSED', () => {
    expect(mapBookingErrorToStatus({ type: 'RESCHEDULE_WINDOW_PASSED', hoursRequired: 24 })).toBe(400)
  })

  it('should return 400 for MAX_RESCHEDULES_REACHED', () => {
    expect(mapBookingErrorToStatus({ type: 'MAX_RESCHEDULES_REACHED', max: 2 })).toBe(400)
  })
})

describe('mapBookingErrorToMessage', () => {
  it('should return user-friendly messages', () => {
    expect(mapBookingErrorToMessage({ type: 'INVALID_TIMES', message: 'Custom message' }))
      .toBe('Custom message')
    expect(mapBookingErrorToMessage({ type: 'INACTIVE_SERVICE' }))
      .toBe('Tjänsten är inte längre tillgänglig')
    expect(mapBookingErrorToMessage({ type: 'INACTIVE_PROVIDER' }))
      .toBe('Leverantören är för närvarande inte tillgänglig')
    expect(mapBookingErrorToMessage({ type: 'SELF_BOOKING' }))
      .toBe('Du kan inte boka din egen tjänst')
    expect(mapBookingErrorToMessage({ type: 'SERVICE_PROVIDER_MISMATCH' }))
      .toBe('Ogiltig tjänst')
    expect(mapBookingErrorToMessage({ type: 'OVERLAP', message: 'Already booked' }))
      .toBe('Already booked')
  })

  it('should return 409 for insufficient travel time errors', () => {
    expect(mapBookingErrorToStatus({
      type: 'INSUFFICIENT_TRAVEL_TIME',
      message: 'Not enough time',
      requiredMinutes: 60,
      actualMinutes: 30,
    })).toBe(409)
  })

  it('should return message for INVALID_STATUS_TRANSITION', () => {
    expect(mapBookingErrorToMessage({
      type: 'INVALID_STATUS_TRANSITION',
      message: 'Custom transition error',
      from: 'pending',
      to: 'completed',
    })).toBe('Custom transition error')
  })

  it('should return message for BOOKING_NOT_FOUND', () => {
    expect(mapBookingErrorToMessage({ type: 'BOOKING_NOT_FOUND' }))
      .toBe('Bokningen hittades inte')
  })

  it('should return the error message for PROVIDER_CLOSED', () => {
    expect(mapBookingErrorToMessage({ type: 'PROVIDER_CLOSED', message: 'Semester' }))
      .toBe('Semester')
  })

  it('should return Swedish message for NEW_CUSTOMER_NOT_ACCEPTED', () => {
    expect(mapBookingErrorToMessage({ type: 'NEW_CUSTOMER_NOT_ACCEPTED' }))
      .toBe('Denna leverantör tar för närvarande inte emot nya kunder')
  })

  it('should return Swedish message for RESCHEDULE_DISABLED', () => {
    expect(mapBookingErrorToMessage({ type: 'RESCHEDULE_DISABLED' }))
      .toBe('Ombokning är inte tillåten för denna leverantör')
  })

  it('should include hours in RESCHEDULE_WINDOW_PASSED message', () => {
    expect(mapBookingErrorToMessage({ type: 'RESCHEDULE_WINDOW_PASSED', hoursRequired: 24 }))
      .toBe('Ombokning måste ske minst 24 timmar före bokningen')
  })

  it('should include max in MAX_RESCHEDULES_REACHED message', () => {
    expect(mapBookingErrorToMessage({ type: 'MAX_RESCHEDULES_REACHED', max: 2 }))
      .toBe('Max antal ombokningar (2) har uppnåtts')
  })
})
