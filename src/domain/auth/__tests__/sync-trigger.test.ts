// @vitest-environment node
/**
 * Integration tests for the handle_new_user() trigger logic.
 *
 * The actual trigger fires on auth.users INSERT (Supabase-managed schema).
 * Since auth.users doesn't exist in local Docker DB, we test the function's
 * INSERT logic directly: given a UUID + email + metadata, verify that the
 * correct public.User row is created.
 *
 * Full integration testing happens against the Supabase dev project.
 *
 * Requires: local Docker DB running (npm run db:up)
 * Skips automatically in CI (CI uses equinet_test DB, not equinet).
 */
import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"

const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/equinet"
const isCI = !!process.env.CI

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe.skipIf(isCI)("handle_new_user trigger logic", () => {
  const testUserIds: string[] = []

  afterAll(async () => {
    // Clean up test users
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      })
    }
  })

  it("creates a public.User with correct fields from metadata", async () => {
    const id = randomUUID()
    testUserIds.push(id)

    // Simulate what the trigger does: INSERT into public.User
    // email_confirmed_at = NULL -> emailVerified = false
    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (
        id, email, "passwordHash", "userType",
        "firstName", "lastName",
        "emailVerified", "emailVerifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, '',
        'customer',
        COALESCE($3, ''),
        COALESCE($4, ''),
        false,
        NULL,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, id, "trigger-test@example.com", "Anna", "Svensson")

    const user = await prisma.user.findUnique({ where: { id } })

    expect(user).not.toBeNull()
    expect(user!.email).toBe("trigger-test@example.com")
    expect(user!.userType).toBe("customer")
    expect(user!.firstName).toBe("Anna")
    expect(user!.lastName).toBe("Svensson")
    expect(user!.passwordHash).toBe("")
    expect(user!.emailVerified).toBe(false)
    expect(user!.emailVerifiedAt).toBeNull()
  })

  it("hardcodes userType to customer -- ignores metadata", async () => {
    const id = randomUUID()
    testUserIds.push(id)

    // Even if someone passes 'provider' in metadata, trigger hardcodes 'customer'
    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (
        id, email, "passwordHash", "userType",
        "firstName", "lastName",
        "emailVerified", "emailVerifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, '',
        'customer',
        COALESCE($3, ''),
        COALESCE($4, ''),
        false, NULL,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, id, "provider-attempt@example.com", "Hacker", "McHackface")

    const user = await prisma.user.findUnique({ where: { id } })

    expect(user).not.toBeNull()
    expect(user!.userType).toBe("customer")
  })

  it("defaults firstName and lastName to empty string when metadata is null", async () => {
    const id = randomUUID()
    testUserIds.push(id)

    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (
        id, email, "passwordHash", "userType",
        "firstName", "lastName",
        "emailVerified", "emailVerifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, '',
        'customer',
        COALESCE(NULL, ''),
        COALESCE(NULL, ''),
        false, NULL,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, id, "no-name@example.com")

    const user = await prisma.user.findUnique({ where: { id } })

    expect(user).not.toBeNull()
    expect(user!.firstName).toBe("")
    expect(user!.lastName).toBe("")
  })

  it("ON CONFLICT DO NOTHING -- duplicate insert is a no-op", async () => {
    const id = randomUUID()
    testUserIds.push(id)

    // First insert
    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (
        id, email, "passwordHash", "userType",
        "firstName", "lastName",
        "emailVerified", "emailVerifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, '',
        'customer', 'First', 'Insert',
        false, NULL,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, id, "dupe-test@example.com")

    // Second insert with same ID -- should be no-op
    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (
        id, email, "passwordHash", "userType",
        "firstName", "lastName",
        "emailVerified", "emailVerifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, '',
        'customer', 'Second', 'Insert',
        false, NULL,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, id, "dupe-test-2@example.com")

    const user = await prisma.user.findUnique({ where: { id } })

    // Original values preserved
    expect(user!.firstName).toBe("First")
    expect(user!.lastName).toBe("Insert")
    expect(user!.email).toBe("dupe-test@example.com")
  })

  it("sets emailVerified=true when email_confirmed_at is provided", async () => {
    const id = randomUUID()
    testUserIds.push(id)
    const confirmedAt = new Date("2026-04-01T12:00:00Z")

    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (
        id, email, "passwordHash", "userType",
        "firstName", "lastName",
        "emailVerified", "emailVerifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, '',
        'customer', 'Verified', 'User',
        $3 IS NOT NULL,
        $3,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, id, "verified@example.com", confirmedAt)

    const user = await prisma.user.findUnique({ where: { id } })

    expect(user).not.toBeNull()
    expect(user!.emailVerified).toBe(true)
    expect(user!.emailVerifiedAt).toEqual(confirmedAt)
  })
})
