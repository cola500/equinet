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

/** Seed horse name - never delete this */
const SEED_HORSE_NAME = 'E2E Blansen'

/**
 * Clean up all dynamically created test data.
 * Deletes in FK-safe order, preserving seed users and their base data.
 */
export async function cleanupDynamicTestData(prisma: PrismaClient): Promise<void> {
  try {
    // 0pre. Clean up any leftover per-spec tagged data (E2E-spec:*)
    await prisma.customerReview.deleteMany({
      where: { booking: { customerNotes: { startsWith: 'E2E-spec:' } } },
    })
    await prisma.booking.deleteMany({
      where: { customerNotes: { startsWith: 'E2E-spec:' } },
    })
    await prisma.routeStop.deleteMany({
      where: { routeOrder: { specialInstructions: { startsWith: 'E2E-spec:' } } },
    })
    await prisma.routeOrder.deleteMany({
      where: { specialInstructions: { startsWith: 'E2E-spec:' } },
    })

    // 0. CustomerReview + HorseServiceInterval (FK to Booking/Horse -- delete before those)
    await prisma.customerReview.deleteMany({
      where: {
        OR: [
          { provider: { user: dynamicUserFilter } },
          { customer: dynamicUserFilter },
        ],
      },
    })
    await prisma.horseServiceInterval.deleteMany({
      where: {
        OR: [
          { provider: { user: dynamicUserFilter } },
          { horse: { owner: dynamicUserFilter } },
        ],
      },
    })

    // 0a. Ghost users (from E2E auth tests)
    await prisma.booking.deleteMany({
      where: { customer: { email: { endsWith: '@ghost.equinet.se' } } },
    })
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@ghost.equinet.se' } },
    })

    // 0b. Test-created horses (owned by seed users, NOT the seed horse)
    // Nullify horseId on bookings first (optional FK)
    const testHorseFilter = {
      name: { not: SEED_HORSE_NAME },
      owner: { email: { in: [...KEEP_EMAILS] } },
    }
    await prisma.booking.updateMany({
      where: { horse: testHorseFilter },
      data: { horseId: null },
    })
    await prisma.groupBookingParticipant.updateMany({
      where: { horse: testHorseFilter },
      data: { horseId: null },
    })
    // HorseNote + HorsePassportToken have onDelete: Cascade, deleted automatically
    await prisma.horse.deleteMany({
      where: testHorseFilter,
    })

    // Re-seed horse if the edit test renamed it (then cleanup deleted it above)
    const customer = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    })
    if (customer) {
      const seedHorse = await prisma.horse.findFirst({
        where: { ownerId: customer.id, name: SEED_HORSE_NAME },
      })
      if (!seedHorse) {
        await prisma.horse.create({
          data: {
            ownerId: customer.id,
            name: SEED_HORSE_NAME,
            breed: 'Svenskt varmblod',
            birthYear: 2018,
            color: 'Brun',
            gender: 'mare',
          },
        })
      }
    }

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
