/**
 * Service Fixtures
 *
 * These fixtures represent business entities for services.
 */

export const hovslagningService = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || 'service-hovslagning',
  providerId: overrides.providerId || 'provider-123',
  name: 'Hovslagning',
  description: 'Professionell hovslagning för alla hästtyper',
  price: overrides.price || 800,
  durationMinutes: overrides.durationMinutes || 60,
  isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  createdAt: new Date('2025-11-01'),
  updatedAt: new Date('2025-11-01'),
  ...overrides,
})

export const beskärningService = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || 'service-beskärning',
  providerId: overrides.providerId || 'provider-123',
  name: 'Hovbeskärning',
  description: 'Professionell beskärning av hästens hovar',
  price: overrides.price || 500,
  durationMinutes: overrides.durationMinutes || 45,
  isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  createdAt: new Date('2025-11-01'),
  updatedAt: new Date('2025-11-01'),
  ...overrides,
})

export const customService = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || 'service-custom',
  providerId: overrides.providerId || 'provider-123',
  name: overrides.name || 'Custom Service',
  description: overrides.description || 'Custom service description',
  price: overrides.price || 1000,
  durationMinutes: overrides.durationMinutes || 90,
  isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  createdAt: new Date('2025-11-01'),
  updatedAt: new Date('2025-11-01'),
  ...overrides,
})

export const inactiveService = (overrides: Record<string, any> = {}) =>
  customService({
    ...overrides,
    isActive: false,
  })
