/**
 * Steg 0: Verifiera att bcrypt-hash kan kopieras till Supabase auth.users
 * via Admin API password_hash-parameter, och att login fungerar.
 *
 * Usage: npx tsx scripts/verify-password-hash.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcrypt"
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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = "hash-verify-test@equinet.se"
const TEST_PASSWORD = "TestPassword123!"

async function run() {
  console.log("=== Steg 0: Verifiera password_hash ===\n")

  // 1. Generate bcrypt hash (same format as our app)
  const hash = await bcrypt.hash(TEST_PASSWORD, 10)
  console.log(`1. Genererad bcrypt-hash: ${hash.substring(0, 7)}...`)

  // 2. Clean up any previous test user
  const { data: existing } = await supabase.auth.admin.listUsers()
  const existingUser = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (existingUser) {
    await supabase.auth.admin.deleteUser(existingUser.id)
    console.log("   (Rensade tidigare testanvändare)")
  }

  // 3. Create user WITH password_hash via Admin API
  // Docs: https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0
  console.log("\n2. Skapar användare via Admin API med password_hash...")
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password_hash: hash,
      email_confirm: true,
      user_metadata: { firstName: "Test", lastName: "Hash" },
      app_metadata: { userType: "provider", isAdmin: false },
    })

  if (createError) {
    console.error(`   FEL vid skapande: ${createError.code}`)
    process.exit(1)
  }

  const userId = created.user.id
  console.log(`   Skapad: ${userId}`)

  // 4. THE REAL TEST: login with the password that matches the hash
  console.log("\n3. Testar login med lösenordet som matchar hashen...")
  const { data: loginData, error: loginError } =
    await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

  if (loginError) {
    console.error(`\n   LOGIN MISSLYCKADES: ${loginError.code}`)
    console.log("   RESULTAT: password_hash fungerar INTE.")
    // Cleanup
    await supabase.auth.admin.deleteUser(userId)
    process.exit(1)
  }

  console.log("   LOGIN OK!")
  console.log(
    `   user_metadata: ${JSON.stringify(loginData.user.user_metadata)}`
  )
  console.log(
    `   app_metadata: ${JSON.stringify(loginData.user.app_metadata)}`
  )

  // Check JWT claims
  if (loginData.session?.access_token) {
    const payload = JSON.parse(
      Buffer.from(
        loginData.session.access_token.split(".")[1],
        "base64"
      ).toString()
    )
    console.log(
      `   JWT app_metadata: ${JSON.stringify(payload.app_metadata)}`
    )
  }

  // 5. Cleanup
  console.log("\n4. Rensar testanvändare...")
  await supabase.auth.admin.deleteUser(userId)

  console.log("\n=== RESULTAT: password_hash fungerar! ===")
  console.log("Migreringsscriptet kan använda Admin API createUser med:")
  console.log("  - password_hash: <bcrypt-hash fran public.User>")
  console.log("  - user_metadata: { firstName, lastName }")
  console.log("  - app_metadata: { userType, isAdmin }")
}

run().catch((e) => {
  console.error(
    `Script failed: ${e instanceof Error ? e.constructor.name : "unknown"}`
  )
  process.exit(1)
})
