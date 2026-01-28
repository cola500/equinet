/**
 * MockServiceRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * No database required.
 */
import type { IServiceRepository, Service, ServiceFilters } from './IServiceRepository'

export class MockServiceRepository implements IServiceRepository {
  private services: Map<string, Service> = new Map()

  async findById(id: string): Promise<Service | null> {
    return this.services.get(id) || null
  }

  async findMany(criteria?: Record<string, any>): Promise<Service[]> {
    // Simple implementation for base interface compatibility
    return Array.from(this.services.values())
  }

  async findAll(filters?: ServiceFilters): Promise<Service[]> {
    let results = Array.from(this.services.values())

    if (!filters) {
      return results
    }

    // Filter by providerId
    if (filters.providerId) {
      results = results.filter((s) => s.providerId === filters.providerId)
    }

    // Filter by active status
    if (filters.isActive !== undefined) {
      results = results.filter((s) => s.isActive === filters.isActive)
    }

    // Search in name or description
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      results = results.filter((s) => {
        const inName = s.name.toLowerCase().includes(searchLower)
        const inDescription = s.description?.toLowerCase().includes(searchLower) || false
        return inName || inDescription
      })
    }

    return results
  }

  async findByProviderId(providerId: string): Promise<Service[]> {
    const results: Service[] = []
    for (const service of this.services.values()) {
      if (service.providerId === providerId) {
        results.push(service)
      }
    }
    return results
  }

  async save(entity: Service): Promise<Service> {
    this.services.set(entity.id, entity)
    return entity
  }

  async delete(id: string): Promise<void> {
    this.services.delete(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.services.has(id)
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  async findByIdForProvider(id: string, providerId: string): Promise<Service | null> {
    const service = this.services.get(id)
    if (!service || service.providerId !== providerId) return null
    return service
  }

  async updateWithAuth(
    id: string,
    data: Partial<Omit<Service, 'id' | 'providerId' | 'createdAt'>>,
    providerId: string
  ): Promise<Service | null> {
    const service = this.services.get(id)
    if (!service || service.providerId !== providerId) return null

    const updated = { ...service, ...data, updatedAt: new Date() }
    this.services.set(id, updated)
    return updated
  }

  async deleteWithAuth(id: string, providerId: string): Promise<boolean> {
    const service = this.services.get(id)
    if (!service || service.providerId !== providerId) return false

    this.services.delete(id)
    return true
  }

  // Test helpers
  clear(): void {
    this.services.clear()
  }

  getAll(): Service[] {
    return Array.from(this.services.values())
  }
}
