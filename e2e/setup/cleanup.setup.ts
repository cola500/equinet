import 'dotenv/config'
import { test as teardown } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { cleanupDynamicTestData } from './cleanup-utils'
import { shouldSkipCleanup } from './e2e-utils'

const prisma = new PrismaClient()

teardown('cleanup test data after all tests', async () => {
  if (shouldSkipCleanup()) {
    console.log('E2E_CLEANUP=false -- skipping global cleanup (data preserved for debugging)')
    return
  }

  console.log('Cleaning up test data...')

  try {
    await cleanupDynamicTestData(prisma)
    console.log('Test data cleanup complete!')
  } catch (error) {
    console.error('Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
})
