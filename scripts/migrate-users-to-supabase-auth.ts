/**
 * S11-2: Migrera befintliga användare från public.User till Supabase auth.users
 *
 * Läser alla icke-ghost, icke-blockerade användare via Prisma och skapar dem
 * i Supabase Auth via Admin API med password_hash (bcrypt kopieras direkt).
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts              # Live
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts --dry-run     # Dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

// Load env
config({ path: ".env.local" })
config({ path: ".env.supabase" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  )
  process.exit(1)
}

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 500

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const prisma = new PrismaClient()

interface MigrationResult {
  migrated: number
  skipped: number
  errors: { userId: string; code: string }[]
}

async function run() {
  console.log(
    `=== S11-2: Migrera användare till Supabase Auth ${DRY_RUN ? "(DRY-RUN)" : "(LIVE)"} ===\n`
  )

  // 1. Fetch eligible users
  const users = await prisma.user.findMany({
    where: {
      isManualCustomer: false,
      isBlocked: false,
    },
    select: {
      id: true,
      email: true,
      userType: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
    },
    orderBy: { createdAt: "asc" },
  })

  // Count excluded
  const totalUsers = await prisma.user.count()
  const ghostCount = await prisma.user.count({
    where: { isManualCustomer: true },
  })
  const blockedCount = await prisma.user.count({
    where: { isBlocked: true, isManualCustomer: false },
  })

  console.log(`Totalt i public.User: ${totalUsers}`)
  console.log(`  - Ghost users (exkluderade): ${ghostCount}`)
  console.log(`  - Blockerade (exkluderade): ${blockedCount}`)
  console.log(`  - Att migrera: ${users.length}`)
  console.log()

  if (DRY_RUN) {
    console.log("--- DRY-RUN: Listar användare ---\n")
    for (const user of users) {
      console.log(
        `  ${user.email} (${user.userType}${user.isAdmin ? ", admin" : ""})`
      )
    }
    console.log(`\n--- DRY-RUN klar. ${users.length} skulle migreras. ---`)
    await prisma.$disconnect()
    return
  }

  // 2. Migrate in batches
  const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] }

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(users.length / BATCH_SIZE)

    console.log(
      `Batch ${batchNum}/${totalBatches} (${batch.length} användare)...`
    )

    for (const user of batch) {
      const { data, error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        // passwordHash removed from User model -- this script is historical (already run)
        email_confirm: true,
        user_metadata: {
          firstName: user.firstName,
          lastName: user.lastName,
        },
        app_metadata: {
          userType: user.userType,
          isAdmin: user.isAdmin,
        },
      })

      if (error) {
        // user_already_exists = already migrated (idempotent)
        if (error.code === "email_exists" || error.code === "user_already_exists") {
          result.skipped++
        } else {
          result.errors.push({ userId: user.id, code: error.code ?? "unknown" })
        }
      } else if (data?.user) {
        result.migrated++
      }
    }

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < users.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  // 3. Summary
  console.log("\n=== Sammanfattning ===")
  console.log(`  Migrerade: ${result.migrated}`)
  console.log(`  Skippade (redan existerande): ${result.skipped}`)
  console.log(`  Fel: ${result.errors.length}`)

  if (result.errors.length > 0) {
    console.log("\n  Fel-detaljer:")
    for (const err of result.errors) {
      console.log(`    ${err.userId}: ${err.code}`)
    }
  }

  await prisma.$disconnect()

  // Exit with error code if there were failures
  if (result.errors.length > 0) {
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(
    `Script failed: ${e instanceof Error ? e.constructor.name : "unknown"}`
  )
  prisma.$disconnect()
  process.exit(1)
})
