import { test as teardown } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

teardown('cleanup test data after all tests', async () => {
  console.log('🧹 Cleaning up test data...')

  try {
    // Rätt ordning för att undvika foreign key constraints:
    // 1. RouteStops (har foreign keys till Route och RouteOrder)
    // 2. Routes (har foreign key till provider)
    // 3. RouteOrders (har foreign key till customer)
    // 4. Bokningar (har foreign keys till customer och service)
    // 5. Availability (har foreign key till provider)
    // 6. Services (har foreign key till provider)
    // 7. Providers (har foreign key till user)
    // 8. Users (root)

    // VIKTIGT: Behåll test@example.com och provider@example.com (används i beforeEach)
    const keepEmails = ['test@example.com', 'provider@example.com']

    // 1. Ta bort RouteStops från dynamiskt skapade test-data
    const deletedRouteStops = await prisma.routeStop.deleteMany({
      where: {
        OR: [
          // RouteStops från routes med dynamiskt skapade providers
          {
            route: {
              provider: {
                user: {
                  AND: [
                    { email: { contains: '@example.com' } },
                    { email: { notIn: keepEmails } }
                  ]
                }
              }
            }
          },
          // RouteStops från dynamiskt skapade RouteOrders
          {
            routeOrder: {
              customer: {
                AND: [
                  { email: { contains: '@example.com' } },
                  { email: { notIn: keepEmails } }
                ]
              }
            }
          }
        ]
      }
    })
    console.log(`  ✓ Deleted ${deletedRouteStops.count} test route stops`)

    // 2. Ta bort Routes från dynamiskt skapade test-providers
    const deletedRoutes = await prisma.route.deleteMany({
      where: {
        provider: {
          user: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } }
            ]
          }
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedRoutes.count} test routes`)

    // 3. Ta bort RouteOrders från dynamiskt skapade test-customers
    const deletedRouteOrders = await prisma.routeOrder.deleteMany({
      where: {
        customer: {
          AND: [
            { email: { contains: '@example.com' } },
            { email: { notIn: keepEmails } }
          ]
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedRouteOrders.count} test route orders`)

    // 4. Ta bort ALLA bokningar relaterade till dynamiskt skapade test-users
    // Men INTE bokningar för test@example.com och provider@example.com
    const deletedBookings = await prisma.booking.deleteMany({
      where: {
        OR: [
          // Bokningar från dynamiskt skapade test-customers (innehåller timestamp i emailen)
          {
            customer: {
              AND: [
                { email: { contains: '@example.com' } },
                { email: { notIn: keepEmails } }
              ]
            }
          },
          // Bokningar för tjänster från dynamiskt skapade test-providers
          {
            service: {
              provider: {
                user: {
                  AND: [
                    { email: { contains: '@example.com' } },
                    { email: { notIn: keepEmails } }
                  ]
                }
              }
            }
          }
        ]
      }
    })
    console.log(`  ✓ Deleted ${deletedBookings.count} test bookings`)

    // 5. Ta bort availability från dynamiskt skapade test-providers
    // BEHÅLL availability för provider@example.com
    const deletedAvailability = await prisma.availability.deleteMany({
      where: {
        provider: {
          user: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } }
            ]
          }
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedAvailability.count} test availability entries`)

    // 6. Ta bort tjänster från dynamiskt skapade test-providers
    // BEHÅLL services för provider@example.com
    const deletedServices = await prisma.service.deleteMany({
      where: {
        provider: {
          user: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } }
            ]
          }
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedServices.count} test services`)

    // 7. Ta bort dynamiskt skapade test providers
    // BEHÅLL provider för provider@example.com
    const deletedProviders = await prisma.provider.deleteMany({
      where: {
        user: {
          AND: [
            { email: { contains: '@example.com' } },
            { email: { notIn: keepEmails } }
          ]
        }
      }
    })
    console.log(`  ✓ Deleted ${deletedProviders.count} test providers`)

    // 8. Ta bort dynamiskt skapade testanvändare
    // BEHÅLL test@example.com och provider@example.com som används i beforeEach
    // Dynamiskt skapade users har timestamp i emailen (t.ex. test1731592746123@example.com)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@example.com',
          notIn: keepEmails
        }
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
