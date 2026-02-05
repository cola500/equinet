import { describe, it, expect, beforeEach } from 'vitest'
import { CustomerReviewService } from './CustomerReviewService'
import { MockCustomerReviewRepository } from '@/infrastructure/persistence/customer-review/MockCustomerReviewRepository'

// Simplified booking type for service dependency
interface BookingForCustomerReview {
  id: string
  customerId: string
  providerId: string
  status: string
  hasCustomerReview: boolean
  customer: { firstName: string; lastName: string }
  service: { name: string } | null
}

const makeBooking = (overrides: Partial<BookingForCustomerReview> = {}): BookingForCustomerReview => ({
  id: 'booking-1',
  customerId: 'customer-1',
  providerId: 'provider-1',
  status: 'completed',
  hasCustomerReview: false,
  customer: { firstName: 'Anna', lastName: 'Svensson' },
  service: { name: 'Hovslagning' },
  ...overrides,
})

describe('CustomerReviewService', () => {
  let reviewRepo: MockCustomerReviewRepository
  let service: CustomerReviewService
  let bookings: Map<string, BookingForCustomerReview>

  beforeEach(() => {
    reviewRepo = new MockCustomerReviewRepository()
    bookings = new Map()

    service = new CustomerReviewService({
      customerReviewRepository: reviewRepo,
      getBooking: async (id) => bookings.get(id) || null,
    })
  })

  // -----------------------------------------------------------
  // createReview
  // -----------------------------------------------------------
  describe('createReview', () => {
    it('should fail if booking is not found', async () => {
      const result = await service.createReview({
        bookingId: 'nonexistent',
        providerId: 'provider-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_FOUND')
    })

    it('should fail if provider does not own the booking', async () => {
      bookings.set('booking-1', makeBooking({ providerId: 'other-provider' }))

      const result = await service.createReview({
        bookingId: 'booking-1',
        providerId: 'provider-1',
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
        providerId: 'provider-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_COMPLETED')
    })

    it('should fail if booking already has a customer review', async () => {
      bookings.set('booking-1', makeBooking({ hasCustomerReview: true }))

      const result = await service.createReview({
        bookingId: 'booking-1',
        providerId: 'provider-1',
        rating: 5,
        comment: null,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('ALREADY_REVIEWED')
    })

    it('should create review for valid completed booking', async () => {
      bookings.set('booking-1', makeBooking())

      const result = await service.createReview({
        bookingId: 'booking-1',
        providerId: 'provider-1',
        rating: 4,
        comment: 'Bra kund!',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.rating).toBe(4)
      expect(result.value.comment).toBe('Bra kund!')
      expect(result.value.bookingId).toBe('booking-1')
      expect(result.value.providerId).toBe('provider-1')
      expect(result.value.customerId).toBe('customer-1')
    })

    it('should create review without comment', async () => {
      bookings.set('booking-1', makeBooking())

      const result = await service.createReview({
        bookingId: 'booking-1',
        providerId: 'provider-1',
        rating: 3,
        comment: null,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.comment).toBeNull()
    })
  })
})
