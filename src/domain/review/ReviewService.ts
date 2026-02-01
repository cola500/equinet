/**
 * ReviewService - Domain service for Review aggregate
 *
 * Contains business rules for creating reviews and managing replies.
 * Uses Result pattern for explicit error handling.
 */
import { Result } from '@/domain/shared'
import type { IReviewRepository, Review } from '@/infrastructure/persistence/review/IReviewRepository'
import { NotificationType, type CreateNotificationInput } from '@/domain/notification/NotificationService'
import { customerName, truncate } from '@/lib/notification-helpers'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface BookingForReview {
  id: string
  customerId: string
  providerId: string
  status: string
  hasReview: boolean
  customer: { firstName: string; lastName: string }
  service: { name: string } | null
}

export interface ReviewServiceDeps {
  reviewRepository: IReviewRepository
  getBooking: (id: string) => Promise<BookingForReview | null>
  getProviderUserId: (providerId: string) => Promise<string | null>
  notificationService?: {
    createAsync: (input: CreateNotificationInput) => void | Promise<void>
  }
}

export interface CreateReviewInput {
  bookingId: string
  customerId: string
  rating: number
  comment: string | null
}

export interface AddReplyInput {
  reviewId: string
  reply: string
  providerId: string
}

export interface DeleteReplyInput {
  reviewId: string
  providerId: string
}

// Error types
export type ReviewErrorType =
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_COMPLETED'
  | 'ALREADY_REVIEWED'
  | 'UNAUTHORIZED'
  | 'REVIEW_NOT_FOUND'
  | 'ALREADY_REPLIED'

export interface ReviewError {
  type: ReviewErrorType
  message: string
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class ReviewService {
  private readonly reviewRepo: IReviewRepository
  private readonly getBooking: ReviewServiceDeps['getBooking']
  private readonly getProviderUserId: ReviewServiceDeps['getProviderUserId']
  private readonly notificationService?: ReviewServiceDeps['notificationService']

  constructor(deps: ReviewServiceDeps) {
    this.reviewRepo = deps.reviewRepository
    this.getBooking = deps.getBooking
    this.getProviderUserId = deps.getProviderUserId
    this.notificationService = deps.notificationService
  }

  async createReview(input: CreateReviewInput): Promise<Result<Review, ReviewError>> {
    // 1. Find booking
    const booking = await this.getBooking(input.bookingId)
    if (!booking) {
      return Result.fail({ type: 'BOOKING_NOT_FOUND', message: 'Booking not found' })
    }

    // 2. Authorization: customer must own the booking
    if (booking.customerId !== input.customerId) {
      return Result.fail({ type: 'UNAUTHORIZED', message: 'Not authorized' })
    }

    // 3. Business rule: booking must be completed
    if (booking.status !== 'completed') {
      return Result.fail({
        type: 'BOOKING_NOT_COMPLETED',
        message: 'Only completed bookings can be reviewed',
      })
    }

    // 4. Business rule: one review per booking
    if (booking.hasReview) {
      return Result.fail({
        type: 'ALREADY_REVIEWED',
        message: 'Review already exists for this booking',
      })
    }

    // 5. Create review
    const review = await this.reviewRepo.create({
      rating: input.rating,
      comment: input.comment,
      bookingId: booking.id,
      customerId: input.customerId,
      providerId: booking.providerId,
    })

    // 6. Notification (fire-and-forget side effect)
    this.sendReviewNotification(booking, review, input)

    return Result.ok(review)
  }

  async addReply(input: AddReplyInput): Promise<Result<Review, ReviewError>> {
    // 1. Find review
    const review = await this.reviewRepo.findById(input.reviewId)
    if (!review) {
      return Result.fail({ type: 'REVIEW_NOT_FOUND', message: 'Review not found' })
    }

    // 2. Authorization: provider must own the review
    if (review.providerId !== input.providerId) {
      return Result.fail({ type: 'UNAUTHORIZED', message: 'Not authorized' })
    }

    // 3. Business rule: only one reply per review
    if (review.reply) {
      return Result.fail({
        type: 'ALREADY_REPLIED',
        message: 'Reply already exists for this review',
      })
    }

    // 4. Add reply via repository
    const updated = await this.reviewRepo.addReplyWithAuth(input.reviewId, input.reply, input.providerId)
    if (!updated) {
      return Result.fail({ type: 'REVIEW_NOT_FOUND', message: 'Review not found' })
    }

    return Result.ok(updated)
  }

  async deleteReply(input: DeleteReplyInput): Promise<Result<Review, ReviewError>> {
    // 1. Find review
    const review = await this.reviewRepo.findById(input.reviewId)
    if (!review) {
      return Result.fail({ type: 'REVIEW_NOT_FOUND', message: 'Review not found' })
    }

    // 2. Authorization: provider must own the review
    if (review.providerId !== input.providerId) {
      return Result.fail({ type: 'UNAUTHORIZED', message: 'Not authorized' })
    }

    // 3. Delete reply via repository
    const updated = await this.reviewRepo.deleteReplyWithAuth(input.reviewId, input.providerId)
    if (!updated) {
      return Result.fail({ type: 'REVIEW_NOT_FOUND', message: 'Review not found' })
    }

    return Result.ok(updated)
  }

  // -----------------------------------------------------------
  // Private
  // -----------------------------------------------------------

  private async sendReviewNotification(
    booking: BookingForReview,
    review: Review,
    input: CreateReviewInput
  ): Promise<void> {
    if (!this.notificationService) return

    const providerUserId = await this.getProviderUserId(booking.providerId)
    if (!providerUserId) return

    const cName = booking.customer
      ? customerName(booking.customer.firstName, booking.customer.lastName)
      : 'Kund'
    const sName = booking.service?.name
    const commentPreview = input.comment ? ` - "${truncate(input.comment)}"` : ''
    const servicePart = sName ? ` för ${sName}` : ''

    this.notificationService.createAsync({
      userId: providerUserId,
      type: NotificationType.REVIEW_RECEIVED,
      message: `Ny recension från ${cName}: ${input.rating}/5${servicePart}${commentPreview}`,
      linkUrl: '/provider/reviews',
      metadata: { reviewId: review.id, bookingId: booking.id },
    })
  }
}
