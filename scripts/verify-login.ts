/**
 * Steg 4: Verifiera att migrerad användare kan logga in och JWT claims är korrekta
 *
 * Usage: npx tsx scripts/verify-login.ts
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env.supabase" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  process.exit(1)
}

// Use anon key (not service role) to simulate real client login
const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_USERS = [
  { email: "erik@hovslagare-uppsala.se", password: "test123", expectedType: "provider" },
  { email: "kund@test.se", password: "test123", expectedType: "customer" },
  { email: "admin@equinet.se", password: "test123", expectedType: "customer", expectedAdmin: true },
]

async function run() {
  console.log("=== Steg 4: Verifiera login + JWT claims ===\n")

  let allOk = true

  for (const testUser of TEST_USERS) {
    console.log(`Testar: ${testUser.email}...`)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    })

    if (error) {
      console.error(`  LOGIN FEL: ${error.code}`)
      allOk = false
      continue
    }

    console.log("  Login: OK")

    // Check app_metadata
    const appMeta = data.user.app_metadata
    const userTypeOk = appMeta.userType === testUser.expectedType
    const adminOk = testUser.expectedAdmin ? appMeta.isAdmin === true : true

    console.log(`  userType: ${appMeta.userType} (${userTypeOk ? "OK" : "FEL"})`)
    console.log(`  isAdmin: ${appMeta.isAdmin} (${adminOk ? "OK" : "FEL"})`)

    // Check JWT claims
    if (data.session?.access_token) {
      const payload = JSON.parse(
        Buffer.from(data.session.access_token.split(".")[1], "base64").toString()
      )
      const jwtMeta = payload.app_metadata
      console.log(`  JWT userType: ${jwtMeta?.userType}`)
      console.log(`  JWT isAdmin: ${jwtMeta?.isAdmin}`)

      // Check providerId in JWT (from custom hook)
      if (jwtMeta?.providerId) {
        console.log(`  JWT providerId: ${jwtMeta.providerId}`)
      } else if (testUser.expectedType === "provider") {
        console.log("  JWT providerId: saknas (custom hook behöver köras)")
      }
    }

    if (!userTypeOk || !adminOk) allOk = false

    // Sign out for next test
    await supabase.auth.signOut()
    console.log()
  }

  if (allOk) {
    console.log("=== ALLA TESTER OK ===")
  } else {
    console.log("=== PROBLEM HITTADE ===")
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(`Script failed: ${e instanceof Error ? e.constructor.name : "unknown"}`)
  process.exit(1)
})
