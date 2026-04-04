/**
 * Seed script for Equinet database (Idempotent)
 *
 * Creates test users in Supabase Auth (with password "test123").
 * The handle_new_user trigger auto-creates public.User rows.
 * Then updates User with additional fields and creates Provider/Service/Availability.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * Run with: npm run db:seed
 * Force re-seed: npm run db:seed:force
 */
import { createClient } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

// Load env files (Next.js priority: .env.local > .env)
config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set them in .env or .env.local."
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_PASSWORD = "test123"

interface SeedUser {
  email: string
  firstName: string
  lastName: string
  userType: "provider" | "customer"
  phone?: string
  isAdmin?: boolean
  address?: string
  city?: string
  latitude?: number
  longitude?: number
}

interface SeedProvider {
  businessName: string
  description: string
  city: string
  address: string
  postalCode: string
  latitude: number
  longitude: number
  serviceAreaKm: number
  isActive: boolean
}

interface SeedService {
  name: string
  description: string
  price: number
  durationMinutes: number
}

/**
 * Create a user in Supabase Auth. The handle_new_user trigger
 * automatically creates the public.User row.
 * Returns the user id (or existing id if already created).
 */
async function createAuthUser(user: SeedUser): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      firstName: user.firstName,
      lastName: user.lastName,
    },
    app_metadata: {
      userType: user.userType,
      isAdmin: user.isAdmin ?? false,
    },
  })

  if (error) {
    if (
      error.code === "email_exists" ||
      error.code === "user_already_exists"
    ) {
      // Idempotent: find existing user
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find((u) => u.email === user.email)
      if (existing) {
        console.log(`  (exists) ${user.email}`)
        return existing.id
      }
    }
    throw new Error(`Failed to create ${user.email}: ${error.message}`)
  }

  return data.user.id
}

/**
 * Wait for the handle_new_user trigger to create the public.User row.
 * Retries a few times since the trigger runs asynchronously.
 */
async function waitForPublicUser(
  userId: string,
  email: string
): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Trigger did not create public.User for ${email} within 2s`)
}

async function main() {
  const forceReseed = process.argv.includes("--force")

  const existingProviders = await prisma.provider.count()

  if (existingProviders > 0 && !forceReseed) {
    console.log(
      `Database already has ${existingProviders} providers. Skipping seed.`
    )
    console.log("Use --force to reseed: npm run db:seed:force")
    return
  }

  if (forceReseed && existingProviders > 0) {
    console.log("Force reseed requested. Clearing existing data...")
    await prisma.routeStop.deleteMany()
    await prisma.routeOrder.deleteMany()
    await prisma.route.deleteMany()
    await prisma.booking.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.availability.deleteMany()
    await prisma.service.deleteMany()
    await prisma.provider.deleteMany()
    await prisma.user.deleteMany()
    console.log("Cleared existing data")
  }

  console.log("Seeding database via Supabase Auth...\n")

  // --- Providers ---
  const providers: {
    user: SeedUser
    provider: SeedProvider
    services: SeedService[]
  }[] = [
    {
      user: {
        email: "erik@hovslagare-uppsala.se",
        firstName: "Erik",
        lastName: "Eriksson",
        userType: "provider",
        phone: "070-123 45 67",
      },
      provider: {
        businessName: "Hovslagare Eriksson",
        description:
          "Erfaren hovslagare med över 20 års erfarenhet. Specialiserad på sportponnyer och dressyrhästar.",
        city: "Uppsala",
        address: "Stallvägen 12",
        postalCode: "75320",
        latitude: 59.8586,
        longitude: 17.6389,
        serviceAreaKm: 50,
        isActive: true,
      },
      services: [
        {
          name: "Skoning",
          description: "Komplett skoning med nya skor",
          price: 1800,
          durationMinutes: 90,
        },
        {
          name: "Verkning",
          description: "Verkning utan skor",
          price: 800,
          durationMinutes: 45,
        },
        {
          name: "Akutbesök",
          description: "Akut hovslagarbesök",
          price: 2500,
          durationMinutes: 60,
        },
      ],
    },
    {
      user: {
        email: "anna@hastvard-goteborg.se",
        firstName: "Anna",
        lastName: "Johansson",
        userType: "provider",
        phone: "073-234 56 78",
      },
      provider: {
        businessName: "Västkustens Hästvård",
        description:
          "Legitimerad veterinär och hästmassör. Erbjuder komplett hästvård från veterinärbesök till avslappnande massage.",
        city: "Göteborg",
        address: "Hästvägen 7",
        postalCode: "41263",
        latitude: 57.7089,
        longitude: 11.9746,
        serviceAreaKm: 40,
        isActive: true,
      },
      services: [
        {
          name: "Hälsokontroll",
          description: "Allmän hälsokontroll med röntgen vid behov",
          price: 900,
          durationMinutes: 30,
        },
        {
          name: "Massage",
          description: "Terapeutisk hästmassage",
          price: 600,
          durationMinutes: 45,
        },
        {
          name: "Tandkontroll",
          description: "Kontroll och filning av tänder",
          price: 1100,
          durationMinutes: 45,
        },
      ],
    },
    {
      user: {
        email: "lars@ridskola-malmo.se",
        firstName: "Lars",
        lastName: "Svensson",
        userType: "provider",
        phone: "076-345 67 89",
      },
      provider: {
        businessName: "Malmö Ridskola",
        description: "Ridskola med lektioner för alla nivåer. Vi erbjuder även rid-rehab.",
        city: "Malmö",
        address: "Ridvägen 15",
        postalCode: "21245",
        latitude: 55.604,
        longitude: 13.0038,
        serviceAreaKm: 35,
        isActive: true,
      },
      services: [
        {
          name: "Ridlektion nybörjare",
          description: "Grupplektion för nybörjare",
          price: 500,
          durationMinutes: 60,
        },
        {
          name: "Privatlektion",
          description: "En-till-en ridlektion",
          price: 900,
          durationMinutes: 60,
        },
      ],
    },
    {
      user: {
        email: "maria@hovservice-alingsas.se",
        firstName: "Maria",
        lastName: "Bergström",
        userType: "provider",
        phone: "070-456 78 90",
      },
      provider: {
        businessName: "Alingsås Hovservice",
        description: "Certifierad hovslagare. Noggrann och pålitlig hovvård.",
        city: "Alingsås",
        address: "Hovvägen 3",
        postalCode: "44130",
        latitude: 57.9305,
        longitude: 12.5329,
        serviceAreaKm: 45,
        isActive: true,
      },
      services: [
        {
          name: "Hovvård utan beslag",
          description: "Verkning och raspning för barbenta hästar",
          price: 700,
          durationMinutes: 45,
        },
        {
          name: "Hovslagning",
          description: "Komplett hovslagning med verkning och skobeslag",
          price: 1200,
          durationMinutes: 60,
        },
        {
          name: "Verkning",
          description: "Verkning och hovvård",
          price: 750,
          durationMinutes: 45,
        },
      ],
    },
    {
      user: {
        email: "karin@test-stall.se",
        firstName: "Karin",
        lastName: "Lindqvist",
        userType: "provider",
        phone: "072-567 89 01",
      },
      provider: {
        businessName: "Test Stall AB",
        description:
          "Komplett hästservice i Stockholm. Hovslagning, ridlektioner och stalluthyrning.",
        city: "Stockholm",
        address: "Kungsgatan 42",
        postalCode: "11135",
        latitude: 59.335,
        longitude: 18.0716,
        serviceAreaKm: 30,
        isActive: true,
      },
      services: [
        {
          name: "Hovslagning",
          description: "Professionell skoning",
          price: 1900,
          durationMinutes: 90,
        },
        {
          name: "Ridlektion",
          description: "Privat ridlektion",
          price: 700,
          durationMinutes: 60,
        },
        {
          name: "Stallhyra",
          description: "Hyra av stallplats per månad",
          price: 5000,
          durationMinutes: 30,
        },
      ],
    },
  ]

  for (const data of providers) {
    console.log(`Creating provider: ${data.provider.businessName}...`)

    // 1. Create in Supabase Auth (trigger creates public.User)
    const userId = await createAuthUser(data.user)
    await waitForPublicUser(userId, data.user.email)

    // 2. Update public.User with fields the trigger doesn't set
    await prisma.user.update({
      where: { id: userId },
      data: {
        userType: data.user.userType,
        phone: data.user.phone,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    // 3. Create Provider
    const provider = await prisma.provider.create({
      data: {
        ...data.provider,
        userId,
      },
    })

    // 4. Create Services
    for (const service of data.services) {
      await prisma.service.create({
        data: {
          ...service,
          providerId: provider.id,
          isActive: true,
        },
      })
    }

    // 5. Create Availability: Mon-Fri 09:00-17:00, Sat-Sun closed
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isClosed = dayOfWeek >= 5
      await prisma.availability.create({
        data: {
          providerId: provider.id,
          dayOfWeek,
          startTime: isClosed ? "00:00" : "09:00",
          endTime: isClosed ? "00:00" : "17:00",
          isClosed,
          isActive: true,
        },
      })
    }

    console.log(`  OK: ${data.provider.businessName} (${data.provider.city})`)
  }

  // --- Customer ---
  console.log("\nCreating customer...")
  const customerId = await createAuthUser({
    email: "kund@test.se",
    firstName: "Test",
    lastName: "Kund",
    userType: "customer",
    phone: "070-111 22 33",
    address: "Stallvägen 5",
    city: "Göteborg",
  })
  await waitForPublicUser(customerId, "kund@test.se")
  await prisma.user.update({
    where: { id: customerId },
    data: {
      phone: "070-111 22 33",
      address: "Stallvägen 5",
      city: "Göteborg",
      latitude: 57.7089,
      longitude: 11.9746,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })
  console.log("  OK: kund@test.se")

  // --- Admin ---
  console.log("\nCreating admin...")
  const adminId = await createAuthUser({
    email: "admin@equinet.se",
    firstName: "Admin",
    lastName: "Adminsson",
    userType: "customer",
    isAdmin: true,
    phone: "070-999 99 99",
  })
  await waitForPublicUser(adminId, "admin@equinet.se")
  await prisma.user.update({
    where: { id: adminId },
    data: {
      phone: "070-999 99 99",
      isAdmin: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })
  console.log("  OK: admin@equinet.se")

  console.log("\nSeeding complete!")
  console.log("Test accounts (password: test123):")
  console.log("- Provider: erik@hovslagare-uppsala.se")
  console.log("- Provider: anna@hastvard-goteborg.se")
  console.log("- Provider: lars@ridskola-malmo.se")
  console.log("- Provider: maria@hovservice-alingsas.se")
  console.log("- Provider: karin@test-stall.se")
  console.log("- Customer: kund@test.se")
  console.log("- Admin:    admin@equinet.se")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("Seeding failed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
