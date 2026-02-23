import 'dotenv/config'
import { test as setup } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { assertSafeDatabase } from './e2e-utils'

const prisma = new PrismaClient()

/**
 * Global E2E seed script -- runs once before all tests via Playwright setup project.
 *
 * Seeds READ-ONLY base data:
 * 1. Environment safety check
 * 2. Upsert users (customer + provider)
 * 3. Upsert provider profile + services (with recommendedIntervalWeeks)
 * 4. Seed availability for ALL providers
 * 5. Upsert horse for test customer
 *
 * Bookings and route orders are seeded PER-SPEC via seed-helpers.ts.
 * This eliminates cross-spec data interference.
 */
setup('seed E2E test data', async () => {
  // 1. Safety check
  assertSafeDatabase()

  console.log('Seeding E2E test data...')

  // Reset in-memory rate limits in the dev server to prevent
  // "too many registration attempts" errors across test runs
  try {
    const res = await fetch('http://localhost:3000/api/test/reset-rate-limit', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      console.log('  Rate limits reset OK')
    } else {
      console.log(`  Rate limit reset failed: ${res.status}`)
    }
  } catch {
    console.log('  Rate limit reset skipped (dev server not ready)')
  }

  try {
    // 2. Upsert users
    const customerPassword = await bcrypt.hash('TestPassword123!', 10)
    const providerPassword = await bcrypt.hash('ProviderPass123!', 10)

    const customer = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: { emailVerified: true, emailVerifiedAt: new Date() },
      create: {
        email: 'test@example.com',
        passwordHash: customerPassword,
        firstName: 'Test',
        lastName: 'Testsson',
        phone: '0701234567',
        userType: 'customer',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    console.log('  User: test@example.com')

    const providerUser = await prisma.user.upsert({
      where: { email: 'provider@example.com' },
      update: { emailVerified: true, emailVerifiedAt: new Date() },
      create: {
        email: 'provider@example.com',
        passwordHash: providerPassword,
        firstName: 'Leverantor',
        lastName: 'Testsson',
        phone: '0709876543',
        userType: 'provider',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    console.log('  User: provider@example.com')

    const adminPassword = await bcrypt.hash('AdminPass123!', 10)
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: { isAdmin: true, emailVerified: true, emailVerifiedAt: new Date() },
      create: {
        email: 'admin@example.com',
        passwordHash: adminPassword,
        firstName: 'Admin',
        lastName: 'Testsson',
        phone: '0701112233',
        userType: 'customer',
        isAdmin: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    console.log('  User: admin@example.com (admin)')

    // 3. Upsert provider profile
    const provider = await prisma.provider.upsert({
      where: { userId: providerUser.id },
      update: {
        businessName: 'Test Stall AB',
        description: 'Vi erbjuder professionell hovslagning och hastskotsel',
        city: 'Stockholm',
        isActive: true,
      },
      create: {
        userId: providerUser.id,
        businessName: 'Test Stall AB',
        description: 'Vi erbjuder professionell hovslagning och hastskotsel',
        city: 'Stockholm',
        isActive: true,
      },
    })
    console.log('  Provider: Test Stall AB')

    // Upsert services
    await upsertService(prisma, provider.id, {
      name: 'Hovslagning Standard',
      description: 'Grundlaggande hovslagning for alla hastar',
      price: 800,
      durationMinutes: 60,
      recommendedIntervalWeeks: 8,
    })

    await upsertService(prisma, provider.id, {
      name: 'Ridlektion',
      description: 'Privat ridlektion for alla nivaer',
      price: 500,
      durationMinutes: 45,
    })
    console.log('  Services: Hovslagning Standard, Ridlektion')

    // 4. Seed availability for ALL active providers
    const providers = await prisma.provider.findMany({ where: { isActive: true } })

    for (const p of providers) {
      const existingCount = await prisma.availability.count({
        where: { providerId: p.id },
      })

      if (existingCount > 0) continue

      // Mon-Fri (0-4) open 09-17, Sat-Sun (5-6) closed
      const availabilityData = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        providerId: p.id,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        isClosed: dayOfWeek >= 5, // Weekend closed
        isActive: true,
      }))

      await prisma.availability.createMany({ data: availabilityData })
    }
    console.log(`  Availability: ${providers.length} providers`)

    // 5. Route orders -- seeded per-spec via seed-helpers.ts (no global route orders)

    // 6. Upsert horse for test customer (restore if soft-deleted by horses.spec.ts)
    let horse = await prisma.horse.findFirst({
      where: { ownerId: customer.id, name: 'E2E Blansen' },
    })

    if (!horse) {
      horse = await prisma.horse.create({
        data: {
          ownerId: customer.id,
          name: 'E2E Blansen',
          breed: 'Svenskt varmblod',
          birthYear: 2018,
          color: 'Brun',
          gender: 'mare',
        },
      })
    } else if (!horse.isActive) {
      await prisma.horse.update({
        where: { id: horse.id },
        data: { isActive: true },
      })
    }
    console.log('  Horse: E2E Blansen')

    // 7. Bookings -- seeded per-spec via seed-helpers.ts (no global bookings)
    // Clean up any leftover global seed bookings from previous runs
    await prisma.customerReview.deleteMany({
      where: { booking: { customerNotes: 'E2E seed data' } },
    })
    await prisma.booking.deleteMany({
      where: { customerNotes: 'E2E seed data' },
    })
    // Also clean leftover global route orders from previous runs
    await prisma.routeStop.deleteMany({
      where: { routeOrder: { specialInstructions: 'E2E seed data' } },
    })
    await prisma.routeOrder.deleteMany({
      where: { specialInstructions: 'E2E seed data' },
    })
    console.log('  Bookings & route orders: per-spec seeding (cleaned global leftovers)')

    console.log('E2E seed complete!')
  } catch (error) {
    console.error('Error seeding E2E data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
})

/** Helper: upsert a service by name + providerId */
async function upsertService(
  prisma: PrismaClient,
  providerId: string,
  data: {
    name: string
    description: string
    price: number
    durationMinutes: number
    recommendedIntervalWeeks?: number
  }
) {
  const existing = await prisma.service.findFirst({
    where: { providerId, name: data.name },
  })

  if (existing) {
    // Update recommendedIntervalWeeks if specified and different
    if (
      data.recommendedIntervalWeeks !== undefined &&
      existing.recommendedIntervalWeeks !== data.recommendedIntervalWeeks
    ) {
      return prisma.service.update({
        where: { id: existing.id },
        data: { recommendedIntervalWeeks: data.recommendedIntervalWeeks },
      })
    }
    return existing
  }

  return prisma.service.create({
    data: { providerId, isActive: true, ...data },
  })
}
