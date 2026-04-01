/**
 * Demo seed script -- creates realistic data for demo mode.
 *
 * This script:
 * 1. Updates the existing provider (provider@example.com) with realistic profile data
 * 2. Removes E2E test services
 * 3. Creates realistic services, customers, horses, and bookings
 *
 * Run with: npx tsx prisma/seed-demo.ts
 * Reset with: npx tsx prisma/seed-demo.ts --reset (deletes demo data, then re-seeds)
 *
 * Prerequisites: seed-test-users.ts must have been run first.
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

// Tag for identifying demo-created data
const DEMO_TAG = "DEMO-SEED"

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

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function resetDemoData() {
  console.log("Removing demo data...")

  // Delete demo bookings (by demo customer email pattern)
  const demoCustomers = await prisma.user.findMany({
    where: { email: { endsWith: "@demo.equinet.se" } },
    select: { id: true },
  })
  const demoCustomerIds = demoCustomers.map((c) => c.id)
  const deleted = demoCustomerIds.length > 0
    ? await prisma.booking.deleteMany({
        where: { customerId: { in: demoCustomerIds } },
      })
    : { count: 0 }
  console.log(`  Deleted ${deleted.count} demo bookings`)

  // Delete demo horses
  const horses = await prisma.horse.deleteMany({
    where: {
      specialNeeds: { contains: DEMO_TAG },
    },
  })
  console.log(`  Deleted ${horses.count} demo horses`)

  // Delete demo customers (by email pattern)
  const customers = await prisma.user.deleteMany({
    where: {
      email: { endsWith: "@demo.equinet.se" },
      userType: "customer",
    },
  })
  console.log(`  Deleted ${customers.count} demo customers`)

  console.log("Demo data removed.\n")
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  const isReset = process.argv.includes("--reset")

  if (isReset) {
    await resetDemoData()
  }

  console.log("Seeding demo data...\n")

  // -------------------------------------------------------------------------
  // 1. Find and update existing provider
  // -------------------------------------------------------------------------

  const providerUser = await prisma.user.findUnique({
    where: { email: "provider@example.com" },
  })

  if (!providerUser) {
    console.error("Provider user not found. Run seed-test-users.ts first.")
    process.exit(1)
  }

  // Update provider user with realistic name
  await prisma.user.update({
    where: { id: providerUser.id },
    data: {
      firstName: "Maria",
      lastName: "Lindgren",
      phone: "0706-123 456",
    },
  })
  console.log("Updated provider user: Maria Lindgren")

  const provider = await prisma.provider.findUnique({
    where: { userId: providerUser.id },
  })

  if (!provider) {
    console.error("Provider profile not found.")
    process.exit(1)
  }

  // Update provider profile
  await prisma.provider.update({
    where: { id: provider.id },
    data: {
      businessName: "Lindgrens Hovslагeri & Ridskola",
      description:
        "Certifierad hovslagare och ridlarare med 12 ars erfarenhet. " +
        "Vi erbjuder hovslagning, ridlektioner och halsokontroller for hastar " +
        "i Stockholmsomradet.",
      address: "Stallvagen 8",
      city: "Taby",
      postalCode: "183 47",
      latitude: 59.4439,
      longitude: 18.0686,
      serviceAreaKm: 40,
      isActive: true,
      acceptingNewCustomers: true,
    },
  })
  console.log("Updated provider: Lindgrens Hovslageri & Ridskola\n")

  // -------------------------------------------------------------------------
  // 2. Remove E2E test services
  // -------------------------------------------------------------------------

  // First delete bookings tied to E2E services, then delete the services
  const e2eServiceIds = await prisma.service.findMany({
    where: { providerId: provider.id, name: { startsWith: "E2E" } },
    select: { id: true },
  })
  if (e2eServiceIds.length > 0) {
    const ids = e2eServiceIds.map((s) => s.id)
    const deletedBookings = await prisma.booking.deleteMany({
      where: { serviceId: { in: ids } },
    })
    console.log(`  Removed ${deletedBookings.count} bookings tied to E2E services`)
    const deletedServices = await prisma.service.deleteMany({
      where: { id: { in: ids } },
    })
    console.log(`  Removed ${deletedServices.count} E2E test services`)
  } else {
    console.log("  No E2E services to remove")
  }

  // Remove bookings tied to test@example.com (old seed-test-users data)
  const testUser = await prisma.user.findUnique({
    where: { email: "test@example.com" },
    select: { id: true },
  })
  if (testUser) {
    const oldBookings = await prisma.booking.deleteMany({
      where: { customerId: testUser.id, providerId: provider.id },
    })
    if (oldBookings.count > 0) {
      console.log(`  Removed ${oldBookings.count} old test@example.com bookings`)
    }
  }

  // -------------------------------------------------------------------------
  // 3. Create realistic services (upsert by name)
  // -------------------------------------------------------------------------

  const serviceData = [
    {
      name: "Hovslagning",
      description: "Komplett hovslagning med verkning och skobeslag",
      price: 1200,
      durationMinutes: 60,
      recommendedIntervalWeeks: 8,
    },
    {
      name: "Hovvard utan beslag",
      description: "Verkning och raspning for barbenta hastar",
      price: 700,
      durationMinutes: 45,
      recommendedIntervalWeeks: 6,
    },
    {
      name: "Ridlektion",
      description: "Privat ridlektion anpassad efter ryttarens niva",
      price: 550,
      durationMinutes: 45,
    },
    {
      name: "Halsokontroll",
      description: "Allman halsokontroll med rontgen vid behov",
      price: 900,
      durationMinutes: 30,
    },
  ]

  const services: Record<string, string> = {}
  for (const s of serviceData) {
    const existing = await prisma.service.findFirst({
      where: { providerId: provider.id, name: s.name },
    })
    if (existing) {
      services[s.name] = existing.id
      console.log(`  Service exists: ${s.name}`)
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
      console.log(`  Created service: ${s.name} (${s.price} kr, ${s.durationMinutes} min)`)
    }
  }

  // Remove old test services that are not in our list
  const keepNames = serviceData.map((s) => s.name)
  const staleServices = await prisma.service.findMany({
    where: {
      providerId: provider.id,
      name: { notIn: keepNames },
    },
    select: { id: true, name: true },
  })
  for (const stale of staleServices) {
    try {
      await prisma.service.delete({ where: { id: stale.id } })
      console.log(`  Removed stale service: ${stale.name}`)
    } catch {
      // Deactivate if FK constraints prevent deletion
      await prisma.service.update({
        where: { id: stale.id },
        data: { isActive: false },
      })
      console.log(`  Deactivated stale service: ${stale.name} (has references)`)
    }
  }

  console.log("")

  // -------------------------------------------------------------------------
  // 4. Create demo customers
  // -------------------------------------------------------------------------

  const customerPassword = await bcrypt.hash("DemoPass123!", 10)

  const customerData = [
    {
      email: "anna.johansson@demo.equinet.se",
      firstName: "Anna",
      lastName: "Johansson",
      phone: "0731-456 789",
      city: "Taby",
    },
    {
      email: "erik.svensson@demo.equinet.se",
      firstName: "Erik",
      lastName: "Svensson",
      phone: "0702-345 678",
      city: "Danderyd",
    },
    {
      email: "sofia.berg@demo.equinet.se",
      firstName: "Sofia",
      lastName: "Berg",
      phone: "0768-901 234",
      city: "Vallentuna",
    },
    {
      email: "johan.pettersson@demo.equinet.se",
      firstName: "Johan",
      lastName: "Pettersson",
      phone: "0704-567 890",
      city: "Osteraker",
    },
  ]

  const customers: Record<string, string> = {}
  for (const c of customerData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash: customerPassword,
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
    console.log(`  Customer: ${c.firstName} ${c.lastName}`)
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 5. Create demo horses (owned by customers)
  // -------------------------------------------------------------------------

  const horseData = [
    {
      ownerName: "Anna Johansson",
      name: "Storm",
      breed: "Svenskt varmblod",
      birthYear: 2016,
      color: "Brun",
      gender: "gelding" as const,
    },
    {
      ownerName: "Erik Svensson",
      name: "Saga",
      breed: "Islandsponny",
      birthYear: 2014,
      color: "Svart",
      gender: "mare" as const,
    },
    {
      ownerName: "Sofia Berg",
      name: "Bella",
      breed: "Gotlandsruss",
      birthYear: 2019,
      color: "Fux",
      gender: "mare" as const,
    },
  ]

  const horses: Record<string, string> = {}
  for (const h of horseData) {
    const ownerId = customers[h.ownerName]
    if (!ownerId) continue

    const existing = await prisma.horse.findFirst({
      where: { ownerId, name: h.name },
    })

    if (existing) {
      horses[h.name] = existing.id
      console.log(`  Horse exists: ${h.name}`)
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
      horses[h.name] = created.id
      console.log(`  Created horse: ${h.name} (${h.breed}, ${h.color})`)
    }
  }
  console.log("")

  // -------------------------------------------------------------------------
  // 6. Create demo bookings
  // -------------------------------------------------------------------------

  // Check for existing demo bookings
  const demoIds = Object.values(customers)
  const existingDemo = demoIds.length > 0
    ? await prisma.booking.count({ where: { customerId: { in: demoIds } } })
    : 0
  // Track created bookings for review linking
  const createdBookings: Array<{ id: string; customer: string; service: string; status: string }> = []

  if (existingDemo > 0) {
    console.log(`${existingDemo} demo bookings already exist. Skipping booking creation.`)
    console.log("Run with --reset to recreate.\n")

    // Load existing completed bookings for review linking
    const existingBookings = await prisma.booking.findMany({
      where: { customerId: { in: demoIds }, status: "completed" },
      select: { id: true, customerId: true, serviceId: true, status: true },
    })
    for (const eb of existingBookings) {
      const customerName = Object.entries(customers).find(([, id]) => id === eb.customerId)?.[0] ?? ""
      const serviceName = Object.entries(services).find(([, id]) => id === eb.serviceId)?.[0] ?? ""
      createdBookings.push({ id: eb.id, customer: customerName, service: serviceName, status: eb.status })
    }
  } else {
    const bookings = [
      // Upcoming: confirmed
      {
        customer: "Anna Johansson",
        service: "Hovslagning",
        horse: "Storm",
        date: daysFromNow(2),
        startTime: "09:00",
        status: "confirmed",
        customerNotes: "Vanligen lite kickig pa vanster bak",
      },
      // Upcoming: confirmed
      {
        customer: "Erik Svensson",
        service: "Hovvard utan beslag",
        horse: "Saga",
        date: daysFromNow(2),
        startTime: "11:00",
        status: "confirmed",
      },
      // Upcoming: pending (new request)
      {
        customer: "Sofia Berg",
        service: "Ridlektion",
        horse: "Bella",
        date: daysFromNow(4),
        startTime: "14:00",
        status: "pending",
        customerNotes: "Forsta lektionen, nybörjare",
      },
      // Completed: last week
      {
        customer: "Anna Johansson",
        service: "Hovslagning",
        horse: "Storm",
        date: daysFromNow(-7),
        startTime: "10:00",
        status: "completed",
      },
      // Completed: 2 weeks ago
      {
        customer: "Johan Pettersson",
        service: "Halsokontroll",
        date: daysFromNow(-14),
        startTime: "13:00",
        status: "completed",
        customerNotes: "Haltar lite pa vanger fram",
        horseName: "Prinsen",
      },
      // Completed: 3 weeks ago
      {
        customer: "Erik Svensson",
        service: "Hovslagning",
        horse: "Saga",
        date: daysFromNow(-21),
        startTime: "09:00",
        status: "completed",
      },
      // Cancelled
      {
        customer: "Sofia Berg",
        service: "Ridlektion",
        horse: "Bella",
        date: daysFromNow(-3),
        startTime: "15:00",
        status: "cancelled",
        cancellationMessage: "Hasten ar inte frisk, far boka om",
      },
    ]

    for (const b of bookings) {
      const customerId = customers[b.customer]
      const serviceId = services[b.service]
      if (!customerId || !serviceId) {
        console.log(`  Skipped: ${b.customer} / ${b.service} (missing reference)`)
        continue
      }

      const serviceDef = serviceData.find((s) => s.name === b.service)
      const endTime = addMinutes(b.startTime, serviceDef?.durationMinutes ?? 60)

      const created = await prisma.booking.create({
        data: {
          customerId,
          providerId: provider.id,
          serviceId,
          bookingDate: b.date,
          startTime: b.startTime,
          endTime,
          status: b.status,
          horseName: b.horse ?? b.horseName ?? null,
          horseId: b.horse ? horses[b.horse] ?? null : null,
          customerNotes: b.customerNotes ?? null,
          cancellationMessage: b.cancellationMessage ?? null,
          isManualBooking: false,
          providerNotes: null,
        },
      })
      createdBookings.push({ id: created.id, customer: b.customer, service: b.service, status: b.status })
      const statusLabel = {
        confirmed: "bekraftad",
        pending: "vantar",
        completed: "genomford",
        cancelled: "avbokad",
      }[b.status]
      console.log(
        `  Booking: ${b.service} - ${b.customer} (${statusLabel}, ${b.startTime})`
      )
    }
  }

  // -------------------------------------------------------------------------
  // 7. Create demo reviews (for completed bookings)
  // -------------------------------------------------------------------------

  const reviewData = [
    {
      customer: "Anna Johansson",
      service: "Hovslagning",
      rating: 5,
      comment: "Mycket proffsigt och lugnt bemotande. Storm var helt avslappnad hela tiden.",
    },
    {
      customer: "Johan Pettersson",
      service: "Halsokontroll",
      rating: 4,
      comment: "Bra undersokning, fick tydlig forklaring. Lite vantetid men inget stort problem.",
    },
    {
      customer: "Erik Svensson",
      service: "Hovslagning",
      rating: 5,
      comment: "Alltid lika palitlig och noggrann. Saga ar alltid lugn hos Maria.",
    },
  ]

  const completedBookings = createdBookings.filter((b) => b.status === "completed")

  if (completedBookings.length > 0) {
    let reviewCount = 0
    for (const r of reviewData) {
      const booking = completedBookings.find(
        (b) => b.customer === r.customer && b.service === r.service
      )
      if (!booking) {
        console.log(`  Skipped review: ${r.customer} / ${r.service} (no matching booking)`)
        continue
      }

      const existingReview = await prisma.customerReview.findUnique({
        where: { bookingId: booking.id },
      })
      if (existingReview) {
        console.log(`  Review exists: ${r.customer} (${r.rating} stjarnor)`)
        continue
      }

      await prisma.customerReview.create({
        data: {
          bookingId: booking.id,
          providerId: provider.id,
          customerId: customers[r.customer],
          rating: r.rating,
          comment: r.comment,
        },
      })
      reviewCount++
      console.log(`  Review: ${r.customer} - ${r.rating} stjarnor`)
    }
    console.log(`  ${reviewCount} recensioner skapade\n`)
  } else {
    console.log("  No completed bookings to review (run with --reset to recreate)\n")
  }

  // -------------------------------------------------------------------------
  // 8. Ensure availability schedule exists
  // -------------------------------------------------------------------------

  const existingAvail = await prisma.availability.count({
    where: { providerId: provider.id },
  })

  if (existingAvail === 0) {
    for (let day = 0; day <= 6; day++) {
      const isClosed = day >= 5 // Saturday, Sunday
      await prisma.availability.create({
        data: {
          providerId: provider.id,
          dayOfWeek: day,
          startTime: isClosed ? "00:00" : "08:00",
          endTime: isClosed ? "00:00" : "17:00",
          isClosed,
          isActive: true,
        },
      })
    }
    console.log("\n  Created availability schedule (Mon-Fri 08-17)")
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  console.log("\n--- Demo seed complete ---")
  console.log("\nProvider: Maria Lindgren (provider@example.com / ProviderPass123!)")
  console.log("Business: Lindgrens Hovslageri & Ridskola")
  console.log(`Services: ${Object.keys(services).length}`)
  console.log(`Customers: ${Object.keys(customers).length}`)
  console.log(`Horses: ${Object.keys(horses).length}`)
  console.log("")
}

main()
  .catch((e) => {
    console.error("Error seeding demo data:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
