/**
 * Demo seed script — creates a realistic standalone demo provider.
 *
 * Creates "Erik Järnfot" (hovslagare) via Supabase Auth + Prisma.
 * Customers are created directly in the public.User table (no auth account needed).
 *
 * Run:   npx tsx scripts/seed-demo-provider.ts
 * Reset: npx tsx scripts/seed-demo-provider.ts --reset
 *
 * Prerequisites: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { assertStagingSeedSafe } from "../prisma/seed-guard"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PROVIDER_EMAIL = "erik.jarnfot@demo.equinet.se"
const PROVIDER_PASSWORD = "DemoProvider123!"

// Opt-in (--customer-login): make ONE demo customer (Lisa) loginable so the
// horse-owner home (/hem) can be demoed. Demo credential, not a secret.
const LOGIN_CUSTOMER_EMAIL = "lisa.andersson@gmail.com"
const LOGIN_CUSTOMER_PASSWORD = "DemoOwner123!"

// Used only for reset identification — not stored in any visible field
const DEMO_CUSTOMER_EMAILS = [
  "lisa.andersson@gmail.com",
  "anders.bergman@hotmail.com",
  "karin.lindqvist@telia.com",
  "peter.svensson@gmail.com",
  "emma.eriksson@outlook.com",
  "stefan.olsson@live.se",
  "maria.holm@gmail.com",
  "johan.nilsson@yahoo.com",
  "sara.magnusson@icloud.com",
] as const

// Dedicated owner for the demo stable (Stall Solbacken). Holds the Stable.userId
// FK only — has no horses or bookings, and is not part of DEMO_CUSTOMER_EMAILS.
// Created idempotently in main() and removed in resetDemoData().
const STABLE_OWNER_EMAIL = "stall.solbacken@demo.equinet.se"
const DEMO_STABLE_NAME = "Stall Solbacken"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60)
  const newM = total % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

async function waitForPublicUser(userId: string, email: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Trigger did not create public.User for ${email} within 2s`)
}

/**
 * Create a loginable customer via Supabase Auth (same pattern as the provider).
 * Returns the public.User id (the trigger creates it from the auth user).
 *
 * Reset-safe: --reset deletes the demo customer's public.User but not the auth
 * user, so on a repeat run the auth user is orphaned. We detect that (auth
 * exists, public.User gone) and recreate cleanly.
 */
async function createCustomerAuth(
  email: string,
  firstName: string,
  lastName: string,
  password: string
): Promise<string> {
  const create = () =>
    supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { firstName, lastName },
      app_metadata: { userType: "customer", isAdmin: false },
    })

  let { data, error } = await create()

  if (error && (error.code === "email_exists" || error.code === "user_already_exists")) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      // Auth + public.User both present (e.g. no --reset) → reuse.
      await waitForPublicUser(existing.id, email)
      return existing.id
    }
    // Orphaned auth user (public.User reset away) → delete it and recreate.
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const orphan = list?.users?.find((u) => u.email === email)
    if (orphan) await supabase.auth.admin.deleteUser(orphan.id)
    ;({ data, error } = await create())
  }

  if (error || !data?.user) {
    throw new Error(`Failed to create customer auth for ${email}: ${error?.message ?? "unknown"}`)
  }

  await waitForPublicUser(data.user.id, email)
  return data.user.id
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function resetDemoData(providerId: string) {
  console.log("Removing demo data (keeping provider account)...")

  const demoCustomers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: [...DEMO_CUSTOMER_EMAILS] } },
        // Legacy duplicates: an older seed created the same customers under a
        // synthetic "@demo-provider.equinet.se" domain. Clean those up too so
        // every demo customer appears exactly once.
        { email: { endsWith: "@demo-provider.equinet.se" } },
      ],
    },
    select: { id: true },
  })
  const demoCustomerIds = demoCustomers.map((c) => c.id)

  if (demoCustomerIds.length > 0) {
    // Reviews (by booking) — cascade via Prisma delete on bookings below
    // CustomerReviews (by booking) — same
    // Conversations + Messages (cascade from booking)
    const demoBookings = await prisma.booking.findMany({
      where: { customerId: { in: demoCustomerIds }, providerId },
      select: { id: true },
    })
    const bookingIds = demoBookings.map((b) => b.id)

    if (bookingIds.length > 0) {
      await prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } })
      await prisma.customerReview.deleteMany({ where: { bookingId: { in: bookingIds } } })
      // Conversations cascade from bookings (onDelete: Cascade) — no explicit delete needed
      const deleted = await prisma.booking.deleteMany({
        where: { id: { in: bookingIds } },
      })
      console.log(`  Deleted ${deleted.count} bookings`)
    }

    const series = await prisma.bookingSeries.deleteMany({
      where: { customerId: { in: demoCustomerIds }, providerId },
    })
    if (series.count > 0) console.log(`  Deleted ${series.count} booking series`)

    const horses = await prisma.horse.deleteMany({
      where: { ownerId: { in: demoCustomerIds } },
    })
    console.log(`  Deleted ${horses.count} horses`)

    const notes = await prisma.providerCustomerNote.deleteMany({
      where: { providerId, customerId: { in: demoCustomerIds } },
    })
    console.log(`  Deleted ${notes.count} customer notes`)

    const notifications = await prisma.notification.deleteMany({
      where: { userId: { in: demoCustomerIds } },
    })
    console.log(`  Deleted ${notifications.count} notifications`)

    const customers = await prisma.user.deleteMany({
      where: { id: { in: demoCustomerIds } },
    })
    console.log(`  Deleted ${customers.count} customers`)
  } else {
    console.log("  No demo customers found")
  }

  // Delete the demo stable + its dedicated owner (independent of demo customers).
  // Horse.stableId is SetNull, so any link is cleared automatically; no horse is
  // auto-linked to this stable anyway.
  const stablesDeleted = await prisma.stable.deleteMany({ where: { name: DEMO_STABLE_NAME } })
  if (stablesDeleted.count > 0) console.log(`  Deleted ${stablesDeleted.count} demo stable`)
  const stableOwnerDeleted = await prisma.user.deleteMany({ where: { email: STABLE_OWNER_EMAIL } })
  if (stableOwnerDeleted.count > 0) console.log(`  Deleted ${stableOwnerDeleted.count} demo stable owner`)

  // Delete the provider's services LAST — after bookings + series (their FK
  // references) are gone. Without this, renaming a service would create a new
  // row and leave the old name as an orphan on staging. Implicit M2M links to
  // RouteOrder announcements are cleared automatically by Prisma.
  const servicesDeleted = await prisma.service.deleteMany({ where: { providerId } })
  console.log(`  Deleted ${servicesDeleted.count} services`)

  console.log("Reset complete.\n")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isReset = process.argv.includes("--reset")
  const isCheckOnly = process.argv.includes("--check-only")
  // Opt-in: make the demo customer Lisa loginable (default off → behaviour unchanged).
  const customerLogin = process.argv.includes("--customer-login")

  // Guard FIRST — before any DB write or Supabase Admin call.
  // Refuses prod / unknown hosted; refuses localhost when SEED_TARGET=staging.
  assertStagingSeedSafe({
    databaseUrl: process.env.DATABASE_URL ?? "",
    supabaseUrl: SUPABASE_URL,
    requireStaging: process.env.SEED_TARGET === "staging",
  })

  if (isCheckOnly) {
    console.log("Guard OK — target verifierat. (--check-only: ingen seed körd.)")
    return
  }

  // -------------------------------------------------------------------------
  // 1. Provider via Supabase Auth
  // -------------------------------------------------------------------------

  let providerUserId: string

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: PROVIDER_EMAIL,
    password: PROVIDER_PASSWORD,
    email_confirm: true,
    user_metadata: { firstName: "Erik", lastName: "Järnfot" },
    app_metadata: { userType: "provider", isAdmin: false },
  })

  if (authError) {
    if (
      authError.code === "email_exists" ||
      authError.code === "user_already_exists"
    ) {
      // Auth user exists → trigger already created public.User, look up by email
      const existingPublicUser = await prisma.user.findUnique({ where: { email: PROVIDER_EMAIL } })
      if (!existingPublicUser) throw new Error("Provider public.User not found after email_exists error")
      providerUserId = existingPublicUser.id
      console.log(`Provider auth exists: ${PROVIDER_EMAIL}`)
    } else {
      throw new Error(`Failed to create provider: ${authError.message}`)
    }
  } else {
    providerUserId = authData.user.id
    console.log(`Created provider auth: ${PROVIDER_EMAIL}`)
  }

  await waitForPublicUser(providerUserId, PROVIDER_EMAIL)

  await prisma.user.update({
    where: { id: providerUserId },
    data: {
      userType: "provider",
      firstName: "Erik",
      lastName: "Järnfot",
      phone: "070-234 56 78",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  // -------------------------------------------------------------------------
  // 2. Provider profile (upsert by userId)
  // -------------------------------------------------------------------------

  let provider = await prisma.provider.findUnique({ where: { userId: providerUserId } })

  if (!provider) {
    provider = await prisma.provider.create({
      data: {
        userId: providerUserId,
        businessName: "Järnfots Hovslageri",
        description:
          "Certifierad hovslagare med 15 års erfarenhet i Örebro med omnejd. " +
          "Arbetar med alla typer av hästar — ridsporthästar, islandshästar, ponnier och kallblod. " +
          "Erbjuder helskoning, skoning fram, verkning för barfotagång, tappsko " +
          "och akuta hovslagarbesök inom 50 km från Örebro.",
        address: "Stallvägen 4",
        city: "Örebro",
        postalCode: "701 47",
        latitude: 59.2753,
        longitude: 15.2134,
        serviceAreaKm: 50,
        isActive: true,
        acceptingNewCustomers: true,
        isVerified: true,
        verifiedAt: new Date("2025-06-15"),
      },
    })
    console.log(`Created provider: ${provider.businessName}`)
  } else {
    await prisma.provider.update({
      where: { id: provider.id },
      data: {
        businessName: "Järnfots Hovslageri",
        description:
          "Certifierad hovslagare med 15 års erfarenhet i Örebro med omnejd. " +
          "Arbetar med alla typer av hästar — ridsporthästar, islandshästar, ponnier och kallblod. " +
          "Erbjuder helskoning, skoning fram, verkning för barfotagång, tappsko " +
          "och akuta hovslagarbesök inom 50 km från Örebro.",
        address: "Stallvägen 4",
        city: "Örebro",
        postalCode: "701 47",
        latitude: 59.2753,
        longitude: 15.2134,
        serviceAreaKm: 50,
        isActive: true,
        acceptingNewCustomers: true,
        isVerified: true,
        verifiedAt: new Date("2025-06-15"),
      },
    })
    console.log(`Updated provider: ${provider.businessName}`)
  }

  if (isReset) {
    await resetDemoData(provider.id)
  }

  console.log("\nSeeding demo data...\n")

  // -------------------------------------------------------------------------
  // 3. Availability (Mon–Fri 07–16, Sat–Sun stängt)
  // -------------------------------------------------------------------------

  const existingAvail = await prisma.availability.count({ where: { providerId: provider.id } })
  if (existingAvail === 0) {
    for (let day = 0; day <= 6; day++) {
      const isClosed = day >= 5
      await prisma.availability.create({
        data: {
          providerId: provider.id,
          dayOfWeek: day,
          startTime: isClosed ? "00:00" : "07:00",
          endTime: isClosed ? "00:00" : "16:00",
          isClosed,
          isActive: true,
        },
      })
    }
    console.log("Created availability: Mån–Fre 07:00–16:00\n")
  }

  // -------------------------------------------------------------------------
  // 4. Services (5 st)
  // -------------------------------------------------------------------------

  const serviceData = [
    {
      name: "Helskoning",
      description: "Skoning av alla fyra hovar, inklusive verkning",
      price: 1450,
      durationMinutes: 75,
      recommendedIntervalWeeks: 8,
    },
    {
      name: "Skoning fram",
      description: "Skoning av framhovarna, inklusive verkning",
      price: 1000,
      durationMinutes: 60,
      recommendedIntervalWeeks: 8,
    },
    {
      name: "Verkning",
      description: "Verkning och raspning för barfotagång",
      price: 700,
      durationMinutes: 45,
      recommendedIntervalWeeks: 6,
    },
    {
      name: "Verkning unghäst",
      description: "Verkning av unghästar och föl under uppväxt",
      price: 600,
      durationMinutes: 40,
      recommendedIntervalWeeks: 6,
    },
    {
      name: "Tappsko",
      description: "Återsättning av avtrampad eller tappad sko",
      price: 400,
      durationMinutes: 30,
      recommendedIntervalWeeks: null,
    },
    {
      name: "Akut hovslagarbesök",
      description: "Akut bedömning och åtgärd vid hovskada eller hälta",
      price: 1200,
      durationMinutes: 60,
      recommendedIntervalWeeks: null,
    },
    {
      name: "Hovstatuskontroll",
      description: "Genomgång av hovstatus med rekommendation och åtgärdsförslag",
      price: 600,
      durationMinutes: 30,
      recommendedIntervalWeeks: null,
    },
  ]

  const services: Record<string, string> = {}
  for (const s of serviceData) {
    const existing = await prisma.service.findFirst({
      where: { providerId: provider.id, name: s.name },
    })
    if (existing) {
      services[s.name] = existing.id
      console.log(`  Tjänst finns: ${s.name}`)
    } else {
      const created = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: s.name,
          description: s.description,
          price: s.price,
          durationMinutes: s.durationMinutes,
          recommendedIntervalWeeks: s.recommendedIntervalWeeks ?? null,
          isActive: true,
        },
      })
      services[s.name] = created.id
      console.log(`  Skapade tjänst: ${s.name} (${s.price} kr, ${s.durationMinutes} min)`)
    }
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 5. Customers (9 st)
  // -------------------------------------------------------------------------

  // Street address + coordinates are real-ish points in/around Örebro (within
  // Erik's 50 km service area). Needed so "Dagens rutt" can plot stops on the
  // map and compute real driving distance. Anders's address matches the demo
  // conversation. (User has no postalCode column — street + city only.)
  //
  // NOTE (demo proxy): the customer's home coordinates stand in for the *visit
  // location* here. That is a temporary demo simplification — the correct model
  // is a stable/visit address linked to the horse or booking. See the future
  // Stall-epic/discovery; this slice intentionally does NOT change product logic.
  const customerData = [
    { email: "lisa.andersson@gmail.com",      firstName: "Lisa",   lastName: "Andersson", phone: "0703-112 233", city: "Örebro",    address: "Hagvägen 8",        latitude: 59.2820, longitude: 15.1950 },
    { email: "anders.bergman@hotmail.com",    firstName: "Anders", lastName: "Bergman",   phone: "0721-445 566", city: "Västerås",  address: "Ekebyvägen 12",     latitude: 59.6161, longitude: 16.5274 },
    { email: "karin.lindqvist@telia.com",     firstName: "Karin",  lastName: "Lindqvist", phone: "0768-778 899", city: "Arboga",    address: "Kungsörsvägen 5",   latitude: 59.3930, longitude: 15.8420 },
    { email: "peter.svensson@gmail.com",      firstName: "Peter",  lastName: "Svensson",  phone: "0706-334 455", city: "Kumla",     address: "Skolgatan 14",      latitude: 59.1290, longitude: 15.1390 },
    { email: "emma.eriksson@outlook.com",     firstName: "Emma",   lastName: "Eriksson",  phone: "0735-667 788", city: "Örebro",    address: "Almbyvägen 22",     latitude: 59.2660, longitude: 15.2400 },
    { email: "stefan.olsson@live.se",         firstName: "Stefan", lastName: "Olsson",    phone: "0702-990 011", city: "Kungsör",   address: "Drottninggatan 7",  latitude: 59.4250, longitude: 16.0760 },
    { email: "maria.holm@gmail.com",          firstName: "Maria",  lastName: "Holm",      phone: "0739-223 344", city: "Örebro",    address: "Björkvägen 3",      latitude: 59.2960, longitude: 15.2300 },
    { email: "johan.nilsson@yahoo.com",       firstName: "Johan",  lastName: "Nilsson",   phone: "0704-556 677", city: "Hallsberg", address: "Stationsgatan 9",   latitude: 59.0650, longitude: 15.1110 },
    { email: "sara.magnusson@icloud.com",     firstName: "Sara",   lastName: "Magnusson", phone: "0761-889 900", city: "Örebro",    address: "Ringgatan 18",      latitude: 59.2700, longitude: 15.1850 },
  ]

  const customers: Record<string, string> = {}
  for (const c of customerData) {
    let userId: string
    if (customerLogin && c.email === LOGIN_CUSTOMER_EMAIL) {
      // Loginable demo customer (auth-backed, same pattern as the provider).
      userId = await createCustomerAuth(c.email, c.firstName, c.lastName, LOGIN_CUSTOMER_PASSWORD)
      await prisma.user.update({
        where: { id: userId },
        data: {
          userType: "customer",
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          city: c.city,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
      console.log(`  Kund (inloggningsbar): ${c.firstName} ${c.lastName} (${c.city})`)
    } else {
      // Default: ghost customer (no login) — unchanged behaviour.
      const user = await prisma.user.upsert({
        where: { email: c.email },
        // Keep coordinates fresh even on a re-run without --reset (idempotent).
        update: {
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
        },
        create: {
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          userType: "customer",
          city: c.city,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
      userId = user.id
      console.log(`  Kund: ${c.firstName} ${c.lastName} (${c.city})`)
    }
    customers[`${c.firstName} ${c.lastName}`] = userId
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 6. Horses (~14 st)
  // -------------------------------------------------------------------------

  const horseData = [
    // Lisa Andersson — 2 hästar
    { owner: "Lisa Andersson", name: "Molly", breed: "Welsh ponny", birthYear: 2017, color: "Brun", gender: "mare" as const, specialNeeds: null },
    { owner: "Lisa Andersson", name: "Storm", breed: "Svenskt varmblod", birthYear: 2014, color: "Svart", gender: "gelding" as const, specialNeeds: "Öm på höger framhov — extra uppmärksamhet vid verkning" },
    // Anders Bergman — 1 häst
    { owner: "Anders Bergman", name: "Dante", breed: "Hanoveraner", birthYear: 2015, color: "Brun", gender: "gelding" as const, specialNeeds: null },
    // Karin Lindqvist — 2 hästar
    { owner: "Karin Lindqvist", name: "Bella", breed: "Gotlandsruss", birthYear: 2019, color: "Fux", gender: "mare" as const, specialNeeds: "Känslig i vänster bakben" },
    { owner: "Karin Lindqvist", name: "Silver", breed: "Islandshäst", birthYear: 2012, color: "Skimmel", gender: "stallion" as const, specialNeeds: null },
    // Peter Svensson — 1 häst
    { owner: "Peter Svensson", name: "Midnight", breed: "Araber", birthYear: 2016, color: "Svart", gender: "gelding" as const, specialNeeds: "Skygg för ljud — ta det lugnt vid hovvård" },
    // Emma Eriksson — 2 hästar
    { owner: "Emma Eriksson", name: "Samba", breed: "Lusitano", birthYear: 2013, color: "Grå", gender: "stallion" as const, specialNeeds: null },
    { owner: "Emma Eriksson", name: "Luna", breed: "Fjordhäst", birthYear: 2018, color: "Gulbrun", gender: "mare" as const, specialNeeds: null },
    // Stefan Olsson — 1 häst
    { owner: "Stefan Olsson", name: "Flash", breed: "Friesian", birthYear: 2017, color: "Svart", gender: "gelding" as const, specialNeeds: "Svår att hålla still vid bakhovarna" },
    // Maria Holm — 2 hästar
    { owner: "Maria Holm", name: "Prince", breed: "Oldenburger", birthYear: 2011, color: "Brun", gender: "gelding" as const, specialNeeds: null },
    { owner: "Maria Holm", name: "Nova", breed: "Islandshäst", birthYear: 2020, color: "Fux", gender: "mare" as const, specialNeeds: null },
    // Johan Nilsson — 1 häst
    { owner: "Johan Nilsson", name: "Tornado", breed: "Trakehner", birthYear: 2016, color: "Mörkbrun", gender: "gelding" as const, specialNeeds: null },
    // Sara Magnusson — 2 hästar
    { owner: "Sara Magnusson", name: "Stella", breed: "Shetlandsponny", birthYear: 2015, color: "Brun", gender: "mare" as const, specialNeeds: null },
    { owner: "Sara Magnusson", name: "Blixten", breed: "Nordsvensk kallblod", birthYear: 2013, color: "Brun", gender: "gelding" as const, specialNeeds: null },
  ]

  const horses: Record<string, string> = {}
  for (const h of horseData) {
    const ownerId = customers[h.owner]
    if (!ownerId) {
      console.log(`  Skippad häst: ${h.name} (ägare ${h.owner} saknas)`)
      continue
    }
    const existing = await prisma.horse.findFirst({ where: { ownerId, name: h.name } })
    if (existing) {
      horses[`${h.owner}/${h.name}`] = existing.id
      console.log(`  Häst finns: ${h.name} (${h.owner})`)
    } else {
      const created = await prisma.horse.create({
        data: {
          ownerId,
          name: h.name,
          breed: h.breed,
          birthYear: h.birthYear,
          color: h.color,
          gender: h.gender,
          specialNeeds: h.specialNeeds,
          isActive: true,
        },
      })
      horses[`${h.owner}/${h.name}`] = created.id
      console.log(`  Skapade häst: ${h.name} (${h.breed}, ${h.color})`)
    }
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 6b. Demo stable (Stall Solbacken)
  //     Base demo data for the horse→stable feature (always-on, no flag).
  //     A dedicated owner User holds the Stable.userId FK; no horse is auto-
  //     linked — the demo customer (Lisa) picks the stable via the UI. The
  //     full stable-owner flow stays gated by stable_profiles (off).
  // -------------------------------------------------------------------------

  const stableOwner = await prisma.user.upsert({
    where: { email: STABLE_OWNER_EMAIL },
    update: {},
    create: {
      email: STABLE_OWNER_EMAIL,
      firstName: "Stall",
      lastName: "Solbacken",
      userType: "customer",
      city: "Alingsås",
      municipality: "Alingsås",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  const existingStable = await prisma.stable.findFirst({ where: { name: DEMO_STABLE_NAME } })
  if (existingStable) {
    console.log(`  Stall finns: ${DEMO_STABLE_NAME}`)
  } else {
    await prisma.stable.create({
      data: {
        userId: stableOwner.id,
        name: DEMO_STABLE_NAME,
        description: "Demostall i Alingsås (DEMO-SEED)",
        city: "Alingsås",
        municipality: "Alingsås",
        isActive: true,
      },
    })
    console.log(`  Skapade stall: ${DEMO_STABLE_NAME} (Alingsås)`)
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 7. Bookings (18 st)
  // -------------------------------------------------------------------------

  const demoCustomerIds = Object.values(customers)
  const existingBookingCount =
    demoCustomerIds.length > 0
      ? await prisma.booking.count({ where: { customerId: { in: demoCustomerIds }, providerId: provider.id } })
      : 0

  const createdBookings: Array<{ id: string; customer: string; service: string; status: string }> = []

  if (existingBookingCount > 0) {
    console.log(`${existingBookingCount} bokningar finns redan — hoppar över. Kör med --reset för att återskapa.\n`)

    const existing = await prisma.booking.findMany({
      where: { customerId: { in: demoCustomerIds }, status: "completed", providerId: provider.id },
      select: { id: true, customerId: true, serviceId: true, status: true },
    })
    for (const b of existing) {
      const customerName = Object.entries(customers).find(([, id]) => id === b.customerId)?.[0] ?? ""
      const serviceName = Object.entries(services).find(([, id]) => id === b.serviceId)?.[0] ?? ""
      createdBookings.push({ id: b.id, customer: customerName, service: serviceName, status: b.status })
    }
  } else {
    const bookingSpecs = [
      // --- "Dagens rutt"-demodag: dag 2 har 3 stopp på olika adresser så
      //     /provider/today visar en trovärdig kördag med karta + körsträcka.
      //     Lisa (Örebro 08:00) → Peter (Kumla 10:30) → Johan (Hallsberg 13:00).
      {
        customer: "Lisa Andersson", service: "Helskoning", horseKey: "Lisa Andersson/Molly",
        date: daysFromNow(2), startTime: "08:00", status: "confirmed",
        customerNotes: "Molly är lite öm i hovarna på grusunderlag, annars frisk",
      },
      {
        customer: "Anders Bergman", service: "Helskoning", horseKey: "Anders Bergman/Dante",
        date: daysFromNow(3), startTime: "10:30", status: "confirmed",
      },
      {
        customer: "Peter Svensson", service: "Verkning", horseKey: "Peter Svensson/Midnight",
        date: daysFromNow(2), startTime: "10:30", status: "confirmed",
      },
      {
        customer: "Maria Holm", service: "Skoning fram", horseKey: "Maria Holm/Prince",
        date: daysFromNow(7), startTime: "09:00", status: "confirmed",
        providerNotes: "Prince står bra. Förra gången ny sko på vänster fram — bakhovarna barfota.",
      },
      {
        customer: "Emma Eriksson", service: "Akut hovslagarbesök", horseKey: "Emma Eriksson/Samba",
        date: daysFromNow(10), startTime: "14:00", status: "confirmed",
        customerNotes: "Samba verkar halta lite på höger fram sedan igår",
      },
      // --- Pending ---
      {
        customer: "Karin Lindqvist", service: "Tappsko", horseKey: "Karin Lindqvist/Bella",
        date: daysFromNow(4), startTime: "11:00", status: "pending",
        customerNotes: "Bella tappade en sko på vänster bak i hagen igår. Lite känslig i bakbenet, var försiktig.",
      },
      {
        customer: "Sara Magnusson", service: "Helskoning", horseKey: "Sara Magnusson/Stella",
        date: daysFromNow(8), startTime: "15:00", status: "pending",
      },
      // --- Genomförda (8 st) ---
      {
        customer: "Lisa Andersson", service: "Helskoning", horseKey: "Lisa Andersson/Storm",
        date: daysFromNow(-56), startTime: "09:00", status: "completed",
        providerNotes: "Skodd enligt plan. Höger fram något ojämn — korrigerad, fin balans nu. Återkontroll om 8 veckor.",
      },
      {
        customer: "Anders Bergman", service: "Verkning", horseKey: "Anders Bergman/Dante",
        date: daysFromNow(-42), startTime: "10:00", status: "completed",
      },
      {
        customer: "Peter Svensson", service: "Helskoning", horseKey: "Peter Svensson/Midnight",
        date: daysFromNow(-70), startTime: "08:00", status: "completed",
      },
      {
        customer: "Karin Lindqvist", service: "Helskoning", horseKey: "Karin Lindqvist/Silver",
        date: daysFromNow(-49), startTime: "09:00", status: "completed",
      },
      {
        customer: "Emma Eriksson", service: "Verkning", horseKey: "Emma Eriksson/Luna",
        date: daysFromNow(-56), startTime: "13:00", status: "completed",
      },
      {
        customer: "Stefan Olsson", service: "Helskoning", horseKey: "Stefan Olsson/Flash",
        date: daysFromNow(-35), startTime: "11:00", status: "completed",
        providerNotes: "Flash svårhanterad vid bakhovarna. Böjde i knä vid tag. Ta extra tid nästa gång.",
      },
      {
        customer: "Johan Nilsson", service: "Hovstatuskontroll", horseKey: "Johan Nilsson/Tornado",
        date: daysFromNow(-28), startTime: "14:00", status: "completed",
      },
      {
        customer: "Maria Holm", service: "Verkning unghäst", horseKey: "Maria Holm/Nova",
        date: daysFromNow(-42), startTime: "10:00", status: "completed",
        providerNotes: "Verkad enligt plan. Fin balans och bra hovkvalitet för ung häst.",
      },
      // --- Avbokade ---
      {
        customer: "Sara Magnusson", service: "Helskoning", horseKey: "Sara Magnusson/Blixten",
        date: daysFromNow(-14), startTime: "08:00", status: "cancelled",
        cancellationMessage: "Hästen hade feber, fick inte rida. Ber om ursäkt för sena beskedet.",
      },
      {
        customer: "Karin Lindqvist", service: "Verkning", horseKey: "Karin Lindqvist/Bella",
        date: daysFromNow(-7), startTime: "12:00", status: "cancelled",
        cancellationMessage: "Tidsbrist pga jobbet. Bokar om nästa vecka.",
      },
      // --- Manuell bokning (skapad av leverantören) ---
      // Tredje stoppet på "Dagens rutt"-demodagen (dag 2, Hallsberg).
      {
        customer: "Johan Nilsson", service: "Helskoning", horseKey: "Johan Nilsson/Tornado",
        date: daysFromNow(2), startTime: "13:00", status: "confirmed",
        isManualBooking: true,
      },
    ]

    for (const b of bookingSpecs) {
      const customerId = customers[b.customer]
      const serviceId = services[b.service]
      if (!customerId || !serviceId) {
        console.log(`  Skippad: ${b.customer} / ${b.service} (referens saknas)`)
        continue
      }

      const svcDef = serviceData.find((s) => s.name === b.service)
      const endTime = addMinutes(b.startTime, svcDef?.durationMinutes ?? 60)
      const horseId = b.horseKey ? (horses[b.horseKey] ?? null) : null
      const horseName = b.horseKey ? b.horseKey.split("/")[1] : null

      try {
        const created = await prisma.booking.create({
          data: {
            customerId,
            providerId: provider.id,
            serviceId,
            bookingDate: b.date,
            startTime: b.startTime,
            endTime,
            status: b.status,
            horseName,
            horseId,
            customerNotes: b.customerNotes ?? null,
            providerNotes: b.providerNotes ?? null,
            cancellationMessage: b.cancellationMessage ?? null,
            isManualBooking: b.isManualBooking ?? false,
            createdByProviderId: b.isManualBooking ? provider.id : null,
          },
        })
        createdBookings.push({ id: created.id, customer: b.customer, service: b.service, status: b.status })

        const label: Record<string, string> = {
          confirmed: "bekräftad",
          pending: "väntande",
          completed: "genomförd",
          cancelled: "avbokad",
        }
        const horseLabel = horseName ? ` (${horseName})` : ""
        const manualLabel = b.isManualBooking ? " [manuell]" : ""
        console.log(`  Bokning: ${b.service} - ${b.customer}${horseLabel} (${label[b.status] ?? b.status}${manualLabel})`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("unique_booking_slot")) {
          console.log(`  Hoppar: ${b.service} - ${b.customer} (tidsluckan ${b.date.toISOString().slice(0, 10)} ${b.startTime} finns redan)`)
        } else {
          throw err
        }
      }
    }
    console.log("")
  }

  // -------------------------------------------------------------------------
  // 8. Reviews (7 st, för genomförda bokningar)
  // -------------------------------------------------------------------------

  const reviewSpecs = [
    { customer: "Lisa Andersson", service: "Helskoning", rating: 5, comment: "Erik är otroligt duktig och noggrann. Storm stod lugnt hela tiden – och det säger en del!" },
    { customer: "Anders Bergman", service: "Verkning", rating: 4, comment: "Bra utfört arbete, lite försenat men Erik förklarade anledningen direkt. Inget problem." },
    { customer: "Peter Svensson", service: "Helskoning", rating: 5, comment: "Toppenservice! Midnight är alltid lite nervös för nya människor men Erik hanterade det suveränt." },
    { customer: "Karin Lindqvist", service: "Helskoning", rating: 4, comment: "Kompetent och trevlig. Bra pris för kvaliteten och Silver verkade nöjd med resultatet." },
    { customer: "Emma Eriksson", service: "Verkning", rating: 5, comment: "Snabbt och professionellt. Erik gav dessutom bra tips om daglig hovvård som jag inte visste." },
    { customer: "Stefan Olsson", service: "Helskoning", rating: 3, comment: "Okej besök men Flash fick ett litet nick vid ballen bak. Hoppas det var en engångshändelse." },
    { customer: "Johan Nilsson", service: "Hovstatuskontroll", rating: 5, comment: "Mycket grundlig bedömning med tydlig skriftlig rapport. Värt varje krona." },
  ]

  const completedBookings = createdBookings.filter((b) => b.status === "completed")
  let reviewCount = 0

  for (const r of reviewSpecs) {
    const booking = completedBookings.find(
      (b) => b.customer === r.customer && b.service === r.service
    )
    if (!booking) {
      console.log(`  Hoppar recension: ${r.customer} / ${r.service} (ingen matchande bokning)`)
      continue
    }
    const existing = await prisma.review.findUnique({ where: { bookingId: booking.id } })
    if (existing) {
      console.log(`  Recension finns: ${r.customer} (${r.rating} ★)`)
      continue
    }
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        providerId: provider.id,
        customerId: customers[r.customer],
        rating: r.rating,
        comment: r.comment,
      },
    })
    reviewCount++
    console.log(`  Recension: ${r.customer} — ${r.rating} ★`)
  }
  if (reviewCount > 0 || completedBookings.length > 0) console.log("")

  // -------------------------------------------------------------------------
  // 9. Customer notes (leverantörens journalanteckningar)
  // -------------------------------------------------------------------------

  const noteSpecs = [
    {
      customer: "Lisa Andersson",
      content: "Betalas alltid i tid. Föredrar bokningar tidigt på morgonen. Storm är känslig vid höger framhov, se upp.",
    },
    {
      customer: "Peter Svensson",
      content: "Veteran-ryttare med höga krav på hovvård — det är positivt. Midnight kan vara skygg för ljud ovanför rygghöjd.",
    },
    {
      customer: "Stefan Olsson",
      content: "Flash är ny häst för Stefan (2 år ihop). Svår att hålla still vid bakhovarna. Ta minst 15 extra minuter.",
    },
    {
      customer: "Emma Eriksson",
      content: "Föredrar SMS-påminnelse 2 dagar i förväg. Samba och Luna sköts exemplariskt — bra hovhälsa.",
    },
  ]

  for (const n of noteSpecs) {
    const customerId = customers[n.customer]
    if (!customerId) continue
    const existing = await prisma.providerCustomerNote.findFirst({
      where: { providerId: provider.id, customerId, content: n.content },
    })
    if (!existing) {
      await prisma.providerCustomerNote.create({
        data: { providerId: provider.id, customerId, content: n.content },
      })
      console.log(`  Anteckning: ${n.customer}`)
    } else {
      console.log(`  Anteckning finns: ${n.customer}`)
    }
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 10. BookingSeries (återkommande bokning — Lisa Andersson / Molly / Helskoning)
  // -------------------------------------------------------------------------

  const lisaId = customers["Lisa Andersson"]
  const mollyId = horses["Lisa Andersson/Molly"]
  const helskoningId = services["Helskoning"]

  let bookingSeriesId: string | null = null

  if (lisaId && helskoningId) {
    const existingSeries = await prisma.bookingSeries.findFirst({
      where: { customerId: lisaId, providerId: provider.id, serviceId: helskoningId },
    })

    if (existingSeries) {
      bookingSeriesId = existingSeries.id
      console.log("  Bokningsserie finns: Helskoning Molly (Lisa Andersson)")
    } else {
      const series = await prisma.bookingSeries.create({
        data: {
          customerId: lisaId,
          providerId: provider.id,
          serviceId: helskoningId,
          horseId: mollyId ?? null,
          intervalWeeks: 8,
          totalOccurrences: 6,
          createdCount: 3,
          startTime: "08:00",
          status: "active",
        },
      })
      bookingSeriesId = series.id
      console.log("  Skapade bokningsserie: Helskoning Molly (Lisa Andersson)")
    }

    // 2 genomförda bokningar i serien (8 och 16 veckor bakåt)
    for (const daysBack of [-112, -56]) {
      const seriesDate = daysFromNow(daysBack)
      // Check the provider-level slot (matches the unique constraint)
      const existing = await prisma.booking.findFirst({
        where: {
          providerId: provider.id,
          bookingDate: seriesDate,
          startTime: "08:00",
          endTime: "09:15",
        },
      })
      if (!existing) {
        try {
          await prisma.booking.create({
            data: {
              customerId: lisaId,
              providerId: provider.id,
              serviceId: helskoningId,
              bookingDate: seriesDate,
              startTime: "08:00",
              endTime: "09:15",
              status: "completed",
              horseName: "Molly",
              horseId: mollyId ?? null,
              bookingSeriesId,
            },
          })
          console.log(`  Serie-bokning (genomförd): Molly ${seriesDate.toISOString().slice(0, 10)}`)
        } catch (err: unknown) {
          if ((err as { code?: string }).code === "P2002") {
            console.log(`  Serie-bokning hoppades över (slottkonflikt): ${seriesDate.toISOString().slice(0, 10)}`)
          } else {
            throw err
          }
        }
      } else {
        if (!existing.bookingSeriesId && existing.customerId === lisaId) {
          await prisma.booking.update({ where: { id: existing.id }, data: { bookingSeriesId } })
        }
        console.log(`  Serie-bokning finns: Molly ${seriesDate.toISOString().slice(0, 10)}`)
      }
    }

    // Länka den kommande bekräftade Molly-bokningen till serien
    const upcomingMolly = await prisma.booking.findFirst({
      where: {
        customerId: lisaId,
        providerId: provider.id,
        serviceId: helskoningId,
        horseId: mollyId ?? undefined,
        status: "confirmed",
      },
    })
    if (upcomingMolly && !upcomingMolly.bookingSeriesId) {
      await prisma.booking.update({
        where: { id: upcomingMolly.id },
        data: { bookingSeriesId },
      })
      console.log("  Länkade kommande Molly-bokning till serien")
    }
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 11. Konversation + meddelanden (Anders Bergman / Dante / Helskoning)
  //     Visar Smart Reply-chips — sista meddelandet är från kunden, oläst.
  // -------------------------------------------------------------------------

  const andersId = customers["Anders Bergman"]

  if (andersId && helskoningId) {
    const andersBooking = await prisma.booking.findFirst({
      where: {
        customerId: andersId,
        providerId: provider.id,
        serviceId: helskoningId,
        status: "confirmed",
      },
      orderBy: { bookingDate: "asc" },
    })

    if (!andersBooking) {
      console.log("  Hoppar konversation: bekräftad bokning Anders Bergman/Helskoning saknas")
    } else {
      const existingConv = await prisma.conversation.findUnique({
        where: { bookingId: andersBooking.id },
      })

      if (existingConv) {
        console.log("  Konversation finns: Anders Bergman/Dante")
      } else {
        const t1 = new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 dagar sedan
        const t2 = new Date(Date.now() - 47 * 60 * 60 * 1000) // 2 dagar sedan + 1h
        const t3 = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 dag sedan (oläst)

        await prisma.conversation.create({
          data: {
            bookingId: andersBooking.id,
            lastMessageAt: t3,
            messages: {
              create: [
                {
                  senderType: "CUSTOMER",
                  senderId: andersId,
                  content: "Hej Erik! Bara kolla att du har rätt adress — vi håller till på Ekebyvägen 12 i Västerås. Dante är redo.",
                  createdAt: t1,
                  readAt: t2,
                },
                {
                  senderType: "PROVIDER",
                  senderId: providerUserId,
                  content: "Hej Anders! Ja, jag har Ekebyvägen 12. Räkna med mig kl 10:30 som planerat.",
                  createdAt: t2,
                  readAt: t2,
                },
                {
                  senderType: "CUSTOMER",
                  senderId: andersId,
                  content: "Super, tack! En sak — Dante kan vara lite svårhanterad med bakhovarna, ta det lugnt med honom.",
                  createdAt: t3,
                  readAt: null,
                },
              ],
            },
          },
        })
        console.log("  Skapade konversation: Anders Bergman/Dante (Smart Reply-demo)")
      }
    }
  }
  console.log("")

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  console.log("--- Demo-seed klar ---")
  console.log(`\nLeverantör : ${PROVIDER_EMAIL}`)
  console.log(`Lösenord   : ${PROVIDER_PASSWORD}`)
  console.log(`Företag    : Järnfots Hovslageri`)
  console.log(`Tjänster   : ${Object.keys(services).length}`)
  console.log(`Kunder     : ${Object.keys(customers).length}`)
  console.log(`Hästar     : ${Object.keys(horses).length}`)
  console.log(`Bokningar  : ${createdBookings.length} (+ eventuellt befintliga om --reset ej kördes)`)
  console.log(`Serie      : ${bookingSeriesId ? "Helskoning Molly — aktiv (6 tillfällen)" : "Ej skapad"}`)
  console.log("\nDemo-walkthrough: Se docs/operations/demo-setup.md")
}

main()
  .catch((e) => {
    console.error("Seed misslyckades:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
