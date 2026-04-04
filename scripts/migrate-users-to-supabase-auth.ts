/**
 * S15-2: Migrera prod-användare till Supabase auth.users
 *
 * Reads password hashes from PoC auth.users (via pg, matched by EMAIL)
 * and creates users in prod auth.users (via Supabase Admin API) with
 * the PROD id + PoC password hash.
 *
 * Background: S15-1 dropped the passwordHash column from public.User on prod.
 * The hashes were migrated to PoC auth.users in S11-2. PoC and prod have
 * DIFFERENT user IDs but SAME emails, so we match on email.
 *
 * The on_auth_user_created trigger fires on INSERT to auth.users and tries
 * to INSERT into public.User with ON CONFLICT (id) DO NOTHING. Since we
 * create auth.users with the PROD id (which already exists in public.User),
 * the trigger safely no-ops.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts --dry-run    # Dry-run
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts               # Live
 *
 * Env files:
 *   .env          - PoC DATABASE_URL (commented out, parsed via regex)
 *   .env.supabase - Prod NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + DATABASE_URL
 */

import { createClient } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"
import { Client as PgClient } from "pg"
import { readFileSync } from "fs"
import { resolve } from "path"

// -- Load env --

// Parse .env.supabase explicitly (process.env may have .env.local overrides)
function parseEnvFile(path: string): Record<string, string> {
  const content = readFileSync(resolve(path), "utf-8")
  const vars: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
    if (match) vars[match[1]] = match[2]
  }
  return vars
}

const prodEnv = parseEnvFile(".env.supabase")

const PROD_SUPABASE_URL = prodEnv.NEXT_PUBLIC_SUPABASE_URL
const PROD_SERVICE_ROLE_KEY = prodEnv.SUPABASE_SERVICE_ROLE_KEY
const PROD_DATABASE_URL = prodEnv.DATABASE_URL

if (!PROD_SUPABASE_URL || !PROD_SERVICE_ROLE_KEY || !PROD_DATABASE_URL) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL in .env.supabase"
  )
  process.exit(1)
}

// PoC database URL -- read from .env (commented out pooler line, session mode port 5432)
function getPocDatabaseUrl(): string {
  const envContent = readFileSync(resolve(".env"), "utf-8")
  const poolerMatch = envContent.match(
    /^#?\s*DATABASE_URL="(postgresql:\/\/postgres\.zzdamokfeenencuggjjp:[^"]*@aws[^"]*)"/m
  )
  if (poolerMatch) {
    return poolerMatch[1]
      .replace(/\?schema=\w+/, "")
      .replace(/:6543\//, ":5432/")
  }
  console.error(
    "Could not find PoC DATABASE_URL in .env (project zzdamokfeenencuggjjp)"
  )
  process.exit(1)
}

const POC_DATABASE_URL = getPocDatabaseUrl()

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 500

// Prod Supabase admin client
const prodSupabase = createClient(PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Prisma reads from prod
const prisma = new PrismaClient({
  datasourceUrl: PROD_DATABASE_URL,
})

interface MigrationResult {
  migrated: number
  skipped: number
  noPassword: number
  errors: { userId: string; email: string; code: string }[]
}

// Match by EMAIL (PoC and prod have different UUIDs but same emails)
async function fetchPocPasswordHashes(): Promise<Map<string, string>> {
  console.log("Connecting to PoC database to read password hashes...")
  const pg = new PgClient({
    connectionString: POC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await pg.connect()

  const { rows } = await pg.query<{
    email: string
    encrypted_password: string
  }>(
    "SELECT email, encrypted_password FROM auth.users WHERE encrypted_password IS NOT NULL AND encrypted_password != ''"
  )

  await pg.end()
  console.log(`  Found ${rows.length} users with password hashes in PoC\n`)

  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.email.toLowerCase(), row.encrypted_password)
  }
  return map
}

async function run() {
  console.log(
    `=== S15-2: Migrera prod-användare till Supabase Auth ${DRY_RUN ? "(DRY-RUN)" : "(LIVE)"} ===`
  )
  console.log(`  Prod Supabase: ${PROD_SUPABASE_URL}`)
  console.log(`  PoC DB: zzdamokfeenencuggjjp (via pooler)\n`)

  // 1. Fetch password hashes from PoC (keyed by email)
  const pocHashes = await fetchPocPasswordHashes()

  // 2. Fetch eligible users from prod
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

  const totalUsers = await prisma.user.count()
  const ghostCount = await prisma.user.count({
    where: { isManualCustomer: true },
  })
  const blockedCount = await prisma.user.count({
    where: { isBlocked: true, isManualCustomer: false },
  })

  console.log(`Prod public.User: ${totalUsers} totalt`)
  console.log(`  - Ghost users (exkluderade): ${ghostCount}`)
  console.log(`  - Blockerade (exkluderade): ${blockedCount}`)
  console.log(`  - Att migrera: ${users.length}`)

  const withHash = users.filter((u) =>
    pocHashes.has(u.email.toLowerCase())
  )
  const withoutHash = users.filter(
    (u) => !pocHashes.has(u.email.toLowerCase())
  )

  console.log(`  - Med lösenordshash från PoC: ${withHash.length}`)
  console.log(`  - Utan hash (saknas i PoC): ${withoutHash.length}`)
  console.log()

  if (DRY_RUN) {
    console.log("--- DRY-RUN: Listar användare ---\n")
    for (const user of users) {
      const hasHash = pocHashes.has(user.email.toLowerCase())
        ? "HAS_HASH"
        : "NO_HASH"
      console.log(
        `  ${user.email} (${user.userType}${user.isAdmin ? ", admin" : ""}) [${hasHash}]`
      )
    }
    console.log(
      `\n--- DRY-RUN klar. ${users.length} skulle migreras (${withHash.length} med hash, ${withoutHash.length} utan). ---`
    )
    await prisma.$disconnect()
    return
  }

  // 3. Migrate in batches
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    noPassword: 0,
    errors: [],
  }

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(users.length / BATCH_SIZE)

    console.log(
      `Batch ${batchNum}/${totalBatches} (${batch.length} användare)...`
    )

    for (const user of batch) {
      const passwordHash = pocHashes.get(user.email.toLowerCase())

      const createParams: Parameters<
        typeof prodSupabase.auth.admin.createUser
      >[0] = {
        id: user.id,
        email: user.email,
        email_confirm: true,
        user_metadata: {
          firstName: user.firstName,
          lastName: user.lastName,
        },
        app_metadata: {
          userType: user.userType,
          isAdmin: user.isAdmin,
        },
      }

      if (passwordHash) {
        createParams.password_hash = passwordHash
      } else {
        result.noPassword++
      }

      const { data, error } = await prodSupabase.auth.admin.createUser(
        createParams
      )

      if (error) {
        if (
          error.code === "email_exists" ||
          error.code === "user_already_exists"
        ) {
          result.skipped++
        } else {
          result.errors.push({
            userId: user.id,
            email: user.email,
            code: error.code ?? "unknown",
          })
          console.error(
            `  ERROR: ${user.email} -> ${error.code}: ${error.message}`
          )
        }
      } else if (data?.user) {
        result.migrated++
      }
    }

    if (i + BATCH_SIZE < users.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  // 4. Summary
  console.log("\n=== Sammanfattning ===")
  console.log(`  Migrerade: ${result.migrated}`)
  console.log(`  Skippade (redan existerande): ${result.skipped}`)
  console.log(`  Utan lösenord (skapade utan hash): ${result.noPassword}`)
  console.log(`  Fel: ${result.errors.length}`)

  if (result.errors.length > 0) {
    console.log("\n  Fel-detaljer:")
    for (const err of result.errors) {
      console.log(`    ${err.email} (${err.userId}): ${err.code}`)
    }
  }

  await prisma.$disconnect()

  if (result.errors.length > 0) {
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(
    `Script failed: ${e instanceof Error ? `${e.constructor.name}: ${e.message}` : "unknown"}`
  )
  prisma.$disconnect()
  process.exit(1)
})
