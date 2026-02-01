import { describe, it, expect, beforeEach } from 'vitest'
import { ReviewService } from './ReviewService'
import { MockReviewRepository } from '@/infrastructure/persistence/review/MockReviewRepository'
import type { Review } from '@/infrastructure/persistence/review/IReviewRepository'

// Test fixtures
const makeBooking = (overrides: Partial<BookingForReview> = {}): BookingForReview => ({
  id: 'booking-1',
  customerId: 'customer-1',
  providerId: 'provider-1',
  status: 'completed',
  hasReview: false,
  customer: { firstName: 'Anna', lastName: 'Svensson' },
  service: { name: 'Hovslagning' },
  ...overrides,
})

const makeReview = (overrides: Partial<Review> = {}): Review => ({
  id: 'review-1',
  rating: 4,
  comment: 'Bra service',
  bookingId: 'booking-1',
  customerId: 'customer-1',
  providerId: 'provider-1',
  reply: null,
  repliedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// Simplified booking type for service dependency
interface BookingForReview {
  id: string
  customerId: string
  providerId: string
  status: string
  hasReview: boolean
  customer: { firstName: string; lastName: string }
  service: { name: string } | null
}

describe('ReviewService', () => {
  let reviewRepo: MockReviewRepository
  let service: ReviewService
  let bookings: Map<string, BookingForReview>
  let providerUserIds: Map<string, string>
  let mockNotify: ReturnType<typeof createMockNotify>

  function createMockNotify() {
    const calls: any[] = []
    return {
      createAsync: (data: any) => { calls.push(data) },
      calls,
    }
  }

  beforeEach(() => {
    reviewRepo = new MockReviewRepository()
    bookings = new Map()
    providerUserIds = new Map()
    mockNotify = createMockNotify()

    service = new ReviewService({
      reviewRepository: reviewRepo,
      getBooking: async (id) => bookings.get(id) || null,
      getProviderUserId: async (providerId) => providerUserIds.get(providerId) || null,
      notificationService: mockNotify,
    })
  })

  // -----------------------------------------------------------
  // createReview
  // -----------------------------------------------------------
  describe('createReview', () => {
    it('should fail if booking is not found', async () => {
      const result = await service.createReview({
        bookingId: 'nonexistent',
        customerId: 'customer-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_FOUND')
    })

    it('should fail if customer does not own the booking', async () => {
      bookings.set('booking-1', makeBooking({ customerId: 'other-customer' }))

      const result = await service.createReview({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('UNAUTHORIZED')
    })

    it('should fail if booking is not completed', async () => {
      bookings.set('booking-1', makeBooking({ status: 'confirmed' }))

      const result = await service.createReview({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_COMPLETED')
    })

    it('should fail if booking already has a review', async () => {
      bookings.set('booking-1', makeBooking({ hasReview: true }))

      const result = await service.createReview({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('ALREADY_REVIEWED')
    })

    it('should create review for valid completed booking', async () => {
      bookings.set('booking-1', makeBooking())
      providerUserIds.set('provider-1', 'provider-user-1')

      const result = await service.createReview({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        rating: 5,
        comment: 'Utmarkt!',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.rating).toBe(5)
      expect(result.value.comment).toBe('Utmarkt!')
      expect(result.value.bookingId).toBe('booking-1')
      expect(result.value.customerId).toBe('customer-1')
      expect(result.value.providerId).toBe('provider-1')
    })

    it('should create review without comment', async () => {
      bookings.set('booking-1', makeBooking())

      const result = await service.createReview({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        rating: 3,
        comment: null,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.comment).toBeNull()
    })

    it('should send notification to provider on review creation', async () => {
      bookings.set('booking-1', makeBooking())
      providerUserIds.set('provider-1', 'provider-user-1')

      await service.createReview({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        rating: 5,
        comment: 'Toppen!',
      })

      expect(mockNotify.calls.length).toBe(1)
      expect(mockNotify.calls[0].userId).toBe('provider-user-1')
      expect(mockNotify.calls[0].message).toContain('Anna Svensson')
      expect(mockNotify.calls[0].message).toContain('5/5')
    })
  })

  // -----------------------------------------------------------
  // addReply
  // -----------------------------------------------------------
  describe('addReply', () => {
    it('should fail if review is not found', async () => {
      const result = await service.addReply({
        reviewId: 'nonexistent',
        reply: 'Tack!',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('REVIEW_NOT_FOUND')
    })

    it('should fail if provider does not own the review', async () => {
      reviewRepo.seed([makeReview({ providerId: 'other-provider' })])

      const result = await service.addReply({
        reviewId: 'review-1',
        reply: 'Tack!',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('UNAUTHORIZED')
    })

    it('should fail if review already has a reply', async () => {
      reviewRepo.seed([makeReview({ reply: 'Redan svarat', repliedAt: new Date() })])

      const result = await service.addReply({
        reviewId: 'review-1',
        reply: 'Nytt svar',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('ALREADY_REPLIED')
    })

    it('should add reply for providers own review', async () => {
      reviewRepo.seed([makeReview()])

      const result = await service.addReply({
        reviewId: 'review-1',
        reply: 'Tack for ditt betyg!',
        providerId: 'provider-1',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.reply).toBe('Tack for ditt betyg!')
      expect(result.value.repliedAt).toBeDefined()
    })
  })

  // -----------------------------------------------------------
  // deleteReply
  // -----------------------------------------------------------
  describe('deleteReply', () => {
    it('should fail if review is not found', async () => {
      const result = await service.deleteReply({
        reviewId: 'nonexistent',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('REVIEW_NOT_FOUND')
    })

    it('should fail if provider does not own the review', async () => {
      reviewRepo.seed([makeReview({ reply: 'Tack!', repliedAt: new Date(), providerId: 'other-provider' })])

      const result = await service.deleteReply({
        reviewId: 'review-1',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('UNAUTHORIZED')
    })

    it('should delete reply from providers own review', async () => {
      reviewRepo.seed([makeReview({ reply: 'Tack!', repliedAt: new Date() })])

      const result = await service.deleteReply({
        reviewId: 'review-1',
        providerId: 'provider-1',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.reply).toBeNull()
      expect(result.value.repliedAt).toBeNull()
    })
  })
})
