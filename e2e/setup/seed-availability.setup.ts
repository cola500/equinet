import { test as setup } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Setup test that seeds availability for all providers before running E2E tests.
 * This runs once before all tests via Playwright's project dependencies.
 */
setup('seed availability for providers', async () => {
  console.log('🌱 Seeding availability for all providers...')

  try {
    // Hämta alla providers
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
    })

    console.log(`Found ${providers.length} providers`)

    // För varje provider, skapa availability för alla veckodagar (0-6)
    for (const provider of providers) {
      // Kolla om provider redan har availability
      const existingCount = await prisma.availability.count({
        where: { providerId: provider.id },
      })

      if (existingCount > 0) {
        console.log(`Provider ${provider.businessName} already has availability, skipping`)
        continue
      }

      // Skapa availability för alla dagar (09:00-17:00, alla öppna)
      const availabilityData = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        providerId: provider.id,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        isClosed: false,
        isActive: true,
      }))

      await prisma.availability.createMany({
        data: availabilityData,
      })

      console.log(`✅ Created availability for provider ${provider.businessName}`)
    }

    console.log('✅ Availability seeding complete!')
  } catch (error) {
    console.error('❌ Error seeding availability:', error)
    throw error // Fail the setup if seeding fails
  } finally {
    await prisma.$disconnect()
  }
})
