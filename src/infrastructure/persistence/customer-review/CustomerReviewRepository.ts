/**
 * CustomerReviewRepository - Prisma implementation
 *
 * Handles data persistence for CustomerReview aggregate.
 * Uses `select` (never `include`) to prevent PII leaks.
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  ICustomerReviewRepository,
  CustomerReview,
  CustomerReviewWithRelations,
  CreateCustomerReviewData,
} from './ICustomerReviewRepository'

// Base select for CustomerReview entity
const customerReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  bookingId: true,
  providerId: true,
  customerId: true,
  createdAt: true,
} satisfies Prisma.CustomerReviewSelect

// Extended select with relations for API responses
const customerReviewWithRelationsSelect = {
  ...customerReviewSelect,
  customer: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  booking: {
    select: {
      service: {
        select: { name: true },
      },
      bookingDate: true,
    },
  },
} satisfies Prisma.CustomerReviewSelect

export class CustomerReviewRepository implements ICustomerReviewRepository {
  async findById(id: string): Promise<CustomerReview | null> {
    return prisma.customerReview.findUnique({
      where: { id },
      select: customerReviewSelect,
    })
  }

  async findMany(criteria?: Record<string, unknown>): Promise<CustomerReview[]> {
    return prisma.customerReview.findMany({
      ...(criteria as Prisma.CustomerReviewFindManyArgs),
      select: customerReviewSelect,
    })
  }

  async save(entity: CustomerReview): Promise<CustomerReview> {
    // CustomerReview is immutable - only create, never update
    const exists = await this.exists(entity.id)
    if (exists) {
      // Return existing (immutable)
      const existing = await this.findById(entity.id)
      return existing!
    }

    return prisma.customerReview.create({
      data: {
        id: entity.id,
        rating: entity.rating,
        comment: entity.comment,
        bookingId: entity.bookingId,
        providerId: entity.providerId,
        customerId: entity.customerId,
      },
      select: customerReviewSelect,
    })
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.customerReview.delete({ where: { id } })
    } catch (_error) {
      // Silently ignore if not found (per IRepository contract)
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.customerReview.count({ where: { id } })
    return count > 0
  }

  // ==========================================
  // QUERY METHODS
  // ==========================================

  async findByBookingId(bookingId: string): Promise<CustomerReview | null> {
    return prisma.customerReview.findUnique({
      where: { bookingId },
      select: customerReviewSelect,
    })
  }

  async findByProviderId(providerId: string): Promise<CustomerReviewWithRelations[]> {
    return prisma.customerReview.findMany({
      where: { providerId },
      select: customerReviewWithRelationsSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  // ==========================================
  // COMMAND METHODS
  // ==========================================

  async create(data: CreateCustomerReviewData): Promise<CustomerReview> {
    return prisma.customerReview.create({
      data: {
        rating: data.rating,
        comment: data.comment,
        bookingId: data.bookingId,
        providerId: data.providerId,
        customerId: data.customerId,
      },
      select: customerReviewSelect,
    })
  }
}
