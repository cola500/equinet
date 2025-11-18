/**
 * BDD Test Example: Customer Views Bookings
 *
 * This is a reference implementation showing the BDD pattern.
 * Use this as a template for new tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { given, when, then } from '@/tests/bdd-helpers'
import { pendingBooking, confirmedBooking, pastBooking } from '@/tests/fixtures'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('Feature: Customer views their bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Scenario: Authenticated customer retrieves booking list', () => {
    it('should return all customer bookings sorted by date', async () => {
      // Given an authenticated customer with multiple bookings
      const { userId } = given.authenticatedCustomer()
      given.existingBookings([
        confirmedBooking({ customerId: userId, bookingDate: new Date('2025-11-25') }),
        pendingBooking({ customerId: userId, bookingDate: new Date('2025-11-20') }),
      ])

      // When the customer requests their bookings
      const response = await when.customerFetchesBookings()

      // Then they should see all their bookings in descending order by date
      const data = await then.expectSuccess(response, {
        status: 200,
        bookingCount: 2,
      })

      // Additional business assertions
      expect(data[0].bookingDate).toContain('2025-11-25') // Newest first
      expect(data[1].bookingDate).toContain('2025-11-20')
    })
  })

  describe('Scenario: Customer with no bookings views empty list', () => {
    it('should return empty array when customer has no bookings', async () => {
      // Given an authenticated customer with no bookings
      const { userId } = given.authenticatedCustomer()
      given.existingBookings([])

      // When the customer requests their bookings
      const response = await when.customerFetchesBookings()

      // Then they should see an empty list
      await then.expectSuccess(response, {
        status: 200,
        bookingCount: 0,
      })
    })
  })

  describe('Scenario: Unauthenticated user attempts to view bookings', () => {
    it('should deny access with 401 Unauthorized', async () => {
      // Given an unauthenticated user
      given.unauthenticatedUser()

      // When they attempt to fetch bookings
      const response = await when.customerFetchesBookings()

      // Then access should be denied
      await then.expectUnauthorized(response, {
        errorMessage: 'Unauthorized',
      })
    })
  })

  describe('Scenario: Customer views bookings with provider and service details', () => {
    it('should include provider business name and service information', async () => {
      // Given an authenticated customer with a confirmed booking
      const { userId } = given.authenticatedCustomer()
      given.existingBookings([
        confirmedBooking({
          customerId: userId,
          provider: {
            id: 'provider-123',
            businessName: 'Premium Hovslagare AB',
            user: {
              firstName: 'John',
              lastName: 'Doe',
            },
          },
          service: {
            id: 'service-1',
            name: 'Hovslagning',
            price: 800,
          },
        }),
      ])

      // When the customer requests their bookings
      const response = await when.customerFetchesBookings()

      // Then they should see complete booking details
      const data = await then.expectSuccess(response, {
        status: 200,
        bookingCount: 1,
      })

      // Verify business details are included
      expect(data[0].provider.businessName).toBe('Premium Hovslagare AB')
      expect(data[0].service.name).toBe('Hovslagning')
      expect(data[0].service.price).toBe(800)
    })
  })
})

describe('Feature: Provider views their bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Scenario: Authenticated provider retrieves bookings for their services', () => {
    it('should return only bookings for provider services', async () => {
      // Given an authenticated provider with bookings
      const { providerId } = given.authenticatedProvider()
      given.existingProvider({ id: providerId, userId: 'provider-user-123' })
      given.existingBookings([
        confirmedBooking({
          providerId,
          customer: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            phone: '0701234567',
          },
        }),
      ])

      // When the provider requests their bookings
      const response = await when.customerFetchesBookings()

      // Then they should see bookings with customer contact information
      const data = await then.expectSuccess(response, {
        status: 200,
        bookingCount: 1,
        allBelongToProvider: providerId,
      })

      // Verify customer details are included for providers
      expect(data[0].customer.firstName).toBe('Jane')
      expect(data[0].customer.email).toBe('jane@example.com')
    })
  })

  describe('Scenario: Provider with no active bookings views empty list', () => {
    it('should return empty array when provider has no bookings', async () => {
      // Given an authenticated provider with no bookings
      const { providerId } = given.authenticatedProvider()
      given.existingProvider({ id: providerId, userId: 'provider-user-123' })
      given.existingBookings([])

      // When the provider requests their bookings
      const response = await when.customerFetchesBookings()

      // Then they should see an empty list
      await then.expectSuccess(response, {
        status: 200,
        bookingCount: 0,
      })
    })
  })

  describe('Scenario: Provider account not found', () => {
    it('should return 404 when provider profile does not exist', async () => {
      // Given an authenticated user with provider userType but no provider profile
      given.authenticatedProvider()
      given.noExistingProvider()

      // When they request bookings
      const response = await when.customerFetchesBookings()

      // Then they should receive a not found error
      await then.expectNotFound(response, {
        errorMessage: 'Provider not found',
      })
    })
  })
})
