/**
 * BDD Test Helpers - Given (Setup)
 *
 * These helpers set up the test context using business language.
 * Example: given.authenticatedCustomer() instead of vi.mocked(getServerSession)...
 */

import { vi } from 'vitest'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export const given = {
  /**
   * Given an authenticated customer
   * @example
   * const { session, userId } = given.authenticatedCustomer()
   */
  authenticatedCustomer: (overrides: Record<string, any> = {}) => {
    const userId = overrides.id || 'customer-123'
    const session = {
      user: {
        id: userId,
        userType: 'customer',
        email: overrides.email || 'customer@example.com',
        firstName: overrides.firstName || 'Test',
        lastName: overrides.lastName || 'Customer',
        ...overrides,
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(session as any)

    return { session, userId }
  },

  /**
   * Given an authenticated provider
   * @example
   * const { session, userId, providerId } = given.authenticatedProvider()
   */
  authenticatedProvider: (overrides: Record<string, any> = {}) => {
    const userId = overrides.id || 'provider-user-123'
    const providerId = overrides.providerId || 'provider-123'
    const session = {
      user: {
        id: userId,
        userType: 'provider',
        providerId,
        email: overrides.email || 'provider@example.com',
        firstName: overrides.firstName || 'Test',
        lastName: overrides.lastName || 'Provider',
        ...overrides,
      },
    }

    vi.mocked(getServerSession).mockResolvedValue(session as any)

    return { session, userId, providerId }
  },

  /**
   * Given an unauthenticated user
   * @example
   * const { session } = given.unauthenticatedUser()
   */
  unauthenticatedUser: () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    return { session: null }
  },

  /**
   * Given existing bookings in the database
   * @example
   * given.existingBookings([pendingBooking(), confirmedBooking()])
   */
  existingBookings: (bookings: any[]) => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue(bookings as any)
  },

  /**
   * Given a specific booking exists
   * @example
   * given.existingBooking(confirmedBooking({ id: 'booking-1' }))
   */
  existingBooking: (booking: any) => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(booking as any)
  },

  /**
   * Given a booking does not exist
   * @example
   * given.noExistingBooking()
   */
  noExistingBooking: () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)
  },

  /**
   * Given an existing provider
   * @example
   * given.existingProvider({ id: 'provider-123', businessName: 'Test Provider' })
   */
  existingProvider: (provider: any) => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(provider as any)
  },

  /**
   * Given a provider does not exist
   * @example
   * given.noExistingProvider()
   */
  noExistingProvider: () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)
  },

  /**
   * Given a service exists
   * @example
   * given.serviceExists({ id: 'service-1', name: 'Hovslagning', providerId: 'provider-123' })
   */
  serviceExists: (service: any) => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(service as any)
  },

  /**
   * Given a service does not exist
   * @example
   * given.serviceDoesNotExist()
   */
  serviceDoesNotExist: () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)
  },

  /**
   * Given booking creation will succeed
   * @example
   * given.bookingCreationSucceeds(confirmedBooking())
   */
  bookingCreationSucceeds: (booking: any) => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]), // No overlapping bookings
          create: vi.fn().mockResolvedValue(booking),
        },
      }
      return await callback(tx)
    })
  },

  /**
   * Given there are overlapping bookings (for conflict testing)
   * @example
   * given.overlappingBookingsExist([existingBooking])
   */
  overlappingBookingsExist: (bookings: any[]) => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue(bookings), // Overlapping bookings found
          create: vi.fn(),
        },
      }
      return await callback(tx)
    })
  },
}
