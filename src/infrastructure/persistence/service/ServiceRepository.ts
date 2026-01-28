/**
 * ServiceRepository - Prisma implementation
 *
 * Handles data persistence for Service aggregate using Prisma ORM.
 */
import { prisma } from '@/lib/prisma'
import type { IServiceRepository, Service, ServiceFilters } from './IServiceRepository'

export class ServiceRepository implements IServiceRepository {
  async findById(id: string): Promise<Service | null> {
    const service = await prisma.service.findUnique({
      where: { id },
    })

    return service
  }

  async findMany(criteria?: Record<string, any>): Promise<Service[]> {
    const services = await prisma.service.findMany(criteria as any)
    return services
  }

  async findAll(filters?: ServiceFilters): Promise<Service[]> {
    const where: any = {}

    // Build where clause based on filters
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters?.providerId) {
      where.providerId = filters.providerId
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return services
  }

  async findByProviderId(providerId: string): Promise<Service[]> {
    const services = await prisma.service.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    })

    return services
  }

  async save(entity: Service): Promise<Service> {
    // Check if service exists
    const exists = await this.exists(entity.id)

    if (exists) {
      // Update existing
      const updated = await prisma.service.update({
        where: { id: entity.id },
        data: {
          name: entity.name,
          description: entity.description,
          price: entity.price,
          durationMinutes: entity.durationMinutes,
          isActive: entity.isActive,
        },
      })
      return updated
    } else {
      // Create new
      const created = await prisma.service.create({
        data: {
          id: entity.id,
          providerId: entity.providerId,
          name: entity.name,
          description: entity.description,
          price: entity.price,
          durationMinutes: entity.durationMinutes,
          isActive: entity.isActive,
        },
      })
      return created
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.service.delete({
        where: { id },
      })
    } catch (error) {
      // If service doesn't exist, Prisma throws an error
      // We silently ignore it as per the contract
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.service.count({
      where: { id },
    })
    return count > 0
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Find service by ID only if it belongs to the provider
   */
  async findByIdForProvider(id: string, providerId: string): Promise<Service | null> {
    const service = await prisma.service.findFirst({
      where: {
        id,
        providerId,
      },
    })

    return service
  }

  /**
   * Update service with atomic authorization check
   */
  async updateWithAuth(
    id: string,
    data: Partial<Omit<Service, 'id' | 'providerId' | 'createdAt'>>,
    providerId: string
  ): Promise<Service | null> {
    try {
      // Atomic update: WHERE includes both id AND providerId
      const updated = await prisma.service.update({
        where: {
          id,
          providerId, // Authorization check in WHERE clause
        },
        data,
      })

      return updated
    } catch (error) {
      // P2025: Record not found (service doesn't exist or provider doesn't own it)
      if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
        return null
      }
      throw error
    }
  }

  /**
   * Delete service with atomic authorization check
   */
  async deleteWithAuth(id: string, providerId: string): Promise<boolean> {
    try {
      // Atomic delete: WHERE includes both id AND providerId
      await prisma.service.delete({
        where: {
          id,
          providerId, // Authorization check in WHERE clause
        },
      })
      return true
    } catch (error) {
      // P2025: Record not found (service doesn't exist or provider doesn't own it)
      if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
        return false
      }
      throw error
    }
  }
}
