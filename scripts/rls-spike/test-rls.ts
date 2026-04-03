/**
 * RLS Spike: Test Prisma + set_config + Row Level Security
 *
 * Tests all 8 scenarios against Supabase in an isolated rls_test schema.
 * Uses DIRECT_DATABASE_URL (bypasses PgBouncer) for setup,
 * and both direct + pooler URLs for tests.
 *
 * Usage:
 *   npx tsx scripts/rls-spike/test-rls.ts
 *
 * Requires .env.supabase with Supabase credentials.
 */

import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { resolve } from "path"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Local Docker PostgreSQL -- full control over roles and RLS
const LOCAL_DB_URL = "postgresql://postgres:postgres@localhost:5432/equinet"

function loadEnv(): { directUrl: string } {
  return { directUrl: LOCAL_DB_URL }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestResult {
  name: string
  passed: boolean
  detail: string
  durationMs: number
}

const results: TestResult[] = []

function log(msg: string) {
  console.log(`  ${msg}`)
}

function logHeader(msg: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`  ${msg}`)
  console.log("=".repeat(60))
}

async function runTest(
  name: string,
  fn: () => Promise<{ passed: boolean; detail: string }>
) {
  const start = performance.now()
  try {
    const { passed, detail } = await fn()
    const durationMs = Math.round(performance.now() - start)
    results.push({ name, passed, detail, durationMs })
    console.log(`\n  ${passed ? "PASS" : "FAIL"} ${name} (${durationMs}ms)`)
    log(detail)
  } catch (err) {
    const durationMs = Math.round(performance.now() - start)
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name, passed: false, detail: `ERROR: ${detail}`, durationMs })
    console.log(`\n  FAIL ${name} (${durationMs}ms)`)
    log(`ERROR: ${detail}`)
  }
}

// ---------------------------------------------------------------------------
// Test data IDs (deterministic UUIDs for easy cleanup)
// ---------------------------------------------------------------------------

const PROVIDER_A_USER_ID = "a0000000-0000-4000-a000-000000000001"
const PROVIDER_B_USER_ID = "a0000000-0000-4000-a000-000000000002"
const PROVIDER_A_ID = "a0000000-0000-4000-a000-000000000011"
const PROVIDER_B_ID = "a0000000-0000-4000-a000-000000000012"
const CUSTOMER_A_ID = "a0000000-0000-4000-a000-000000000021"
const CUSTOMER_B_ID = "a0000000-0000-4000-a000-000000000022"
const SERVICE_A_ID = "a0000000-0000-4000-a000-000000000031"
const SERVICE_B_ID = "a0000000-0000-4000-a000-000000000032"

// Booking IDs: A1-A3 belong to provider A, B1-B3 to provider B
const BOOKING_A1 = "a0000000-0000-4000-a000-0000000000a1"
const BOOKING_A2 = "a0000000-0000-4000-a000-0000000000a2"
const BOOKING_A3 = "a0000000-0000-4000-a000-0000000000a3"
const BOOKING_B1 = "a0000000-0000-4000-a000-0000000000b1"
const BOOKING_B2 = "a0000000-0000-4000-a000-0000000000b2"
const BOOKING_B3 = "a0000000-0000-4000-a000-0000000000b3"

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

async function setupSchema(prisma: PrismaClient) {
  logHeader("SETUP: Creating rls_test schema + seed data")

  // Create schema
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS rls_test`)
  log("Schema rls_test created")

  // Set search_path so Prisma operations target rls_test
  await prisma.$executeRawUnsafe(`SET search_path TO rls_test, public`)
  log("search_path set to rls_test")
}

async function migrateSchema(directUrl: string) {
  logHeader("MIGRATE: Running prisma migrate deploy against rls_test")

  const { execSync } = await import("child_process")
  const schemaUrl = `${directUrl}?schema=rls_test`

  try {
    const output = execSync(
      `DATABASE_URL="${schemaUrl}" DIRECT_DATABASE_URL="${directUrl}" npx prisma migrate deploy`,
      {
        cwd: resolve(__dirname, "../.."),
        encoding: "utf-8",
        timeout: 60000,
        env: {
          ...process.env,
          DATABASE_URL: schemaUrl,
          DIRECT_DATABASE_URL: directUrl,
        },
      }
    )
    log("Migration complete")
    // Show last few lines
    const lines = output.trim().split("\n")
    for (const line of lines.slice(-5)) {
      log(`  ${line}`)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Migration output: ${msg}`)
    throw new Error("prisma migrate deploy failed")
  }
}

async function seedData(prisma: PrismaClient) {
  log("\nSeeding test data...")

  // Users (2 providers, 2 customers)
  const users = [
    { id: PROVIDER_A_USER_ID, email: "rls-provider-a@test.local", passwordHash: "x", userType: "provider", firstName: "Provider", lastName: "A" },
    { id: PROVIDER_B_USER_ID, email: "rls-provider-b@test.local", passwordHash: "x", userType: "provider", firstName: "Provider", lastName: "B" },
    { id: CUSTOMER_A_ID, email: "rls-customer-a@test.local", passwordHash: "x", userType: "customer", firstName: "Kund", lastName: "A" },
    { id: CUSTOMER_B_ID, email: "rls-customer-b@test.local", passwordHash: "x", userType: "customer", firstName: "Kund", lastName: "B" },
  ]

  for (const u of users) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO rls_test."User" (id, email, "passwordHash", "userType", "firstName", "lastName", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      u.id, u.email, u.passwordHash, u.userType, u.firstName, u.lastName
    )
  }
  log("  4 users created")

  // Providers
  const providers = [
    { id: PROVIDER_A_ID, userId: PROVIDER_A_USER_ID, businessName: "RLS Test Hovslagare A" },
    { id: PROVIDER_B_ID, userId: PROVIDER_B_USER_ID, businessName: "RLS Test Hovslagare B" },
  ]

  for (const p of providers) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO rls_test."Provider" (id, "userId", "businessName", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      p.id, p.userId, p.businessName
    )
  }
  log("  2 providers created")

  // Services
  const services = [
    { id: SERVICE_A_ID, providerId: PROVIDER_A_ID, name: "Hovvard A", price: 800, durationMinutes: 60 },
    { id: SERVICE_B_ID, providerId: PROVIDER_B_ID, name: "Hovvard B", price: 900, durationMinutes: 45 },
  ]

  for (const s of services) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO rls_test."Service" (id, "providerId", name, price, "durationMinutes", "createdAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO NOTHING`,
      s.id, s.providerId, s.name, s.price, s.durationMinutes
    )
  }
  log("  2 services created")

  // Bookings: 3 per provider
  const bookings = [
    { id: BOOKING_A1, customerId: CUSTOMER_A_ID, providerId: PROVIDER_A_ID, serviceId: SERVICE_A_ID, date: "2026-04-10", start: "09:00", end: "10:00" },
    { id: BOOKING_A2, customerId: CUSTOMER_B_ID, providerId: PROVIDER_A_ID, serviceId: SERVICE_A_ID, date: "2026-04-10", start: "10:00", end: "11:00" },
    { id: BOOKING_A3, customerId: CUSTOMER_A_ID, providerId: PROVIDER_A_ID, serviceId: SERVICE_A_ID, date: "2026-04-11", start: "09:00", end: "10:00" },
    { id: BOOKING_B1, customerId: CUSTOMER_B_ID, providerId: PROVIDER_B_ID, serviceId: SERVICE_B_ID, date: "2026-04-10", start: "09:00", end: "09:45" },
    { id: BOOKING_B2, customerId: CUSTOMER_A_ID, providerId: PROVIDER_B_ID, serviceId: SERVICE_B_ID, date: "2026-04-10", start: "10:00", end: "10:45" },
    { id: BOOKING_B3, customerId: CUSTOMER_B_ID, providerId: PROVIDER_B_ID, serviceId: SERVICE_B_ID, date: "2026-04-11", start: "09:00", end: "09:45" },
  ]

  for (const b of bookings) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO rls_test."Booking" (id, "customerId", "providerId", "serviceId", "bookingDate", "startTime", "endTime", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, 'confirmed', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      b.id, b.customerId, b.providerId, b.serviceId, b.date, b.start, b.end
    )
  }
  log("  6 bookings created (3 per provider)")
}

async function createAppRole(prisma: PrismaClient) {
  log("\nCreating app_user role (non-superuser, no BYPASSRLS)...")

  // PostgreSQL superusers bypass RLS entirely (even with FORCE).
  // Supabase's postgres role is superuser + BYPASSRLS.
  // We create a dedicated non-superuser role to test RLS properly.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_app_user') THEN
        CREATE ROLE rls_app_user LOGIN PASSWORD 'rls_spike_2026';
      END IF;
    END $$
  `)

  // Grant usage on rls_test schema + all tables
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA rls_test TO rls_app_user`)
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rls_test TO rls_app_user`)
  log("  rls_app_user created with access to rls_test schema")
}

// Instead of connecting as rls_app_user (Supabase pooler rejects custom roles),
// we connect as postgres and SET ROLE within transactions.
// This is also the realistic production pattern: connect via pooler, SET ROLE per-request.

async function enableRLS(prisma: PrismaClient) {
  log("\nEnabling RLS on Booking...")

  await prisma.$executeRawUnsafe(
    `ALTER TABLE rls_test."Booking" ENABLE ROW LEVEL SECURITY`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE rls_test."Booking" FORCE ROW LEVEL SECURITY`
  )
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'booking_provider_read' AND schemaname = 'rls_test'
      ) THEN
        CREATE POLICY booking_provider_read ON rls_test."Booking"
          FOR SELECT USING ("providerId" = current_setting('app.provider_id', TRUE));
      END IF;
    END $$
  `)
  log("  RLS enabled + FORCE + policy created on rls_test.Booking")

  // For Test 8: RLS on Service WITHOUT policy
  await prisma.$executeRawUnsafe(
    `ALTER TABLE rls_test."Service" ENABLE ROW LEVEL SECURITY`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE rls_test."Service" FORCE ROW LEVEL SECURITY`
  )
  log("  RLS enabled + FORCE on rls_test.Service (NO policy = deny all)")
}

async function cleanup(prisma: PrismaClient) {
  logHeader("CLEANUP: Dropping rls_test schema + rls_app_user role")
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS rls_test CASCADE`)
  log("Schema rls_test dropped")
  // REASSIGN needed before DROP ROLE if role owns any remaining objects
  await prisma.$executeRawUnsafe(`REASSIGN OWNED BY rls_app_user TO postgres`)
  await prisma.$executeRawUnsafe(`DROP OWNED BY rls_app_user`)
  await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS rls_app_user`)
  log("Role rls_app_user dropped")
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

// Helper: run a query as rls_app_user with set_config in a transaction
// Pattern: SET ROLE -> set_config -> query -> RESET ROLE
// This simulates the production pattern: connect via pooler, assume role per-request
async function queryAsAppUser(
  prisma: PrismaClient,
  providerId: string | null,
  query: string
): Promise<unknown[]> {
  if (providerId) {
    const [, , result] = await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET ROLE rls_app_user`),
      prisma.$queryRawUnsafe(
        `SELECT set_config('app.provider_id', '${providerId}', TRUE)`
      ),
      prisma.$queryRawUnsafe(query),
    ]) as [unknown, unknown, unknown[]]
    // RESET ROLE outside transaction (cleanup)
    await prisma.$executeRawUnsafe(`RESET ROLE`)
    return result
  } else {
    const [, result] = await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET ROLE rls_app_user`),
      prisma.$queryRawUnsafe(query),
    ]) as [unknown, unknown[]]
    await prisma.$executeRawUnsafe(`RESET ROLE`)
    return result
  }
}

async function test1_setConfigInTransaction(prisma: PrismaClient) {
  await runTest("Test 1: Prisma + set_config i $transaction", async () => {
    const bookingsA = await queryAsAppUser(
      prisma, PROVIDER_A_ID,
      `SELECT id, "providerId" FROM rls_test."Booking"`
    ) as { id: string; providerId: string }[]

    const bookingsB = await queryAsAppUser(
      prisma, PROVIDER_B_ID,
      `SELECT id, "providerId" FROM rls_test."Booking"`
    ) as { id: string; providerId: string }[]

    const aCount = bookingsA.length
    const bCount = bookingsB.length
    const aAllCorrect = bookingsA.every((b) => b.providerId === PROVIDER_A_ID)
    const bAllCorrect = bookingsB.every((b) => b.providerId === PROVIDER_B_ID)

    const passed = aCount === 3 && bCount === 3 && aAllCorrect && bAllCorrect
    return {
      passed,
      detail: `Provider A: ${aCount} bookings (all correct: ${aAllCorrect}), Provider B: ${bCount} bookings (all correct: ${bAllCorrect})`,
    }
  })
}

async function test2_withoutSetConfig(prisma: PrismaClient) {
  await runTest("Test 2: Utan set_config (negativ-test)", async () => {
    // Without set_config, current_setting returns NULL, policy should deny all
    const bookings = await queryAsAppUser(
      prisma, null,
      `SELECT id FROM rls_test."Booking"`
    ) as { id: string }[]

    const passed = bookings.length === 0
    return {
      passed,
      detail: `Rows returned without set_config: ${bookings.length} (expected: 0)`,
    }
  })
}

async function test3_separateConnection(directUrl: string) {
  await runTest("Test 3: Separat Prisma-klient (ny connection)", async () => {
    // Verifies SET ROLE + set_config works on a fresh connection
    // Simulates how serverless would work: new client per request
    const freshPrisma = new PrismaClient({
      datasources: { db: { url: `${directUrl}?schema=rls_test` } },
    })

    try {
      const bookings = await queryAsAppUser(
        freshPrisma, PROVIDER_A_ID,
        `SELECT id, "providerId" FROM rls_test."Booking"`
      ) as { id: string; providerId: string }[]

      // Also verify a second query on same client gets different provider
      const bookingsB = await queryAsAppUser(
        freshPrisma, PROVIDER_B_ID,
        `SELECT id, "providerId" FROM rls_test."Booking"`
      ) as { id: string; providerId: string }[]

      const aOk = bookings.length === 3 && bookings.every((b) => b.providerId === PROVIDER_A_ID)
      const bOk = bookingsB.length === 3 && bookingsB.every((b) => b.providerId === PROVIDER_B_ID)

      return {
        passed: aOk && bOk,
        detail: `Fresh client: A=${bookings.length} (correct: ${aOk}), B=${bookingsB.length} (correct: ${bOk})`,
      }
    } finally {
      await freshPrisma.$disconnect()
    }
  })
}

async function test4_queryRawUnsafe(prisma: PrismaClient) {
  await runTest("Test 4: $queryRawUnsafe med RLS", async () => {
    const bookings = await queryAsAppUser(
      prisma, PROVIDER_A_ID,
      `SELECT b.id, b."providerId", b."bookingDate", b.status
       FROM rls_test."Booking" b
       WHERE b.status = 'confirmed'
       ORDER BY b."bookingDate"`
    ) as { id: string; providerId: string }[]

    const count = bookings.length
    const allCorrect = bookings.every((b) => b.providerId === PROVIDER_A_ID)

    return {
      passed: count === 3 && allCorrect,
      detail: `Raw query: ${count} confirmed bookings for Provider A (all correct: ${allCorrect})`,
    }
  })
}

async function test5_performance(prisma: PrismaClient) {
  await runTest("Test 5: Prestanda (100 queries)", async () => {
    const iterations = 100

    // With RLS: SET ROLE + set_config + query in transaction
    const startWithRls = performance.now()
    for (let i = 0; i < iterations; i++) {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`SET ROLE rls_app_user`),
        prisma.$queryRawUnsafe(
          `SELECT set_config('app.provider_id', '${PROVIDER_A_ID}', TRUE)`
        ),
        prisma.$queryRawUnsafe(`SELECT id FROM rls_test."Booking"`),
      ])
      await prisma.$executeRawUnsafe(`RESET ROLE`)
    }
    const withRlsMs = performance.now() - startWithRls

    // Baseline: simple query as superuser (no RLS)
    const startBaseline = performance.now()
    for (let i = 0; i < iterations; i++) {
      await prisma.$queryRawUnsafe(`SELECT id FROM rls_test."Booking"`)
    }
    const baselineMs = performance.now() - startBaseline

    const avgWithRls = (withRlsMs / iterations).toFixed(1)
    const avgBaseline = (baselineMs / iterations).toFixed(1)
    const overhead = (withRlsMs / iterations - baselineMs / iterations).toFixed(1)

    return {
      passed: true, // Performance test always passes, we just record the numbers
      detail: [
        `${iterations} iterations:`,
        `  With RLS (SET ROLE + set_config + query): ${withRlsMs.toFixed(0)}ms total, ${avgWithRls}ms/query avg`,
        `  Baseline (superuser, no RLS):              ${baselineMs.toFixed(0)}ms total, ${avgBaseline}ms/query avg`,
        `  Overhead per query:                        ${overhead}ms`,
      ].join("\n"),
    }
  })
}

async function test6_sessionLeakage(prisma: PrismaClient) {
  await runTest("Test 6: Session-lackage mellan transaktioner", async () => {
    // Transaction 1: SET ROLE + set_config for Provider A
    await queryAsAppUser(prisma, PROVIDER_A_ID, `SELECT id FROM rls_test."Booking"`)

    // Transaction 2: SET ROLE but NO set_config -- should NOT leak Provider A's context
    const bookings = await queryAsAppUser(
      prisma, null,
      `SELECT id FROM rls_test."Booking"`
    ) as { id: string }[]

    const passed = bookings.length === 0
    return {
      passed,
      detail: `Rows after prior set_config transaction: ${bookings.length} (expected: 0, no leakage)`,
    }
  })
}

async function test7_concurrentAccess(prisma: PrismaClient) {
  await runTest("Test 7: Concurrent access (parallella transaktioner)", async () => {
    // Run two transactions in parallel with different provider IDs
    // Note: with SET ROLE + RESET ROLE we need separate Prisma clients
    // to avoid the RESET ROLE of one affecting the other's transaction
    const promiseA = queryAsAppUser(prisma, PROVIDER_A_ID, `SELECT id, "providerId" FROM rls_test."Booking"`)
    const promiseB = queryAsAppUser(prisma, PROVIDER_B_ID, `SELECT id, "providerId" FROM rls_test."Booking"`)
    const [bookingsA, bookingsB] = await Promise.all([promiseA, promiseB]) as [
      { id: string; providerId: string }[],
      { id: string; providerId: string }[],
    ]

    const aCorrect = bookingsA.length === 3 && bookingsA.every((b) => b.providerId === PROVIDER_A_ID)
    const bCorrect = bookingsB.length === 3 && bookingsB.every((b) => b.providerId === PROVIDER_B_ID)

    return {
      passed: aCorrect && bCorrect,
      detail: `Concurrent: A got ${bookingsA.length} (correct: ${aCorrect}), B got ${bookingsB.length} (correct: ${bCorrect})`,
    }
  })
}

async function test8_noPolicyFallback(prisma: PrismaClient) {
  await runTest("Test 8: Ingen-policy-fallback (deny-by-default)", async () => {
    // Service table has RLS + FORCE but NO policy -- should return 0 rows
    const services = await queryAsAppUser(
      prisma, null,
      `SELECT id FROM rls_test."Service"`
    ) as { id: string }[]

    // Even with set_config, no policy means no access
    const servicesWithConfig = await queryAsAppUser(
      prisma, PROVIDER_A_ID,
      `SELECT id FROM rls_test."Service"`
    ) as { id: string }[]

    const passed = services.length === 0 && servicesWithConfig.length === 0
    return {
      passed,
      detail: `Without policy: ${services.length} rows. With set_config but no policy: ${servicesWithConfig.length} rows. (both expected: 0)`,
    }
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("RLS Spike: Prisma + set_config + Row Level Security")
  console.log("====================================================")

  const { directUrl } = loadEnv()
  log(`Database: ${directUrl.replace(/:[^:@]*@/, ':***@')}`)
  log(`Target: Local Docker PostgreSQL (full superuser control)`)

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  })

  try {
    // Setup as superuser postgres
    await setupSchema(prisma)
    await migrateSchema(directUrl)
    await seedData(prisma)
    await createAppRole(prisma)
    await enableRLS(prisma)
    await prisma.$disconnect()

    // Tests use SET ROLE rls_app_user within transactions
    const rlsPrisma = new PrismaClient({
      datasources: { db: { url: `${directUrl}?schema=rls_test` } },
    })

    try {
      logHeader("RUNNING TESTS (SET ROLE rls_app_user in each transaction)")

      await test1_setConfigInTransaction(rlsPrisma)
      await test2_withoutSetConfig(rlsPrisma)
      await test3_separateConnection(directUrl)
      await test4_queryRawUnsafe(rlsPrisma)
      await test5_performance(rlsPrisma)
      await test6_sessionLeakage(rlsPrisma)
      await test7_concurrentAccess(rlsPrisma)
      await test8_noPolicyFallback(rlsPrisma)

      // Summary
      logHeader("RESULTS SUMMARY")
      const passed = results.filter((r) => r.passed).length
      const failed = results.filter((r) => !r.passed).length
      console.log(`\n  ${passed} passed, ${failed} failed out of ${results.length} tests\n`)
      for (const r of results) {
        console.log(`  ${r.passed ? "PASS" : "FAIL"} ${r.name} (${r.durationMs}ms)`)
      }

      // Write results JSON for documentation
      const outputPath = resolve(__dirname, "results.json")
      const { writeFileSync } = await import("fs")
      writeFileSync(outputPath, JSON.stringify(results, null, 2))
      log(`\nResults written to ${outputPath}`)

    } finally {
      await rlsPrisma.$disconnect()
    }

    // Cleanup (as superuser)
    logHeader("CLEANUP")
    const cleanupPrisma = new PrismaClient({
      datasources: { db: { url: directUrl } },
    })
    try {
      await cleanup(cleanupPrisma)
    } finally {
      await cleanupPrisma.$disconnect()
    }

  } catch (err) {
    console.error("\nFATAL ERROR:", err)

    // Attempt cleanup even on failure
    try {
      log("Attempting cleanup after error...")
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS rls_test CASCADE`)
      log("Cleanup successful")
    } catch {
      log("Cleanup failed -- run manually: DROP SCHEMA IF EXISTS rls_test CASCADE")
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
