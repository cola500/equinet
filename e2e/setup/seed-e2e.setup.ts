import { test as setup } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { assertSafeDatabase } from './e2e-utils'

// E2E_DATABASE_URL allows overriding the Prisma datasource for E2E tests.
// This is needed because prisma.config.ts loads .env.local (Docker Postgres on port 5432)
// but E2E tests may run against Supabase local dev (port 54322).
// In CI, DATABASE_URL is set by supabase start and must take precedence.
const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
})

/**
 * Create a Supabase admin client for seeding auth users.
 * Uses service_role key to bypass RLS and create users directly.
 */
function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for E2E seed'
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Seed a user in Supabase Auth + wait for handle_new_user trigger to create public.User.
 * Idempotent: if user already exists, returns existing user.
 */
async function seedAuthUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
  password: string,
  metadata: { firstName: string; lastName: string }
) {
  // Try to create -- if already exists, fetch existing
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error) {
    if (error.message?.includes('already been registered')) {
      // User exists in auth.users -- fetch their ID
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      const existing = listData?.users?.find((u) => u.email === email)
      if (existing) {
        // Update password to ensure it matches what E2E specs expect
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
        return existing.id
      }
      throw new Error(`User ${email} registered but not found in listUsers`)
    }
    throw error
  }

  return data.user.id
}

/**
 * Global E2E seed script -- runs once before all tests via Playwright setup project.
 *
 * Seeds READ-ONLY base data:
 * 1. Environment safety check
 * 2. Create users in Supabase Auth (handle_new_user trigger creates public.User)
 * 3. Update user roles + provider profile + services
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
    const supabaseAdmin = createSupabaseAdmin()

    // 2. Create users in Supabase Auth
    // handle_new_user trigger creates public.User rows automatically with userType='customer'
    const customerId = await seedAuthUser(
      supabaseAdmin,
      'test@example.com',
      'TestPassword123!',
      { firstName: 'Test', lastName: 'Testsson' }
    )
    console.log('  Auth user: test@example.com')

    const providerUserId = await seedAuthUser(
      supabaseAdmin,
      'provider@example.com',
      'ProviderPass123!',
      { firstName: 'Leverantor', lastName: 'Testsson' }
    )
    console.log('  Auth user: provider@example.com')

    const adminUserId = await seedAuthUser(
      supabaseAdmin,
      'admin@example.com',
      'AdminPass123!',
      { firstName: 'Admin', lastName: 'Testsson' }
    )
    console.log('  Auth user: admin@example.com')

    // Wait for handle_new_user trigger to create public.User rows
    // CI runners can be slower -- poll instead of fixed delay
    for (let attempt = 0; attempt < 10; attempt++) {
      const count = await prisma.user.count({
        where: { email: { in: ['test@example.com', 'provider@example.com', 'admin@example.com'] } },
      })
      if (count >= 3) break
      console.log(`  Waiting for trigger... (${count}/3 users, attempt ${attempt + 1})`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Diagnostic: test signInWithPassword to verify auth works
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })
    if (signInError) {
      console.log(`  LOGIN DIAGNOSTIC FAILED: ${signInError.message}`)
    } else {
      const claims = signInData.session?.access_token
        ? JSON.parse(atob(signInData.session.access_token.split('.')[1]))
        : null
      console.log(
        `  LOGIN DIAGNOSTIC OK: session=${!!signInData.session}, claims.app_metadata=${JSON.stringify(claims?.app_metadata || {})}`
      )
    }

    // 3. Update user roles via Prisma (trigger always creates as 'customer')
    await prisma.user.update({
      where: { id: customerId },
      data: {
        phone: '0701234567',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    await prisma.user.update({
      where: { id: providerUserId },
      data: {
        userType: 'provider',
        phone: '0709876543',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    await prisma.user.update({
      where: { id: adminUserId },
      data: {
        isAdmin: true,
        phone: '0701112233',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    console.log('  User roles updated (provider + admin)')

    // 4. Upsert provider profile
    const provider = await prisma.provider.upsert({
      where: { userId: providerUserId },
      update: {
        businessName: 'Test Stall AB',
        description: 'Vi erbjuder professionell hovslagning och hastskotsel',
        city: 'Stockholm',
        isActive: true,
      },
      create: {
        userId: providerUserId,
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

    // 5. Seed availability for ALL active providers
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

    // 6. Upsert horse for test customer (restore if soft-deleted by horses.spec.ts)
    let horse = await prisma.horse.findFirst({
      where: { ownerId: customerId, name: 'E2E Blansen' },
    })

    if (!horse) {
      horse = await prisma.horse.create({
        data: {
          ownerId: customerId,
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

    // 7. Clean up leftover global seed data from previous runs
    await prisma.customerReview.deleteMany({
      where: { booking: { customerNotes: 'E2E seed data' } },
    })
    await prisma.booking.deleteMany({
      where: { customerNotes: 'E2E seed data' },
    })
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
