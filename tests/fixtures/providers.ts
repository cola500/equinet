/**
 * Provider Fixtures
 *
 * These fixtures represent business entities for providers.
 */

export const activeProvider = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || 'provider-123',
  userId: overrides.userId || 'provider-user-123',
  businessName: overrides.businessName || 'Test Hovslagare AB',
  description: overrides.description || 'Professionella hovslagare med lång erfarenhet',
  city: overrides.city || 'Stockholm',
  isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  createdAt: new Date('2025-11-01'),
  updatedAt: new Date('2025-11-01'),

  // Relations
  user: overrides.user || {
    id: overrides.userId || 'provider-user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'provider@example.com',
    phone: '0701234567',
  },
  services: overrides.services || [],

  ...overrides,
})

export const providerWithServices = (overrides: Record<string, any> = {}) =>
  activeProvider({
    ...overrides,
    services: overrides.services || [
      {
        id: 'service-1',
        name: 'Hovslagning',
        price: 800,
        durationMinutes: 60,
        isActive: true,
      },
      {
        id: 'service-2',
        name: 'Hovbeskärning',
        price: 500,
        durationMinutes: 45,
        isActive: true,
      },
    ],
  })

export const inactiveProvider = (overrides: Record<string, any> = {}) =>
  activeProvider({
    ...overrides,
    isActive: false,
  })

export const providerWithAutoAccept = (overrides: Record<string, any> = {}) =>
  activeProvider({
    ...overrides,
    autoAccept: true,
  })
