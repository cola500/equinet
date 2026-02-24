/**
 * Maps ReviewError types to HTTP status codes.
 * Shared by all review routes (DRY -- not duplicated per route).
 */
import type { ReviewError } from './ReviewService'

export function mapReviewErrorToStatus(error: ReviewError): number {
  switch (error.type) {
    case 'BOOKING_NOT_FOUND':
    case 'REVIEW_NOT_FOUND':
      return 404
    case 'UNAUTHORIZED':
      return 403
    case 'BOOKING_NOT_COMPLETED':
      return 400
    case 'ALREADY_REVIEWED':
    case 'ALREADY_REPLIED':
      return 409
    default:
      return 500
  }
}
