/**
 * ReviewRepository - Prisma implementation
 *
 * Handles data persistence for Review aggregate using Prisma ORM.
 * Uses `select` (never `include`) to prevent passwordHash leaks.
 * Authorization is atomic in WHERE clauses (IDOR protection).
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IReviewRepository,
  Review,
  ReviewWithRelations,
  CreateReviewData,
} from './IReviewRepository'

// Base select for Review entity (never exposes sensitive user data)
const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  bookingId: true,
  customerId: true,
  providerId: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect

// Extended select with relations for API responses
const reviewWithRelationsSelect = {
  ...reviewSelect,
  customer: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  provider: {
    select: {
      businessName: true,
    },
  },
  booking: {
    select: {
      service: {
        select: { name: true },
      },
    },
  },
} satisfies Prisma.ReviewSelect

export class ReviewRepository implements IReviewRepository {
  async findById(id: string): Promise<Review | null> {
    return prisma.review.findUnique({
      where: { id },
      select: reviewSelect,
    })
  }

  async findMany(criteria?: Record<string, any>): Promise<Review[]> {
    return prisma.review.findMany({
      ...(criteria as any),
      select: reviewSelect,
    })
  }

  async save(entity: Review): Promise<Review> {
    const exists = await this.exists(entity.id)

    if (exists) {
      return prisma.review.update({
        where: { id: entity.id },
        data: {
          rating: entity.rating,
          comment: entity.comment,
          reply: entity.reply,
          repliedAt: entity.repliedAt,
        },
        select: reviewSelect,
      })
    } else {
      return prisma.review.create({
        data: {
          id: entity.id,
          rating: entity.rating,
          comment: entity.comment,
          bookingId: entity.bookingId,
          customerId: entity.customerId,
          providerId: entity.providerId,
          reply: entity.reply,
          repliedAt: entity.repliedAt,
        },
        select: reviewSelect,
      })
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.review.delete({ where: { id } })
    } catch (_error) {
      // Silently ignore if not found (per IRepository contract)
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.review.count({ where: { id } })
    return count > 0
  }

  // ==========================================
  // QUERY METHODS
  // ==========================================

  async findByBookingId(bookingId: string): Promise<Review | null> {
    return prisma.review.findUnique({
      where: { bookingId },
      select: reviewSelect,
    })
  }

  async findByProviderId(providerId: string): Promise<ReviewWithRelations[]> {
    return prisma.review.findMany({
      where: { providerId },
      select: reviewWithRelationsSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByCustomerId(customerId: string): Promise<ReviewWithRelations[]> {
    return prisma.review.findMany({
      where: { customerId },
      select: reviewWithRelationsSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  async findByIdForCustomer(id: string, customerId: string): Promise<Review | null> {
    return prisma.review.findFirst({
      where: { id, customerId },
      select: reviewSelect,
    })
  }

  async create(data: CreateReviewData): Promise<Review> {
    return prisma.review.create({
      data: {
        rating: data.rating,
        comment: data.comment,
        bookingId: data.bookingId,
        customerId: data.customerId,
        providerId: data.providerId,
      },
      select: reviewSelect,
    })
  }

  async updateWithAuth(
    id: string,
    data: { rating: number; comment: string | null },
    customerId: string
  ): Promise<Review | null> {
    try {
      return await prisma.review.update({
        where: { id, customerId },
        data: {
          rating: data.rating,
          comment: data.comment,
        },
        select: reviewSelect,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async deleteWithAuth(id: string, customerId: string): Promise<boolean> {
    try {
      await prisma.review.delete({
        where: { id, customerId },
      })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false
      }
      throw error
    }
  }

  async addReplyWithAuth(id: string, reply: string, providerId: string): Promise<Review | null> {
    try {
      return await prisma.review.update({
        where: { id, providerId },
        data: {
          reply,
          repliedAt: new Date(),
        },
        select: reviewSelect,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async deleteReplyWithAuth(id: string, providerId: string): Promise<Review | null> {
    try {
      return await prisma.review.update({
        where: { id, providerId },
        data: {
          reply: null,
          repliedAt: null,
        },
        select: reviewSelect,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }
}
