/**
 * MockProviderRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * No database required.
 */
import type {
  IProviderRepository,
  Provider,
  ProviderFilters,
  ProviderWithDetails,
  ProviderWithFullDetails,
  ProviderForEdit,
} from './IProviderRepository'

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

    // Filter by city (case-insensitive prefix match)
    if (filters.city) {
      const cityLower = filters.city.toLowerCase()
      results = results.filter((p) => p.city?.toLowerCase().startsWith(cityLower))
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

  async findAllWithDetails(filters?: ProviderFilters): Promise<ProviderWithDetails[]> {
    // For mock, return basic providers with empty services/user arrays
    // Real implementation in PrismaProviderRepository includes actual relations
    const providers = await this.findAll(filters)
    return providers.map(p => ({
      ...p,
      latitude: null,
      longitude: null,
      serviceAreaKm: null,
      isVerified: false,
      services: [],
      user: {
        firstName: 'Mock',
        lastName: 'User',
      },
    }))
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

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  async findByIdWithPublicDetails(id: string): Promise<ProviderWithFullDetails | null> {
    const provider = this.providers.get(id)
    if (!provider || !provider.isActive) return null

    return {
      ...provider,
      latitude: null,
      longitude: null,
      serviceAreaKm: null,
      isVerified: false,
      verifiedAt: null,
      address: null,
      postalCode: null,
      services: [],
      availability: [],
      user: {
        firstName: 'Mock',
        lastName: 'User',
        phone: null,
      },
    }
  }

  async findByIdForOwner(id: string, userId: string): Promise<ProviderForEdit | null> {
    const provider = this.providers.get(id)
    if (!provider || provider.userId !== userId) return null

    return {
      id: provider.id,
      userId: provider.userId,
      address: null,
      city: provider.city,
      postalCode: null,
      latitude: null,
      longitude: null,
    }
  }

  async updateWithAuth(
    id: string,
    data: Partial<Omit<Provider, 'id' | 'userId' | 'createdAt'>>,
    userId: string
  ): Promise<Provider | null> {
    const provider = this.providers.get(id)
    if (!provider || provider.userId !== userId) return null

    const updated = { ...provider, ...data, updatedAt: new Date() }
    this.providers.set(id, updated)
    return updated
  }

  // Test helpers
  clear(): void {
    this.providers.clear()
  }

  getAll(): Provider[] {
    return Array.from(this.providers.values())
  }
}
