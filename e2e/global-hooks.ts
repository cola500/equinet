import { test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Global afterEach hook - runs after EVERY test
 * Sprint 2 F2-5: Clean up dynamically created data between specs
 *
 * This prevents test pollution where auth.spec.ts creates providers
 * that affect booking.spec.ts searches and filters
 */
test.afterEach(async () => {
  // Keep base test users (used in beforeEach of many tests)
  const keepEmails = ['test@example.com', 'provider@example.com']

  try {
    // Delete dynamically created data (users with timestamp in email)
    // Order matters due to foreign key constraints

    // 1. Delete bokningar from dynamically created users/providers
    await prisma.booking.deleteMany({
      where: {
        OR: [
          {
            customer: {
              AND: [
                { email: { contains: '@example.com' } },
                { email: { notIn: keepEmails } }
              ]
            }
          },
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

    // 2. Delete services from dynamically created providers
    await prisma.service.deleteMany({
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

    // 3. Delete availability from dynamically created providers
    await prisma.availability.deleteMany({
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

    // 4. Delete dynamically created providers
    await prisma.provider.deleteMany({
      where: {
        user: {
          AND: [
            { email: { contains: '@example.com' } },
            { email: { notIn: keepEmails } }
          ]
        }
      }
    })

    // 5. Delete dynamically created users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@example.com',
          notIn: keepEmails
        }
      }
    })

    // Success - no console.log to avoid cluttering test output
  } catch (error) {
    // Only log actual errors
    console.error('⚠️ Error in global afterEach cleanup:', error)
  }
})

// Disconnect Prisma after all tests
test.afterAll(async () => {
  await prisma.$disconnect()
})
