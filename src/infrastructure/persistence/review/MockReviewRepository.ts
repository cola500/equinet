/**
 * MockReviewRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * No database required.
 */
import type {
  IReviewRepository,
  Review,
  ReviewWithRelations,
  CreateReviewData,
} from './IReviewRepository'

export class MockReviewRepository implements IReviewRepository {
  private reviews: Map<string, Review> = new Map()

  async findById(id: string): Promise<Review | null> {
    return this.reviews.get(id) || null
  }

  async findMany(): Promise<Review[]> {
    return Array.from(this.reviews.values())
  }

  async save(entity: Review): Promise<Review> {
    this.reviews.set(entity.id, entity)
    return entity
  }

  async delete(id: string): Promise<void> {
    this.reviews.delete(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.reviews.has(id)
  }

  // ==========================================
  // QUERY METHODS
  // ==========================================

  async findByBookingId(bookingId: string): Promise<Review | null> {
    for (const review of this.reviews.values()) {
      if (review.bookingId === bookingId) return review
    }
    return null
  }

  async findByProviderId(providerId: string): Promise<ReviewWithRelations[]> {
    return Array.from(this.reviews.values())
      .filter((r) => r.providerId === providerId)
      .map((r) => this.toRelations(r))
  }

  async findByCustomerId(customerId: string): Promise<ReviewWithRelations[]> {
    return Array.from(this.reviews.values())
      .filter((r) => r.customerId === customerId)
      .map((r) => this.toRelations(r))
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  async findByIdForCustomer(id: string, customerId: string): Promise<Review | null> {
    const review = this.reviews.get(id)
    if (!review || review.customerId !== customerId) return null
    return review
  }

  async create(data: CreateReviewData): Promise<Review> {
    const review: Review = {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rating: data.rating,
      comment: data.comment,
      bookingId: data.bookingId,
      customerId: data.customerId,
      providerId: data.providerId,
      reply: null,
      repliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.reviews.set(review.id, review)
    return review
  }

  async updateWithAuth(
    id: string,
    data: { rating: number; comment: string | null },
    customerId: string
  ): Promise<Review | null> {
    const review = this.reviews.get(id)
    if (!review || review.customerId !== customerId) return null

    const updated = { ...review, ...data, updatedAt: new Date() }
    this.reviews.set(id, updated)
    return updated
  }

  async deleteWithAuth(id: string, customerId: string): Promise<boolean> {
    const review = this.reviews.get(id)
    if (!review || review.customerId !== customerId) return false

    this.reviews.delete(id)
    return true
  }

  async addReplyWithAuth(id: string, reply: string, providerId: string): Promise<Review | null> {
    const review = this.reviews.get(id)
    if (!review || review.providerId !== providerId) return null

    const updated = { ...review, reply, repliedAt: new Date(), updatedAt: new Date() }
    this.reviews.set(id, updated)
    return updated
  }

  async deleteReplyWithAuth(id: string, providerId: string): Promise<Review | null> {
    const review = this.reviews.get(id)
    if (!review || review.providerId !== providerId) return null

    const updated = { ...review, reply: null, repliedAt: null, updatedAt: new Date() }
    this.reviews.set(id, updated)
    return updated
  }

  // ==========================================
  // TEST HELPERS
  // ==========================================

  clear(): void {
    this.reviews.clear()
  }

  seed(reviews: Review[]): void {
    for (const review of reviews) {
      this.reviews.set(review.id, review)
    }
  }

  getAll(): Review[] {
    return Array.from(this.reviews.values())
  }

  // Private: minimal stub for ReviewWithRelations in tests
  private toRelations(review: Review): ReviewWithRelations {
    return {
      ...review,
      customer: { firstName: 'Test', lastName: 'User' },
      provider: { businessName: 'Test Provider' },
      booking: { service: { name: 'Test Service' } },
    }
  }
}
