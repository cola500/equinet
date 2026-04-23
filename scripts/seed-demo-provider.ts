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

const DEMO_TAG = "E2E-spec:demo-provider"
const PROVIDER_EMAIL = "erik.jarnfot@demo.equinet.se"
const PROVIDER_PASSWORD = "DemoProvider123!"
const CUSTOMER_EMAIL_SUFFIX = "@demo-provider.equinet.se"

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

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function resetDemoData(providerId: string) {
  console.log("Removing demo data (keeping provider account)...")

  const demoCustomers = await prisma.user.findMany({
    where: { email: { endsWith: CUSTOMER_EMAIL_SUFFIX } },
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
      const deleted = await prisma.booking.deleteMany({
        where: { id: { in: bookingIds } },
      })
      console.log(`  Deleted ${deleted.count} bookings`)
    }

    const horses = await prisma.horse.deleteMany({
      where: { specialNeeds: { contains: DEMO_TAG } },
    })
    console.log(`  Deleted ${horses.count} horses`)

    const notes = await prisma.providerCustomerNote.deleteMany({
      where: { providerId, customerId: { in: demoCustomerIds } },
    })
    console.log(`  Deleted ${notes.count} customer notes`)

    const customers = await prisma.user.deleteMany({
      where: { email: { endsWith: CUSTOMER_EMAIL_SUFFIX } },
    })
    console.log(`  Deleted ${customers.count} customers`)
  } else {
    console.log("  No demo customers found")
  }

  console.log("Reset complete.\n")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isReset = process.argv.includes("--reset")

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
          "Certifierad hovslagare med 15 års erfarenhet i Örebro-trakten. " +
          "Specialiserad på sporthästar, islandshästar och ponnier. " +
          "Erbjuder omskoning, verkning, akutbesök och hovbedömningar " +
          "inom 50 km från Örebro.",
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
          "Certifierad hovslagare med 15 års erfarenhet i Örebro-trakten. " +
          "Specialiserad på sporthästar, islandshästar och ponnier. " +
          "Erbjuder omskoning, verkning, akutbesök och hovbedömningar " +
          "inom 50 km från Örebro.",
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
      name: "Omskoning",
      description: "Komplett omskoning med verkning och nytt skobeslag",
      price: 1400,
      durationMinutes: 75,
      recommendedIntervalWeeks: 8,
    },
    {
      name: "Verkning (barfota)",
      description: "Verkning och raspning för hästar utan järnskor",
      price: 750,
      durationMinutes: 45,
      recommendedIntervalWeeks: 6,
    },
    {
      name: "Akutbesök",
      description: "Akut hovslagarbesök vid skada eller hovproblem",
      price: 2500,
      durationMinutes: 60,
      recommendedIntervalWeeks: null,
    },
    {
      name: "Ungdomsverkning",
      description: "Verkning av unga hästar och föl i uppväxt",
      price: 600,
      durationMinutes: 40,
      recommendedIntervalWeeks: 6,
    },
    {
      name: "Hovslagarbedömning",
      description: "Grundlig hovbedömning med skriftlig rapport",
      price: 800,
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

  const customerData = [
    {
      email: `lisa.andersson${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Lisa",
      lastName: "Andersson",
      phone: "0703-112 233",
      city: "Örebro",
    },
    {
      email: `anders.bergman${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Anders",
      lastName: "Bergman",
      phone: "0721-445 566",
      city: "Västerås",
    },
    {
      email: `karin.lindqvist${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Karin",
      lastName: "Lindqvist",
      phone: "0768-778 899",
      city: "Arboga",
    },
    {
      email: `peter.svensson${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Peter",
      lastName: "Svensson",
      phone: "0706-334 455",
      city: "Kumla",
    },
    {
      email: `emma.eriksson${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Emma",
      lastName: "Eriksson",
      phone: "0735-667 788",
      city: "Örebro",
    },
    {
      email: `stefan.olsson${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Stefan",
      lastName: "Olsson",
      phone: "0702-990 011",
      city: "Kungsör",
    },
    {
      email: `maria.holm${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Maria",
      lastName: "Holm",
      phone: "0739-223 344",
      city: "Örebro",
    },
    {
      email: `johan.nilsson${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Johan",
      lastName: "Nilsson",
      phone: "0704-556 677",
      city: "Hallsberg",
    },
    {
      email: `sara.magnusson${CUSTOMER_EMAIL_SUFFIX}`,
      firstName: "Sara",
      lastName: "Magnusson",
      phone: "0761-889 900",
      city: "Örebro",
    },
  ]

  const customers: Record<string, string> = {}
  for (const c of customerData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        userType: "customer",
        city: c.city,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    customers[`${c.firstName} ${c.lastName}`] = user.id
    console.log(`  Kund: ${c.firstName} ${c.lastName} (${c.city})`)
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 6. Horses (~14 st)
  // -------------------------------------------------------------------------

  const horseData = [
    // Lisa Andersson — 2 hästar
    { owner: "Lisa Andersson", name: "Molly", breed: "Welsh ponny", birthYear: 2017, color: "Brun", gender: "mare" as const },
    { owner: "Lisa Andersson", name: "Storm", breed: "Svenskt varmblod", birthYear: 2014, color: "Svart", gender: "gelding" as const },
    // Anders Bergman — 1 häst
    { owner: "Anders Bergman", name: "Dante", breed: "Hanoveraner", birthYear: 2015, color: "Brun", gender: "gelding" as const },
    // Karin Lindqvist — 2 hästar
    { owner: "Karin Lindqvist", name: "Bella", breed: "Gotlandsruss", birthYear: 2019, color: "Fux", gender: "mare" as const },
    { owner: "Karin Lindqvist", name: "Silver", breed: "Islandshäst", birthYear: 2012, color: "Skimmel", gender: "stallion" as const },
    // Peter Svensson — 1 häst
    { owner: "Peter Svensson", name: "Midnight", breed: "Araber", birthYear: 2016, color: "Svart", gender: "gelding" as const },
    // Emma Eriksson — 2 hästar
    { owner: "Emma Eriksson", name: "Samba", breed: "Lusitano", birthYear: 2013, color: "Grå", gender: "stallion" as const },
    { owner: "Emma Eriksson", name: "Luna", breed: "Fjordhäst", birthYear: 2018, color: "Gulbrun", gender: "mare" as const },
    // Stefan Olsson — 1 häst
    { owner: "Stefan Olsson", name: "Flash", breed: "Friesian", birthYear: 2017, color: "Svart", gender: "gelding" as const },
    // Maria Holm — 2 hästar
    { owner: "Maria Holm", name: "Prince", breed: "Oldenburger", birthYear: 2011, color: "Brun", gender: "gelding" as const },
    { owner: "Maria Holm", name: "Nova", breed: "Islandshäst", birthYear: 2020, color: "Fux", gender: "mare" as const },
    // Johan Nilsson — 1 häst
    { owner: "Johan Nilsson", name: "Tornado", breed: "Trakehner", birthYear: 2016, color: "Mörkbrun", gender: "gelding" as const },
    // Sara Magnusson — 2 hästar
    { owner: "Sara Magnusson", name: "Stella", breed: "Shetlandsponny", birthYear: 2015, color: "Brun", gender: "mare" as const },
    { owner: "Sara Magnusson", name: "Blixten", breed: "Nordsvensk kallblod", birthYear: 2013, color: "Brun", gender: "gelding" as const },
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
          specialNeeds: DEMO_TAG,
          isActive: true,
        },
      })
      horses[`${h.owner}/${h.name}`] = created.id
      console.log(`  Skapade häst: ${h.name} (${h.breed}, ${h.color})`)
    }
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
      // --- Bekräftade, kommande ---
      {
        customer: "Lisa Andersson", service: "Omskoning", horseKey: "Lisa Andersson/Molly",
        date: daysFromNow(2), startTime: "08:00", status: "confirmed",
        customerNotes: "Molly har lite ömma fötter på grus, annars frisk",
      },
      {
        customer: "Anders Bergman", service: "Omskoning", horseKey: "Anders Bergman/Dante",
        date: daysFromNow(3), startTime: "10:30", status: "confirmed",
      },
      {
        customer: "Peter Svensson", service: "Verkning (barfota)", horseKey: "Peter Svensson/Midnight",
        date: daysFromNow(5), startTime: "13:00", status: "confirmed",
      },
      {
        customer: "Maria Holm", service: "Omskoning", horseKey: "Maria Holm/Prince",
        date: daysFromNow(7), startTime: "09:00", status: "confirmed",
        providerNotes: "Prince brukar stå bra. Förra gången ny sko på vänster fram.",
      },
      {
        customer: "Emma Eriksson", service: "Akutbesök", horseKey: "Emma Eriksson/Samba",
        date: daysFromNow(10), startTime: "14:00", status: "confirmed",
        customerNotes: "Samba verkar halta lite på höger fram sedan igår",
      },
      // --- Pending ---
      {
        customer: "Karin Lindqvist", service: "Ungdomsverkning", horseKey: "Karin Lindqvist/Bella",
        date: daysFromNow(4), startTime: "11:00", status: "pending",
        customerNotes: "Bella är lite känslig i vänster bakben, var försiktig",
      },
      {
        customer: "Sara Magnusson", service: "Omskoning", horseKey: "Sara Magnusson/Stella",
        date: daysFromNow(8), startTime: "15:00", status: "pending",
      },
      // --- Genomförda (8 st) ---
      {
        customer: "Lisa Andersson", service: "Omskoning", horseKey: "Lisa Andersson/Storm",
        date: daysFromNow(-56), startTime: "09:00", status: "completed",
        providerNotes: "Ökad slitning på höger framhov. Kollar igen vid nästa besök.",
      },
      {
        customer: "Anders Bergman", service: "Verkning (barfota)", horseKey: "Anders Bergman/Dante",
        date: daysFromNow(-42), startTime: "10:00", status: "completed",
      },
      {
        customer: "Peter Svensson", service: "Omskoning", horseKey: "Peter Svensson/Midnight",
        date: daysFromNow(-70), startTime: "08:00", status: "completed",
      },
      {
        customer: "Karin Lindqvist", service: "Omskoning", horseKey: "Karin Lindqvist/Silver",
        date: daysFromNow(-49), startTime: "09:00", status: "completed",
      },
      {
        customer: "Emma Eriksson", service: "Verkning (barfota)", horseKey: "Emma Eriksson/Luna",
        date: daysFromNow(-56), startTime: "13:00", status: "completed",
      },
      {
        customer: "Stefan Olsson", service: "Omskoning", horseKey: "Stefan Olsson/Flash",
        date: daysFromNow(-35), startTime: "11:00", status: "completed",
        providerNotes: "Flash svårhanterad vid bakhovarna. Böjde i knä vid tag. Ta extra tid nästa gång.",
      },
      {
        customer: "Johan Nilsson", service: "Hovslagarbedömning", horseKey: "Johan Nilsson/Tornado",
        date: daysFromNow(-28), startTime: "14:00", status: "completed",
      },
      {
        customer: "Maria Holm", service: "Ungdomsverkning", horseKey: "Maria Holm/Nova",
        date: daysFromNow(-42), startTime: "10:00", status: "completed",
        providerNotes: "Nova i fin form för ung häst. Bra hovkvalitet.",
      },
      // --- Avbokade ---
      {
        customer: "Sara Magnusson", service: "Omskoning", horseKey: "Sara Magnusson/Blixten",
        date: daysFromNow(-14), startTime: "08:00", status: "cancelled",
        cancellationMessage: "Hästen hade feber, fick inte rida. Ber om ursäkt för sena beskedet.",
      },
      {
        customer: "Karin Lindqvist", service: "Verkning (barfota)", horseKey: "Karin Lindqvist/Bella",
        date: daysFromNow(-7), startTime: "12:00", status: "cancelled",
        cancellationMessage: "Tidsbrist pga jobbet. Bokar om nästa vecka.",
      },
      // --- Manuell bokning (skapad av leverantören) ---
      {
        customer: "Johan Nilsson", service: "Omskoning", horseKey: "Johan Nilsson/Tornado",
        date: daysFromNow(14), startTime: "10:00", status: "confirmed",
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
    { customer: "Lisa Andersson", service: "Omskoning", rating: 5, comment: "Erik är otroligt duktig och noggrann. Storm stod lugnt hela tiden – och det säger en del!" },
    { customer: "Anders Bergman", service: "Verkning (barfota)", rating: 4, comment: "Bra utfört arbete, lite försenat men Erik förklarade anledningen direkt. Inget problem." },
    { customer: "Peter Svensson", service: "Omskoning", rating: 5, comment: "Toppenservice! Midnight är alltid lite nervös för nya människor men Erik hanterade det suveränt." },
    { customer: "Karin Lindqvist", service: "Omskoning", rating: 4, comment: "Kompetent och trevlig. Bra pris för kvaliteten och Silver verkade nöjd med resultatet." },
    { customer: "Emma Eriksson", service: "Verkning (barfota)", rating: 5, comment: "Snabbt och professionellt. Erik gav dessutom bra tips om daglig hovvård som jag inte visste." },
    { customer: "Stefan Olsson", service: "Omskoning", rating: 3, comment: "Okej besök men Flash fick lite skärsår på hasorna. Hoppas det var en engångshändelse." },
    { customer: "Johan Nilsson", service: "Hovslagarbedömning", rating: 5, comment: "Mycket grundlig bedömning med tydlig skriftlig rapport. Värt varje krona." },
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
