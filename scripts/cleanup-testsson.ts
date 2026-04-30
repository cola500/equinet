import { PrismaClient } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.local", override: false })
config({ path: ".env", override: false })

const prisma = new PrismaClient()

const TESTSSON_IDS = [
  "d28ae954-b347-4366-abc5-66c7ccb4259a", // Leverantör Testsson
  "77a517eb-eaba-4f5b-a895-9524c2b94cbd", // Test Testsson
]

async function main() {
  console.log("=== Städar Testsson-konton ===\n")

  // Hitta kopplade providers
  const providers = await prisma.provider.findMany({
    where: { userId: { in: TESTSSON_IDS } },
    select: { id: true, businessName: true },
  })
  const providerIds = providers.map((p) => p.id)
  console.log("Providers att ta bort:", providers.map((p) => p.businessName))

  // Radera allt kopplat till providers
  if (providerIds.length > 0) {
    const bookings = await prisma.booking.findMany({
      where: { providerId: { in: providerIds } },
      select: { id: true },
    })
    const bookingIds = bookings.map((b) => b.id)
    console.log("Bokningar att ta bort:", bookingIds.length, "st")

    await prisma.review.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.customerReview.deleteMany({ where: { bookingId: { in: bookingIds } } })
    await prisma.conversation.deleteMany({ where: { bookingId: { in: bookingIds } } })
    await prisma.booking.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.bookingSeries.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.service.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.availability.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.availabilityException.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.providerCustomerNote.deleteMany({ where: { providerId: { in: providerIds } } })
    await prisma.provider.deleteMany({ where: { id: { in: providerIds } } })
    console.log("Providers raderade")
  }

  // Hästar och bokningar som kund (om Test Testsson hade hästar)
  const horses = await prisma.horse.findMany({
    where: { ownerId: { in: TESTSSON_IDS } },
    select: { id: true, name: true },
  })
  if (horses.length > 0) {
    console.log("Hästar att ta bort:", horses.map((h) => h.name))
    await prisma.horse.deleteMany({ where: { ownerId: { in: TESTSSON_IDS } } })
  }

  // Bokningar som kund
  const customerBookings = await prisma.booking.findMany({
    where: { customerId: { in: TESTSSON_IDS } },
    select: { id: true },
  })
  if (customerBookings.length > 0) {
    const ids = customerBookings.map((b) => b.id)
    await prisma.review.deleteMany({ where: { bookingId: { in: ids } } })
    await prisma.customerReview.deleteMany({ where: { bookingId: { in: ids } } })
    await prisma.booking.deleteMany({ where: { id: { in: ids } } })
    console.log(`${customerBookings.length} kundbokningar raderade`)
  }

  // Radera alla beroenden på User
  await prisma.notification.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.deviceToken.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.mobileToken.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.follow.deleteMany({ where: { customerId: { in: TESTSSON_IDS } } })
  await prisma.municipalityWatch.deleteMany({ where: { customerId: { in: TESTSSON_IDS } } })
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.groupBookingParticipant.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.groupBookingRequest.deleteMany({ where: { creatorId: { in: TESTSSON_IDS } } })
  await prisma.bookingSeries.deleteMany({ where: { customerId: { in: TESTSSON_IDS } } })
  await prisma.review.deleteMany({ where: { customerId: { in: TESTSSON_IDS } } })
  await prisma.customerReview.deleteMany({ where: { bookingId: { in:
    (await prisma.booking.findMany({ where: { customerId: { in: TESTSSON_IDS } }, select: { id: true } })).map(b => b.id)
  } } })
  await prisma.customerInviteToken.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })
  await prisma.upload.deleteMany({ where: { userId: { in: TESTSSON_IDS } } })

  // Radera User-poster
  await prisma.user.deleteMany({ where: { id: { in: TESTSSON_IDS } } })
  console.log("User-poster raderade från DB")

  // Radera från Supabase Auth
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    for (const uid of TESTSSON_IDS) {
      const { error } = await supabase.auth.admin.deleteUser(uid)
      if (error) {
        console.warn(`  Auth-borttagning misslyckades för ${uid}: ${error.message}`)
      } else {
        console.log(`  Auth-konto raderat: ${uid}`)
      }
    }
  } else {
    console.warn("SUPABASE_SERVICE_ROLE_KEY saknas — auth-konton ej raderade")
  }

  // ─── Skapa ny trevlig testleverantör ────────────────────────────────────────
  console.log("\n=== Skapar Anna Lindberg — Lindbergs Hovslageri ===\n")

  const NEW_EMAIL = "anna.lindberg@test.equinet.se"
  const NEW_PASSWORD = "TestProvider123!"

  let authUserId: string

  const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  if (supabase) {
    // Rensa eventuell gammal auth-post
    const { data: listData } = await supabase.auth.admin.listUsers()
    const existing = listData?.users.find((u) => u.email === NEW_EMAIL)
    if (existing) {
      await supabase.auth.admin.deleteUser(existing.id)
      // Vänta på att triggern tar bort public.User
      await new Promise((r) => setTimeout(r, 500))
    }

    // Rensa eventuell gammal public.User (om triggern inte hann ta bort)
    await prisma.user.deleteMany({ where: { email: NEW_EMAIL } })

    const { data, error } = await supabase.auth.admin.createUser({
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
      email_confirm: true,
      user_metadata: { firstName: "Anna", lastName: "Lindberg" },
      app_metadata: { userType: "provider", isAdmin: false },
    })
    if (error) throw new Error(`Auth-skapande misslyckades: ${error.message}`)
    authUserId = data.user.id
    console.log("Auth-konto skapat:", NEW_EMAIL)

    // Vänta på att triggern skapar public.User
    for (let i = 0; i < 10; i++) {
      const u = await prisma.user.findUnique({ where: { id: authUserId } })
      if (u) break
      await new Promise((r) => setTimeout(r, 200))
    }
  } else {
    console.warn("Inget auth — skapar user direkt i DB")
    await prisma.user.deleteMany({ where: { email: NEW_EMAIL } })
    authUserId = "00000000-0000-4000-a000-anna00000001"
    await prisma.user.create({
      data: { id: authUserId, email: NEW_EMAIL, firstName: "Anna", lastName: "Lindberg", userType: "provider" },
    })
  }

  // Uppdatera public.User med rätt fält (triggern skapar en minimal post)
  await prisma.user.update({
    where: { id: authUserId },
    data: { firstName: "Anna", lastName: "Lindberg", userType: "provider", phone: "070-123 45 67", emailVerified: true, emailVerifiedAt: new Date() },
  })

  const provider = await prisma.provider.create({
    data: {
      userId: authUserId,
      businessName: "Lindbergs Hovslageri",
      description:
        "Certifierad hovslagare med 12 års erfarenhet i Stockholmsregionen. Specialiserad på barfotaverkning och rehabilitering av ridsporthästar och ponnier.",
      city: "Täby",
      serviceAreaKm: 40,
      isVerified: true,
    },
  })

  await prisma.availability.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      providerId: provider.id,
      dayOfWeek,
      startTime: "08:00",
      endTime: "17:00",
      isClosed: false,
    })),
  })

  await prisma.service.createMany({
    data: [
      { providerId: provider.id, name: "Omskoning", price: 1400, durationMinutes: 75, isActive: true },
      { providerId: provider.id, name: "Verkning (barfota)", price: 750, durationMinutes: 45, isActive: true },
      { providerId: provider.id, name: "Akutbesök", price: 2500, durationMinutes: 60, isActive: true },
    ],
  })

  console.log("Skapad: Anna Lindberg — Lindbergs Hovslageri, Täby")
  console.log(`Inloggning: ${NEW_EMAIL} / ${NEW_PASSWORD}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
