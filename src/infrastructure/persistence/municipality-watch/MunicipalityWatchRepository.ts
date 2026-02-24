/**
 * MunicipalityWatchRepository - Prisma implementation
 */
import { prisma } from "@/lib/prisma"
import type { FollowerInfo } from "@/infrastructure/persistence/follow/IFollowRepository"
import type {
  IMunicipalityWatchRepository,
  MunicipalityWatch,
} from "./IMunicipalityWatchRepository"

export class MunicipalityWatchRepository implements IMunicipalityWatchRepository {
  async create(
    customerId: string,
    municipality: string,
    serviceTypeName: string
  ): Promise<MunicipalityWatch> {
    try {
      return await prisma.municipalityWatch.create({
        data: { customerId, municipality, serviceTypeName },
        select: {
          id: true,
          customerId: true,
          municipality: true,
          serviceTypeName: true,
          createdAt: true,
        },
      })
    } catch (error) {
      // P2002 = unique constraint violation (already watching)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const existing = await prisma.municipalityWatch.findFirst({
          where: { customerId, municipality, serviceTypeName },
          select: {
            id: true,
            customerId: true,
            municipality: true,
            serviceTypeName: true,
            createdAt: true,
          },
        })
        if (existing) return existing
      }
      throw error
    }
  }

  async delete(id: string, customerId: string): Promise<boolean> {
    try {
      await prisma.municipalityWatch.delete({
        where: { id, customerId },
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

  async findByCustomerId(customerId: string): Promise<MunicipalityWatch[]> {
    return prisma.municipalityWatch.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerId: true,
        municipality: true,
        serviceTypeName: true,
        createdAt: true,
      },
    })
  }

  async countByCustomerId(customerId: string): Promise<number> {
    return prisma.municipalityWatch.count({
      where: { customerId },
    })
  }

  async findWatchersForAnnouncement(
    municipality: string,
    serviceTypeNames: string[]
  ): Promise<FollowerInfo[]> {
    // Case-insensitive matching using Prisma's mode: 'insensitive'
    const watches = await prisma.municipalityWatch.findMany({
      where: {
        municipality,
        serviceTypeName: {
          in: serviceTypeNames,
          mode: "insensitive",
        },
      },
      select: {
        customerId: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
      distinct: ["customerId"],
    })

    return watches.map((w) => ({
      userId: w.customer.id,
      email: w.customer.email,
      firstName: w.customer.firstName,
    }))
  }
}

// Singleton
export const municipalityWatchRepository = new MunicipalityWatchRepository()
