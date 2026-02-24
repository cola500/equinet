import type { BookingError } from './BookingService'

/**
 * Map BookingError to HTTP status code
 */
export function mapBookingErrorToStatus(error: BookingError): number {
  switch (error.type) {
    case 'INVALID_TIMES':
    case 'INACTIVE_SERVICE':
    case 'INACTIVE_PROVIDER':
    case 'SELF_BOOKING':
    case 'SERVICE_PROVIDER_MISMATCH':
    case 'INVALID_ROUTE_ORDER':
    case 'INVALID_STATUS_TRANSITION':
    case 'INVALID_CUSTOMER_DATA':
    case 'PROVIDER_CLOSED':
      return 400
    case 'GHOST_USER_CREATION_FAILED':
      return 500
    case 'NEW_CUSTOMER_NOT_ACCEPTED':
    case 'RESCHEDULE_DISABLED':
      return 403
    case 'BOOKING_NOT_FOUND':
      return 404
    case 'OVERLAP':
    case 'INSUFFICIENT_TRAVEL_TIME':
      return 409
    case 'RESCHEDULE_WINDOW_PASSED':
    case 'MAX_RESCHEDULES_REACHED':
    case 'INACTIVE_SERVICE_FOR_RESCHEDULE':
      return 400
    default:
      return 500
  }
}

/**
 * Map BookingError to user-friendly message
 */
export function mapBookingErrorToMessage(error: BookingError): string {
  switch (error.type) {
    case 'INVALID_TIMES':
      return error.message
    case 'OVERLAP':
      return error.message
    case 'INSUFFICIENT_TRAVEL_TIME':
      return error.message
    case 'INACTIVE_SERVICE':
      return 'Tjänsten är inte längre tillgänglig'
    case 'INACTIVE_PROVIDER':
      return 'Leverantören är för närvarande inte tillgänglig'
    case 'SELF_BOOKING':
      return 'Du kan inte boka din egen tjänst'
    case 'SERVICE_PROVIDER_MISMATCH':
      return 'Ogiltig tjänst'
    case 'INVALID_ROUTE_ORDER':
      return error.message
    case 'INVALID_STATUS_TRANSITION':
      return error.message
    case 'BOOKING_NOT_FOUND':
      return 'Bokningen hittades inte'
    case 'INVALID_CUSTOMER_DATA':
      return error.message
    case 'GHOST_USER_CREATION_FAILED':
      return error.message
    case 'PROVIDER_CLOSED':
      return error.message
    case 'NEW_CUSTOMER_NOT_ACCEPTED':
      return 'Denna leverantör tar för närvarande inte emot nya kunder'
    case 'RESCHEDULE_DISABLED':
      return 'Ombokning är inte tillåten för denna leverantör'
    case 'RESCHEDULE_WINDOW_PASSED':
      return `Ombokning måste ske minst ${error.hoursRequired} timmar före bokningen`
    case 'MAX_RESCHEDULES_REACHED':
      return `Max antal ombokningar (${error.max}) har uppnåtts`
    case 'INACTIVE_SERVICE_FOR_RESCHEDULE':
      return 'Tjänsten är inte längre tillgänglig'
    default:
      return 'Ett fel uppstod vid bokning'
  }
}
