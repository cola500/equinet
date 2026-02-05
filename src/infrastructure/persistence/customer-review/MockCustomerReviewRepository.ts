/**
 * MockCustomerReviewRepository - In-memory implementation for testing
 */
import type {
  ICustomerReviewRepository,
  CustomerReview,
  CustomerReviewWithRelations,
  CreateCustomerReviewData,
} from './ICustomerReviewRepository'

export class MockCustomerReviewRepository implements ICustomerReviewRepository {
  private reviews: Map<string, CustomerReview> = new Map()

  async findById(id: string): Promise<CustomerReview | null> {
    return this.reviews.get(id) || null
  }

  async findMany(): Promise<CustomerReview[]> {
    return Array.from(this.reviews.values())
  }

  async save(entity: CustomerReview): Promise<CustomerReview> {
    this.reviews.set(entity.id, entity)
    return entity
  }

  async delete(id: string): Promise<void> {
    this.reviews.delete(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.reviews.has(id)
  }

  async findByBookingId(bookingId: string): Promise<CustomerReview | null> {
    for (const review of this.reviews.values()) {
      if (review.bookingId === bookingId) return review
    }
    return null
  }

  async findByProviderId(providerId: string): Promise<CustomerReviewWithRelations[]> {
    return Array.from(this.reviews.values())
      .filter((r) => r.providerId === providerId)
      .map((r) => ({
        ...r,
        customer: { firstName: 'Test', lastName: 'User' },
        booking: { service: { name: 'Test Service' }, bookingDate: new Date() },
      }))
  }

  async create(data: CreateCustomerReviewData): Promise<CustomerReview> {
    const review: CustomerReview = {
      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rating: data.rating,
      comment: data.comment,
      bookingId: data.bookingId,
      providerId: data.providerId,
      customerId: data.customerId,
      createdAt: new Date(),
    }
    this.reviews.set(review.id, review)
    return review
  }

  // Test helpers
  clear(): void {
    this.reviews.clear()
  }

  seed(reviews: CustomerReview[]): void {
    for (const review of reviews) {
      this.reviews.set(review.id, review)
    }
  }
}
