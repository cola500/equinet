/**
 * CustomerReviewService - Domain service for CustomerReview aggregate
 *
 * Contains business rules for providers reviewing customers after completed bookings.
 * Uses Result pattern for explicit error handling.
 * Immutable: no edit/delete operations.
 */
import { Result } from '@/domain/shared'
import type { ICustomerReviewRepository, CustomerReview } from '@/infrastructure/persistence/customer-review/ICustomerReviewRepository'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface BookingForCustomerReview {
  id: string
  customerId: string
  providerId: string
  status: string
  hasCustomerReview: boolean
  customer: { firstName: string; lastName: string }
  service: { name: string } | null
}

export interface CustomerReviewServiceDeps {
  customerReviewRepository: ICustomerReviewRepository
  getBooking: (id: string) => Promise<BookingForCustomerReview | null>
}

export interface CreateCustomerReviewInput {
  bookingId: string
  providerId: string
  rating: number
  comment: string | null
}

// Error types
export type CustomerReviewErrorType =
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_COMPLETED'
  | 'ALREADY_REVIEWED'
  | 'UNAUTHORIZED'

export interface CustomerReviewError {
  type: CustomerReviewErrorType
  message: string
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class CustomerReviewService {
  private readonly reviewRepo: ICustomerReviewRepository
  private readonly getBooking: CustomerReviewServiceDeps['getBooking']

  constructor(deps: CustomerReviewServiceDeps) {
    this.reviewRepo = deps.customerReviewRepository
    this.getBooking = deps.getBooking
  }

  async createReview(input: CreateCustomerReviewInput): Promise<Result<CustomerReview, CustomerReviewError>> {
    // 1. Find booking
    const booking = await this.getBooking(input.bookingId)
    if (!booking) {
      return Result.fail({ type: 'BOOKING_NOT_FOUND', message: 'Booking not found' })
    }

    // 2. Authorization: provider must own the booking
    if (booking.providerId !== input.providerId) {
      return Result.fail({ type: 'UNAUTHORIZED', message: 'Not authorized' })
    }

    // 3. Business rule: booking must be completed
    if (booking.status !== 'completed') {
      return Result.fail({
        type: 'BOOKING_NOT_COMPLETED',
        message: 'Only completed bookings can be reviewed',
      })
    }

    // 4. Business rule: one customer review per booking
    if (booking.hasCustomerReview) {
      return Result.fail({
        type: 'ALREADY_REVIEWED',
        message: 'Customer review already exists for this booking',
      })
    }

    // 5. Create review
    const review = await this.reviewRepo.create({
      rating: input.rating,
      comment: input.comment,
      bookingId: booking.id,
      providerId: input.providerId,
      customerId: booking.customerId,
    })

    return Result.ok(review)
  }
}
