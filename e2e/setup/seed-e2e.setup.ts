import 'dotenv/config'
import { test as setup } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { assertSafeDatabase, futureDate, pastDate } from './e2e-utils'

const prisma = new PrismaClient()

/**
 * Unified E2E seed script -- runs once before all tests via Playwright setup project.
 *
 * Steps:
 * 1. Environment safety check
 * 2. Upsert users (customer + provider)
 * 3. Upsert provider profile + services (with recommendedIntervalWeeks)
 * 4. Seed availability for ALL providers
 * 5. Reset + seed route orders (4 customer-initiated + 1 provider-announced)
 * 6. Upsert horse for test customer
 * 7. Reset + seed bookings (1 pending + 1 confirmed + 1 completed)
 *
 * All seed data uses 'E2E seed data' markers for identification.
 * Idempotent: upsert for users/providers/services, delete+recreate for route orders/bookings.
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
    const service1 = await upsertService(prisma, provider.id, {
      name: 'Hovslagning Standard',
      description: 'Grundlaggande hovslagning for alla hastar',
      price: 800,
      durationMinutes: 60,
      recommendedIntervalWeeks: 8,
    })

    const service2 = await upsertService(prisma, provider.id, {
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

    // 5. Reset + seed route orders
    // Delete existing E2E seed route stops/orders first
    await prisma.routeStop.deleteMany({
      where: { routeOrder: { specialInstructions: 'E2E seed data' } },
    })
    await prisma.routeOrder.deleteMany({
      where: { specialInstructions: 'E2E seed data' },
    })

    // 4 customer-initiated pending orders in Goteborg area
    const routeOrderData = [
      {
        address: 'Ridvagen 1, Goteborg',
        municipality: 'Goteborg',
        latitude: 57.7089,
        longitude: 11.9746,
        serviceType: 'Hovslagning',
        numberOfHorses: 2,
      },
      {
        address: 'Stallvagen 5, Molndal',
        municipality: 'Molndal',
        latitude: 57.6554,
        longitude: 12.0134,
        serviceType: 'Hovslagning',
        numberOfHorses: 1,
      },
      {
        address: 'Hingstgatan 12, Kungalv',
        municipality: 'Kungalv',
        latitude: 57.8710,
        longitude: 11.9710,
        serviceType: 'Ridlektion',
        numberOfHorses: 3,
      },
      {
        address: 'Folvagen 8, Partille',
        municipality: 'Partille',
        latitude: 57.7394,
        longitude: 12.1064,
        serviceType: 'Hovslagning',
        numberOfHorses: 1,
      },
    ]

    for (const data of routeOrderData) {
      await prisma.routeOrder.create({
        data: {
          customerId: customer.id,
          announcementType: 'customer_initiated',
          serviceType: data.serviceType,
          address: data.address,
          municipality: data.municipality,
          latitude: data.latitude,
          longitude: data.longitude,
          numberOfHorses: data.numberOfHorses,
          dateFrom: futureDate(3),
          dateTo: futureDate(14),
          priority: 'normal',
          specialInstructions: 'E2E seed data',
          contactPhone: '0701234567',
          status: 'pending',
        },
      })
    }

    // 1 provider-announced announcement with services M2M
    await prisma.routeOrder.create({
      data: {
        providerId: provider.id,
        announcementType: 'provider_announced',
        serviceType: 'Hovslagning',
        address: 'Goteborg-omradet',
        municipality: 'Goteborg',
        latitude: 57.7089,
        longitude: 11.9746,
        numberOfHorses: 0,
        dateFrom: futureDate(7),
        dateTo: futureDate(21),
        priority: 'normal',
        specialInstructions: 'E2E seed data',
        status: 'pending',
        services: {
          connect: [{ id: service1.id }, { id: service2.id }],
        },
      },
    })
    console.log('  Route orders: 4 customer-initiated + 1 provider-announced')

    // 6. Upsert horse for test customer (BEFORE bookings -- needed for horseId on completed booking)
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
    }
    console.log('  Horse: E2E Blansen')

    // 7. Reset + seed bookings
    // Delete existing E2E seed customer reviews first (FK to booking)
    await prisma.customerReview.deleteMany({
      where: { booking: { customerNotes: 'E2E seed data' } },
    })
    // Delete existing E2E seed bookings
    await prisma.booking.deleteMany({
      where: { customerNotes: 'E2E seed data' },
    })

    // 1x pending booking (7 days from now) - for cancellation tests
    await prisma.booking.create({
      data: {
        customerId: customer.id,
        providerId: provider.id,
        serviceId: service1.id,
        bookingDate: futureDate(7),
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'E2E Thunder',
        customerNotes: 'E2E seed data',
        status: 'pending',
      },
    })

    // 1x confirmed booking (14 days from now) - for payment tests
    await prisma.booking.create({
      data: {
        customerId: customer.id,
        providerId: provider.id,
        serviceId: service2.id,
        bookingDate: futureDate(14),
        startTime: '14:00',
        endTime: '14:45',
        horseName: 'E2E Blansen',
        customerNotes: 'E2E seed data',
        status: 'confirmed',
      },
    })

    // 1x confirmed booking (21 days from now) - dedicated for provider-notes tests
    // Separated from the 14-day booking because booking.spec.ts cancel test
    // may cancel that one before provider-notes tests run.
    await prisma.booking.create({
      data: {
        customerId: customer.id,
        providerId: provider.id,
        serviceId: service1.id,
        bookingDate: futureDate(21),
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'E2E Storm',
        customerNotes: 'E2E seed data',
        status: 'confirmed',
      },
    })

    // 1x completed booking (90 days ago) - for customer registry, reviews, due-for-service
    await prisma.booking.create({
      data: {
        customerId: customer.id,
        providerId: provider.id,
        serviceId: service1.id,
        horseId: horse.id,
        bookingDate: pastDate(90),
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'E2E Blansen',
        customerNotes: 'E2E seed data',
        status: 'completed',
      },
    })
    console.log('  Bookings: 1 pending + 2 confirmed + 1 completed')

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
