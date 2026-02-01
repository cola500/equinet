/**
 * Maps GroupBookingError types to HTTP status codes.
 * Shared by all group-booking routes (DRY -- not duplicated per route).
 */
import type { GroupBookingError } from './GroupBookingService'

export function mapGroupBookingErrorToStatus(error: GroupBookingError): number {
  switch (error.type) {
    case 'GROUP_BOOKING_NOT_FOUND':
    case 'PARTICIPANT_NOT_FOUND':
      return 404
    case 'UNAUTHORIZED':
      return 403
    case 'INVALID_STATUS_TRANSITION':
    case 'GROUP_NOT_OPEN':
    case 'GROUP_FULL':
    case 'JOIN_DEADLINE_PASSED':
    case 'NO_ACTIVE_PARTICIPANTS':
    case 'MATCH_FAILED':
    case 'PROVIDER_NOT_FOUND':
      return 400
    case 'ALREADY_JOINED':
      return 409
    default:
      return 500
  }
}
