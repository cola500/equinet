/**
 * ICustomerReviewRepository - Repository interface for CustomerReview aggregate
 *
 * Defines data access operations for customer reviews (provider → customer).
 * Domain layer depends on this interface, not the implementation.
 */
import { IRepository } from '../BaseRepository'

// Core CustomerReview entity (maps to Prisma schema, immutable - no updatedAt)
export interface CustomerReview {
  id: string
  rating: number
  comment: string | null
  bookingId: string
  providerId: string
  customerId: string
  createdAt: Date
}

// CustomerReview with relations for API responses
export interface CustomerReviewWithRelations extends CustomerReview {
  customer: {
    firstName: string
    lastName: string
  }
  booking: {
    service: { name: string } | null
    bookingDate: Date
  }
}

// Data needed to create a customer review
export interface CreateCustomerReviewData {
  rating: number
  comment: string | null
  bookingId: string
  providerId: string
  customerId: string
}

export interface ICustomerReviewRepository extends IRepository<CustomerReview> {
  /**
   * Find review by booking ID
   */
  findByBookingId(bookingId: string): Promise<CustomerReview | null>

  /**
   * Find all reviews by a provider (with relations for display)
   */
  findByProviderId(providerId: string): Promise<CustomerReviewWithRelations[]>

  /**
   * Create a new customer review
   */
  create(data: CreateCustomerReviewData): Promise<CustomerReview>
}
