/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { cleanupDynamicTestData } from './setup/cleanup-utils'

// Singleton pattern to avoid connection leaks
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Export singleton for spec files -- NEVER call $disconnect() on this
export { prisma }

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

    // Cleanup dynamic test data (always runs, not affected by E2E_CLEANUP)
    await cleanupDynamicTestData(prisma)
  },
})

// Re-export expect for convenience
export { expect } from '@playwright/test'
