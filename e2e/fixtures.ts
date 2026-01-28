/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Custom test fixture med afterEach cleanup
 * Sprint 2: Aktiverar global-hooks funktionalitet
 *
 * Importera denna istället för @playwright/test i alla spec-filer:
 * import { test, expect } from './fixtures'
 */
export const test = base.extend<object, object>({
  // Auto-run afterEach cleanup för varje test
  page: async ({ page }, use) => {
    // Use the page normally
    await use(page)

    // Cleanup after each test
    await cleanupTestData()
  },
})

// Re-export expect for convenience
export { expect } from '@playwright/test'

/**
 * Cleanup dynamically created test data
 * Keeps base test users (test@example.com, provider@example.com)
 */
async function cleanupTestData() {
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
                { email: { notIn: keepEmails } },
              ],
            },
          },
          {
            service: {
              provider: {
                user: {
                  AND: [
                    { email: { contains: '@example.com' } },
                    { email: { notIn: keepEmails } },
                  ],
                },
              },
            },
          },
        ],
      },
    })

    // 2. Delete services from dynamically created providers
    await prisma.service.deleteMany({
      where: {
        provider: {
          user: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } },
            ],
          },
        },
      },
    })

    // 3. Delete availability from dynamically created providers
    await prisma.availability.deleteMany({
      where: {
        provider: {
          user: {
            AND: [
              { email: { contains: '@example.com' } },
              { email: { notIn: keepEmails } },
            ],
          },
        },
      },
    })

    // 4. Delete dynamically created providers
    await prisma.provider.deleteMany({
      where: {
        user: {
          AND: [
            { email: { contains: '@example.com' } },
            { email: { notIn: keepEmails } },
          ],
        },
      },
    })

    // 5. Delete dynamically created users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@example.com',
          notIn: keepEmails,
        },
      },
    })

    // Success - no console.log to avoid cluttering test output
  } catch (error) {
    // Only log actual errors
    console.error('Error in afterEach cleanup:', error)
  }
}
