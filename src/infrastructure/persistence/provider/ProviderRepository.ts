/**
 * ProviderRepository - Prisma implementation
 *
 * Handles data persistence for Provider aggregate using Prisma ORM.
 */
import { prisma } from '@/lib/prisma'
import type { IProviderRepository, Provider, ProviderFilters, ProviderWithDetails } from './IProviderRepository'

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
        equals: filters.city,
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
        equals: filters.city,
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
}
