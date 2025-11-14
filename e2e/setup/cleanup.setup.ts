import { test as teardown } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

teardown('cleanup test data after all tests', async () => {
  console.log('🧹 Cleaning up test data...')

  try {
    // Rätt ordning för att undvika foreign key constraints:
    // 1. Bokningar (har foreign keys till customer och service)
    // 2. Availability (har foreign key till provider)
    // 3. Services (har foreign key till provider)
    // 4. Providers (har foreign key till user)
    // 5. Users (root)

    // 1. Ta bort ALLA bokningar relaterade till test-users/providers
    const deletedBookings = await prisma.booking.deleteMany({
      where: {
        OR: [
          // Bokningar från test-customers
          { customer: { email: { contains: '@example.com' } } },
          { customer: { email: { contains: 'test' } } },
          { customer: { email: { contains: 'provider' } } },
          // Bokningar för tjänster från test-providers
          {
            service: {
              provider: {
                user: { email: { contains: '@example.com' } }
              }
            }
          }
        ]
      }
    })
    console.log(`  ✓ Deleted ${deletedBookings.count} test bookings`)

    // 2. Ta bort availability från test-providers
    const deletedAvailability = await prisma.availability.deleteMany({
      where: {
        provider: {
          user: {
            email: { contains: '@example.com' }
          }
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedAvailability.count} test availability entries`)

    // 3. Ta bort tjänster från test-providers
    const deletedServices = await prisma.service.deleteMany({
      where: {
        provider: {
          user: {
            email: { contains: '@example.com' }
          }
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedServices.count} test services`)

    // 4. Ta bort test providers
    const deletedProviders = await prisma.provider.deleteMany({
      where: {
        user: {
          email: { contains: '@example.com' }
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedProviders.count} test providers`)

    // 5. Ta bort testanvändare (skapade under testkörningen)
    // BEHÅLL dock test@example.com och provider@example.com som används i beforeEach
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        AND: [
          {
            OR: [
              { email: { contains: '@example.com' } },
              { email: { contains: 'test' } },
            ]
          },
          {
            email: {
              notIn: ['test@example.com', 'provider@example.com']
            }
          }
        ]
      }
    })
    console.log(`  ✓ Deleted ${deletedUsers.count} test users`)

    console.log('✅ Test data cleanup complete!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
})
