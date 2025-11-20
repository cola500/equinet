import { describe, it, expect, beforeEach } from 'vitest'
import { MockServiceRepository } from './MockServiceRepository'
import type { Service } from './IServiceRepository'

describe('ServiceRepository', () => {
  let repository: MockServiceRepository

  beforeEach(() => {
    repository = new MockServiceRepository()
  })

  describe('findById', () => {
    it('should return service when found', async () => {
      // Arrange
      const service: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Hovslagning',
        description: 'Komplett hovslagning',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service)

      // Act
      const result = await repository.findById('service-1')

      // Assert
      expect(result).toEqual(service)
    })

    it('should return null when service not found', async () => {
      // Act
      const result = await repository.findById('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all services when no filters', async () => {
      // Arrange
      const service1: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Hovslagning',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const service2: Service = {
        id: 'service-2',
        providerId: 'provider-2',
        name: 'Hästmassage',
        description: 'Test',
        price: 500,
        durationMinutes: 45,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service1)
      await repository.save(service2)

      // Act
      const result = await repository.findAll()

      // Assert
      expect(result).toHaveLength(2)
      expect(result).toContainEqual(service1)
      expect(result).toContainEqual(service2)
    })

    it('should filter by providerId', async () => {
      // Arrange
      const provider1Service: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Hovslagning',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const provider2Service: Service = {
        id: 'service-2',
        providerId: 'provider-2',
        name: 'Hästmassage',
        description: 'Test',
        price: 500,
        durationMinutes: 45,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(provider1Service)
      await repository.save(provider2Service)

      // Act
      const result = await repository.findAll({ providerId: 'provider-1' })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(provider1Service)
    })

    it('should filter by active status', async () => {
      // Arrange
      const active: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Active Service',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const inactive: Service = {
        id: 'service-2',
        providerId: 'provider-1',
        name: 'Inactive Service',
        description: 'Test',
        price: 500,
        durationMinutes: 45,
        isActive: false,
        createdAt: new Date(),
      }
      await repository.save(active)
      await repository.save(inactive)

      // Act
      const result = await repository.findAll({ isActive: true })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(active)
    })

    it('should search by name', async () => {
      // Arrange
      const service1: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Hovslagning Premium',
        description: 'Professional service',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const service2: Service = {
        id: 'service-2',
        providerId: 'provider-1',
        name: 'Hästmassage',
        description: 'Relaxing massage',
        price: 500,
        durationMinutes: 45,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service1)
      await repository.save(service2)

      // Act
      const result = await repository.findAll({ search: 'Hovslagning' })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(service1)
    })

    it('should search by description', async () => {
      // Arrange
      const service1: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Service A',
        description: 'Professional hovslagning',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const service2: Service = {
        id: 'service-2',
        providerId: 'provider-1',
        name: 'Service B',
        description: 'Relaxing massage',
        price: 500,
        durationMinutes: 45,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service1)
      await repository.save(service2)

      // Act
      const result = await repository.findAll({ search: 'hovslagning' })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(service1)
    })

    it('should combine multiple filters', async () => {
      // Arrange
      const targetService: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Active Service',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const wrongProvider: Service = {
        id: 'service-2',
        providerId: 'provider-2',
        name: 'Active Service',
        description: 'Test',
        price: 500,
        durationMinutes: 45,
        isActive: true,
        createdAt: new Date(),
      }
      const inactiveService: Service = {
        id: 'service-3',
        providerId: 'provider-1',
        name: 'Inactive Service',
        description: 'Test',
        price: 600,
        durationMinutes: 30,
        isActive: false,
        createdAt: new Date(),
      }
      await repository.save(targetService)
      await repository.save(wrongProvider)
      await repository.save(inactiveService)

      // Act
      const result = await repository.findAll({
        providerId: 'provider-1',
        isActive: true,
      })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(targetService)
    })
  })

  describe('findByProviderId', () => {
    it('should return all services for given provider', async () => {
      // Arrange
      const service1: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Service A',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      const service2: Service = {
        id: 'service-2',
        providerId: 'provider-1',
        name: 'Service B',
        description: 'Test',
        price: 500,
        durationMinutes: 45,
        isActive: true,
        createdAt: new Date(),
      }
      const otherProviderService: Service = {
        id: 'service-3',
        providerId: 'provider-2',
        name: 'Service C',
        description: 'Test',
        price: 600,
        durationMinutes: 30,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service1)
      await repository.save(service2)
      await repository.save(otherProviderService)

      // Act
      const result = await repository.findByProviderId('provider-1')

      // Assert
      expect(result).toHaveLength(2)
      expect(result).toContainEqual(service1)
      expect(result).toContainEqual(service2)
    })

    it('should return empty array when provider has no services', async () => {
      // Act
      const result = await repository.findByProviderId('non-existent-provider')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('save', () => {
    it('should create new service', async () => {
      // Arrange
      const service: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Test Service',
        description: 'Test description',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }

      // Act
      const result = await repository.save(service)

      // Assert
      expect(result).toEqual(service)
      const found = await repository.findById('service-1')
      expect(found).toEqual(service)
    })

    it('should update existing service', async () => {
      // Arrange
      const original: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Original Name',
        description: 'Original description',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(original)

      const updated: Service = {
        ...original,
        name: 'Updated Name',
        price: 900,
      }

      // Act
      const result = await repository.save(updated)

      // Assert
      expect(result.name).toBe('Updated Name')
      expect(result.price).toBe(900)
      const found = await repository.findById('service-1')
      expect(found?.name).toBe('Updated Name')
      expect(found?.price).toBe(900)
    })
  })

  describe('delete', () => {
    it('should delete existing service', async () => {
      // Arrange
      const service: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Test Service',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service)

      // Act
      await repository.delete('service-1')

      // Assert
      const found = await repository.findById('service-1')
      expect(found).toBeNull()
    })

    it('should not throw when deleting non-existent service', async () => {
      // Act & Assert
      await expect(repository.delete('non-existent')).resolves.not.toThrow()
    })
  })

  describe('exists', () => {
    it('should return true when service exists', async () => {
      // Arrange
      const service: Service = {
        id: 'service-1',
        providerId: 'provider-1',
        name: 'Test Service',
        description: 'Test',
        price: 800,
        durationMinutes: 60,
        isActive: true,
        createdAt: new Date(),
      }
      await repository.save(service)

      // Act
      const result = await repository.exists('service-1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when service does not exist', async () => {
      // Act
      const result = await repository.exists('non-existent')

      // Assert
      expect(result).toBe(false)
    })
  })
})
