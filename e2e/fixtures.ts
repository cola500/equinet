/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

// Singleton pattern to avoid connection leaks
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Export singleton for spec files -- NEVER call $disconnect() on this
export { prisma }

/**
 * Custom test fixture
 *
 * Cleanup sker i cleanup.setup.ts (global teardown) -- INTE per test.
 * Per-test cleanup orsakade MaxClientsInSessionMode (13+ queries x 25 tester).
 *
 * Importera denna istället för @playwright/test i alla spec-filer:
 * import { test, expect } from './fixtures'
 */
export const test = base.extend<object, object>({
  page: async ({ page }, use) => {
    // Dismiss cookie notice globally so it doesn't overlap UI elements
    await page.addInitScript(() => {
      localStorage.setItem('equinet-cookie-notice-dismissed', 'true')
    })
    await use(page)
  },
})

// Re-export expect for convenience
export { expect } from '@playwright/test'
