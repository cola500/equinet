/**
 * IReviewRepository - Repository interface for Review aggregate
 *
 * Defines data access operations for reviews.
 * Domain layer depends on this interface, not the implementation.
 */
import { IRepository } from '../BaseRepository'

// Core Review entity (maps to Prisma schema)
export interface Review {
  id: string
  rating: number
  comment: string | null
  bookingId: string
  customerId: string
  providerId: string
  reply: string | null
  repliedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Review with relations for API responses
export interface ReviewWithRelations extends Review {
  customer: {
    firstName: string
    lastName: string
  }
  provider: {
    businessName: string
  }
  booking: {
    service: { name: string } | null
  }
}

// Data needed to create a review
export interface CreateReviewData {
  rating: number
  comment: string | null
  bookingId: string
  customerId: string
  providerId: string
}

export interface IReviewRepository extends IRepository<Review> {
  // ==========================================
  // QUERY METHODS
  // ==========================================

  /**
   * Find review by booking ID
   */
  findByBookingId(bookingId: string): Promise<Review | null>

  /**
   * Find all reviews for a provider (with relations for display)
   */
  findByProviderId(providerId: string): Promise<ReviewWithRelations[]>

  /**
   * Find all reviews by a customer (with relations for display)
   */
  findByCustomerId(customerId: string): Promise<ReviewWithRelations[]>

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Find review by ID only if it belongs to the customer
   *
   * @param id - Review ID
   * @param customerId - Customer ID for authorization
   * @returns Review if found and authorized, null otherwise
   */
  findByIdForCustomer(id: string, customerId: string): Promise<Review | null>

  /**
   * Create a new review
   *
   * @param data - Review data
   * @returns Created review
   */
  create(data: CreateReviewData): Promise<Review>

  /**
   * Update review with atomic authorization check
   *
   * @param id - Review ID
   * @param data - Fields to update
   * @param customerId - Customer ID for authorization
   * @returns Updated review, or null if not found/unauthorized
   */
  updateWithAuth(
    id: string,
    data: { rating: number; comment: string | null },
    customerId: string
  ): Promise<Review | null>

  /**
   * Delete review with atomic authorization check
   *
   * @param id - Review ID
   * @param customerId - Customer ID for authorization
   * @returns true if deleted, false if not found/unauthorized
   */
  deleteWithAuth(id: string, customerId: string): Promise<boolean>

  /**
   * Add reply to review with provider authorization check
   *
   * @param id - Review ID
   * @param reply - Reply text
   * @param providerId - Provider ID for authorization
   * @returns Updated review, or null if not found/unauthorized
   */
  addReplyWithAuth(id: string, reply: string, providerId: string): Promise<Review | null>

  /**
   * Delete reply from review with provider authorization check
   *
   * @param id - Review ID
   * @param providerId - Provider ID for authorization
   * @returns Updated review, or null if not found/unauthorized
   */
  deleteReplyWithAuth(id: string, providerId: string): Promise<Review | null>
}
