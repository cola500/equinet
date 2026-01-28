/**
 * ProviderRepository - Prisma implementation
 *
 * Handles data persistence for Provider aggregate using Prisma ORM.
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IProviderRepository,
  Provider,
  ProviderFilters,
  ProviderWithDetails,
  ProviderWithFullDetails,
  ProviderForEdit,
} from './IProviderRepository'

export class ProviderRepository implements IProviderRepository {
  async findById(id: string): Promise<Provider | null> {
    const provider = await prisma.provider.findUnique({
      where: { id },
    })

    return provider
  }

  async findMany(criteria?: Record<string, any>): Promise<Provider[]> {
    const providers = await prisma.provider.findMany(criteria as any)
    return providers
  }

  async findAll(filters?: ProviderFilters): Promise<Provider[]> {
    const where: any = {}

    // Build where clause based on filters
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters?.city) {
      where.city = {
        startsWith: filters.city,
        mode: 'insensitive',
      }
    }

    if (filters?.search) {
      where.OR = [
        { businessName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const providers = await prisma.provider.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return providers
  }

  async findByUserId(userId: string): Promise<Provider | null> {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    })

    return provider
  }

  async findAllWithDetails(filters?: ProviderFilters): Promise<ProviderWithDetails[]> {
    const where: any = {}

    // Build where clause based on filters
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters?.city) {
      where.city = {
        startsWith: filters.city,
        mode: 'insensitive',
      }
    }

    if (filters?.search) {
      where.OR = [
        { businessName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Bounding box filter - pre-filter in database before exact distance calc
    if (filters?.boundingBox) {
      const { minLat, maxLat, minLng, maxLng } = filters.boundingBox
      where.latitude = {
        gte: minLat,
        lte: maxLat,
      }
      where.longitude = {
        gte: minLng,
        lte: maxLng,
      }
    }

    const providers = await prisma.provider.findMany({
      where,
      select: {
        id: true,
        userId: true,
        businessName: true,
        description: true,
        city: true,
        latitude: true,
        longitude: true,
        serviceAreaKm: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        services: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return providers as ProviderWithDetails[]
  }

  async save(entity: Provider): Promise<Provider> {
    // Check if provider exists
    const exists = await this.exists(entity.id)

    if (exists) {
      // Update existing
      const updated = await prisma.provider.update({
        where: { id: entity.id },
        data: {
          businessName: entity.businessName,
          description: entity.description,
          city: entity.city,
          isActive: entity.isActive,
          updatedAt: new Date(),
        },
      })
      return updated
    } else {
      // Create new
      const created = await prisma.provider.create({
        data: {
          id: entity.id,
          userId: entity.userId,
          businessName: entity.businessName,
          description: entity.description,
          city: entity.city,
          isActive: entity.isActive,
        },
      })
      return created
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.provider.delete({
        where: { id },
      })
    } catch (error) {
      // If provider doesn't exist, Prisma throws an error
      // We silently ignore it as per the contract
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.provider.count({
      where: { id },
    })
    return count > 0
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Find provider by ID with full details for public API
   * Only returns active providers with active services
   */
  async findByIdWithPublicDetails(id: string): Promise<ProviderWithFullDetails | null> {
    const provider = await prisma.provider.findUnique({
      where: {
        id,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        businessName: true,
        description: true,
        city: true,
        address: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        serviceAreaKm: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
          },
        },
        availability: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            isActive: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    })

    return provider as ProviderWithFullDetails | null
  }

  /**
   * Find provider by ID for owner (includes fields needed for editing)
   */
  async findByIdForOwner(id: string, userId: string): Promise<ProviderForEdit | null> {
    const provider = await prisma.provider.findFirst({
      where: {
        id,
        userId, // Authorization check in WHERE clause
      },
      select: {
        id: true,
        userId: true,
        address: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
      },
    })

    return provider
  }

  /**
   * Update provider with atomic authorization check
   */
  async updateWithAuth(
    id: string,
    data: Partial<Omit<Provider, 'id' | 'userId' | 'createdAt'>> & {
      latitude?: number | null
      longitude?: number | null
      address?: string | null
      postalCode?: string | null
      serviceAreaKm?: number | null
      profileImageUrl?: string | null
    },
    userId: string
  ): Promise<Provider | null> {
    try {
      // Atomic update: WHERE includes both id AND userId
      const updated = await prisma.provider.update({
        where: {
          id,
          userId, // Authorization check in WHERE clause
        },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      })

      return updated
    } catch (error) {
      // P2025: Record not found (provider doesn't exist or user doesn't own it)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      console.error(`Failed to update provider ${id}:`, error)
      throw error
    }
  }
}
