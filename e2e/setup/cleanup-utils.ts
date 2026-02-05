/**
 * Shared cleanup utilities for E2E tests.
 * Single source of truth for cleaning up dynamically created test data.
 *
 * IMPORTANT: This does NOT delete E2E seed data (test@example.com, provider@example.com).
 * It only removes data created dynamically during tests (e.g., auth.spec.ts creating users).
 */
import { PrismaClient } from '@prisma/client'
import { KEEP_EMAILS } from './e2e-utils'

/** Where clause for dynamically created users (not in KEEP_EMAILS) */
const dynamicUserFilter = {
  AND: [
    { email: { contains: '@example.com' } },
    { email: { notIn: [...KEEP_EMAILS] } },
  ],
} as const

/**
 * Clean up all dynamically created test data.
 * Deletes in FK-safe order, preserving seed users and their base data.
 */
export async function cleanupDynamicTestData(prisma: PrismaClient): Promise<void> {
  try {
    // 0. Ghost users (from E2E auth tests)
    await prisma.booking.deleteMany({
      where: { customer: { email: { endsWith: '@ghost.equinet.se' } } },
    })
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@ghost.equinet.se' } },
    })

    // 1. Group booking participants + requests
    await prisma.groupBookingParticipant.deleteMany({
      where: {
        OR: [
          { groupBookingRequest: { locationName: { startsWith: 'E2E' } } },
          { user: dynamicUserFilter },
        ],
      },
    })
    await prisma.groupBookingRequest.deleteMany({
      where: {
        OR: [
          { locationName: { startsWith: 'E2E' } },
          { creator: dynamicUserFilter },
        ],
      },
    })

    // 2. Route stops (FK to Route + RouteOrder)
    await prisma.routeStop.deleteMany({
      where: {
        OR: [
          { route: { provider: { user: dynamicUserFilter } } },
          { routeOrder: { customer: dynamicUserFilter } },
        ],
      },
    })

    // 3. Routes (FK to Provider)
    await prisma.route.deleteMany({
      where: { provider: { user: dynamicUserFilter } },
    })

    // 4. Route orders (FK to User)
    await prisma.routeOrder.deleteMany({
      where: { customer: dynamicUserFilter },
    })

    // 5. Bookings (FK to User + Service)
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { customer: dynamicUserFilter },
          { service: { provider: { user: dynamicUserFilter } } },
        ],
      },
    })

    // 6. Services (FK to Provider)
    await prisma.service.deleteMany({
      where: { provider: { user: dynamicUserFilter } },
    })

    // 7. Availability (FK to Provider)
    await prisma.availability.deleteMany({
      where: { provider: { user: dynamicUserFilter } },
    })

    // 8. Providers (FK to User)
    await prisma.provider.deleteMany({
      where: { user: dynamicUserFilter },
    })

    // 9. Users (root)
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@example.com',
          notIn: [...KEEP_EMAILS],
        },
      },
    })
  } catch (error) {
    console.error('Error in cleanupDynamicTestData:', error)
    throw error
  }
}
