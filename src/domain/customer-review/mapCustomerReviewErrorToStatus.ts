/**
 * Maps CustomerReviewError types to HTTP status codes.
 * Shared by all customer-review routes (DRY -- not duplicated per route).
 */
import type { CustomerReviewError } from './CustomerReviewService'

export function mapCustomerReviewErrorToStatus(error: CustomerReviewError): number {
  switch (error.type) {
    case 'BOOKING_NOT_FOUND':
      return 404
    case 'UNAUTHORIZED':
      return 403
    case 'BOOKING_NOT_COMPLETED':
      return 400
    case 'ALREADY_REVIEWED':
      return 409
    default:
      return 500
  }
}
