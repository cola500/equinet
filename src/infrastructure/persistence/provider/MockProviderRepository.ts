/**
 * MockProviderRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * No database required.
 */
import type { IProviderRepository, Provider, ProviderFilters } from './IProviderRepository'

export class MockProviderRepository implements IProviderRepository {
  private providers: Map<string, Provider> = new Map()

  async findById(id: string): Promise<Provider | null> {
    return this.providers.get(id) || null
  }

  async findMany(criteria?: Record<string, any>): Promise<Provider[]> {
    // Simple implementation for base interface compatibility
    return Array.from(this.providers.values())
  }

  async findAll(filters?: ProviderFilters): Promise<Provider[]> {
    let results = Array.from(this.providers.values())

    if (!filters) {
      return results
    }

    // Filter by city
    if (filters.city) {
      results = results.filter((p) => p.city === filters.city)
    }

    // Filter by active status
    if (filters.isActive !== undefined) {
      results = results.filter((p) => p.isActive === filters.isActive)
    }

    // Search in businessName or description
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      results = results.filter((p) => {
        const inBusinessName = p.businessName.toLowerCase().includes(searchLower)
        const inDescription = p.description?.toLowerCase().includes(searchLower) || false
        return inBusinessName || inDescription
      })
    }

    return results
  }

  async findByUserId(userId: string): Promise<Provider | null> {
    for (const provider of this.providers.values()) {
      if (provider.userId === userId) {
        return provider
      }
    }
    return null
  }

  async save(entity: Provider): Promise<Provider> {
    this.providers.set(entity.id, entity)
    return entity
  }

  async delete(id: string): Promise<void> {
    this.providers.delete(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.providers.has(id)
  }

  // Test helpers
  clear(): void {
    this.providers.clear()
  }

  getAll(): Provider[] {
    return Array.from(this.providers.values())
  }
}
