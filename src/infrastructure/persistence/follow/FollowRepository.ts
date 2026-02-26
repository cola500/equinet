/**
 * FollowRepository - Prisma implementation
 */
import { prisma } from "@/lib/prisma"
import type {
  IFollowRepository,
  Follow,
  FollowWithProvider,
  FollowerInfo,
} from "./IFollowRepository"

export class FollowRepository implements IFollowRepository {
  async create(customerId: string, providerId: string): Promise<Follow> {
    try {
      return await prisma.follow.create({
        data: { customerId, providerId },
        select: {
          id: true,
          customerId: true,
          providerId: true,
          createdAt: true,
        },
      })
    } catch (error) {
      // P2002 = unique constraint violation (already following)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const existing = await this.findByCustomerAndProvider(customerId, providerId)
        if (existing) return existing
      }
      throw error
    }
  }

  async delete(customerId: string, providerId: string): Promise<boolean> {
    try {
      await prisma.follow.delete({
        where: {
          customerId_providerId: { customerId, providerId },
        },
      })
      return true
    } catch (error) {
      // P2025 = record not found
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return false
      }
      throw error
    }
  }

  async findByCustomerAndProvider(
    customerId: string,
    providerId: string
  ): Promise<Follow | null> {
    return prisma.follow.findUnique({
      where: {
        customerId_providerId: { customerId, providerId },
      },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        createdAt: true,
      },
    })
  }

  async findByCustomerIdWithProvider(
    customerId: string
  ): Promise<FollowWithProvider[]> {
    const follows = await prisma.follow.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        createdAt: true,
        provider: {
          select: {
            id: true,
            businessName: true,
            profileImageUrl: true,
          },
        },
      },
    })
    return follows
  }

  async findFollowersInMunicipality(
    providerId: string,
    municipality: string
  ): Promise<FollowerInfo[]> {
    const follows = await prisma.follow.findMany({
      where: {
        providerId,
        customer: {
          municipality,
        },
      },
      select: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    })
    return follows.map((f) => ({
      userId: f.customer.id,
      email: f.customer.email,
      firstName: f.customer.firstName,
    }))
  }

  async countByProvider(providerId: string): Promise<number> {
    return prisma.follow.count({
      where: { providerId },
    })
  }
}

// Singleton
export const followRepository = new FollowRepository()
