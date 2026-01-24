import { describe, it, expect, beforeEach } from 'vitest'
import { MockProviderRepository } from './MockProviderRepository'
import type { Provider } from './IProviderRepository'

describe('ProviderRepository', () => {
  let repository: MockProviderRepository

  beforeEach(() => {
    repository = new MockProviderRepository()
  })

  describe('findById', () => {
    it('should return provider when found', async () => {
      // Arrange
      const provider: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Test Hovslagare',
        description: 'Professional farrier',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(provider)

      // Act
      const result = await repository.findById('provider-1')

      // Assert
      expect(result).toEqual(provider)
    })

    it('should return null when provider not found', async () => {
      // Act
      const result = await repository.findById('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all providers when no filters', async () => {
      // Arrange
      const provider1: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Stockholm Hovslagare',
        description: 'Test',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const provider2: Provider = {
        id: 'provider-2',
        userId: 'user-2',
        businessName: 'Uppsala Hästvård',
        description: 'Test',
        city: 'Uppsala',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(provider1)
      await repository.save(provider2)

      // Act
      const result = await repository.findAll()

      // Assert
      expect(result).toHaveLength(2)
      expect(result).toContainEqual(provider1)
      expect(result).toContainEqual(provider2)
    })

    it('should filter by city', async () => {
      // Arrange
      const stockholm: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Stockholm Hovslagare',
        description: 'Test',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const uppsala: Provider = {
        id: 'provider-2',
        userId: 'user-2',
        businessName: 'Uppsala Hästvård',
        description: 'Test',
        city: 'Uppsala',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(stockholm)
      await repository.save(uppsala)

      // Act
      const result = await repository.findAll({ city: 'Stockholm' })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(stockholm)
    })

    it('should filter by city with partial match (prefix)', async () => {
      // Arrange
      const uppsala: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Uppsala Hovslagare',
        description: 'Professional farrier in Uppsala',
        city: 'Uppsala',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(uppsala)

      // Act - search with prefix (different cases)
      const prefixResult = await repository.findAll({ city: 'upp' })
      const uppercasePrefixResult = await repository.findAll({ city: 'UPP' })
      const fullMatchResult = await repository.findAll({ city: 'Uppsala' })

      // Assert - all should find the provider
      expect(prefixResult).toHaveLength(1)
      expect(prefixResult[0]).toEqual(uppsala)
      expect(uppercasePrefixResult).toHaveLength(1)
      expect(uppercasePrefixResult[0]).toEqual(uppsala)
      expect(fullMatchResult).toHaveLength(1)
      expect(fullMatchResult[0]).toEqual(uppsala)
    })

    it('should filter by active status', async () => {
      // Arrange
      const active: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Active Provider',
        description: 'Test',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const inactive: Provider = {
        id: 'provider-2',
        userId: 'user-2',
        businessName: 'Inactive Provider',
        description: 'Test',
        city: 'Stockholm',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(active)
      await repository.save(inactive)

      // Act
      const result = await repository.findAll({ isActive: true })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(active)
    })

    it('should search by business name', async () => {
      // Arrange
      const provider1: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Hovslagare Stockholm AB',
        description: 'Professional farrier',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const provider2: Provider = {
        id: 'provider-2',
        userId: 'user-2',
        businessName: 'Uppsala Hästvård',
        description: 'Horse care',
        city: 'Uppsala',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(provider1)
      await repository.save(provider2)

      // Act
      const result = await repository.findAll({ search: 'Hovslagare' })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(provider1)
    })
  })

  describe('save', () => {
    it('should create new provider', async () => {
      // Arrange
      const provider: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Test Provider',
        description: 'Test description',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Act
      const result = await repository.save(provider)

      // Assert
      expect(result).toEqual(provider)
      const found = await repository.findById('provider-1')
      expect(found).toEqual(provider)
    })

    it('should update existing provider', async () => {
      // Arrange
      const original: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Original Name',
        description: 'Original description',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(original)

      const updated: Provider = {
        ...original,
        businessName: 'Updated Name',
        updatedAt: new Date(),
      }

      // Act
      const result = await repository.save(updated)

      // Assert
      expect(result.businessName).toBe('Updated Name')
      const found = await repository.findById('provider-1')
      expect(found?.businessName).toBe('Updated Name')
    })
  })

  describe('delete', () => {
    it('should delete existing provider', async () => {
      // Arrange
      const provider: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Test Provider',
        description: 'Test',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(provider)

      // Act
      await repository.delete('provider-1')

      // Assert
      const found = await repository.findById('provider-1')
      expect(found).toBeNull()
    })

    it('should not throw when deleting non-existent provider', async () => {
      // Act & Assert
      await expect(repository.delete('non-existent')).resolves.not.toThrow()
    })
  })

  describe('exists', () => {
    it('should return true when provider exists', async () => {
      // Arrange
      const provider: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Test Provider',
        description: 'Test',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(provider)

      // Act
      const result = await repository.exists('provider-1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when provider does not exist', async () => {
      // Act
      const result = await repository.exists('non-existent')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('findByUserId', () => {
    it('should return provider for given user ID', async () => {
      // Arrange
      const provider: Provider = {
        id: 'provider-1',
        userId: 'user-1',
        businessName: 'Test Provider',
        description: 'Test',
        city: 'Stockholm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.save(provider)

      // Act
      const result = await repository.findByUserId('user-1')

      // Assert
      expect(result).toEqual(provider)
    })

    it('should return null when no provider found for user', async () => {
      // Act
      const result = await repository.findByUserId('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })
})
