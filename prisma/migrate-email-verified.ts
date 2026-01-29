/**
 * Migration script to mark existing users as email verified
 *
 * Run with: npx tsx prisma/migrate-email-verified.ts
 *
 * This script marks all existing users as verified since they
 * registered before email verification was implemented.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting email verification migration...")

  // Count unverified users
  const unverifiedCount = await prisma.user.count({
    where: { emailVerified: false },
  })

  console.log(`Found ${unverifiedCount} unverified users`)

  if (unverifiedCount === 0) {
    console.log("No users to migrate")
    return
  }

  // Update all unverified users to verified
  const result = await prisma.user.updateMany({
    where: { emailVerified: false },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  console.log(`Successfully migrated ${result.count} users`)
}

main()
  .catch((error) => {
    console.error("Migration failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
