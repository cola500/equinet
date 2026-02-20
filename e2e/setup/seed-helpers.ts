/**
 * Per-spec E2E seed helpers.
 *
 * Each spec seeds its own data tagged with `E2E-spec:<specTag>` in
 * customerNotes / specialInstructions.  Data is cleaned up by specTag
 * so specs never collide.
 *
 * Uses the singleton prisma from fixtures.ts -- NEVER call $disconnect().
 */
import { prisma } from '../fixtures'
import { futureWeekday, pastDate } from './e2e-utils'

// ─── Base entities (seeded once globally) ───────────────────────────

interface BaseEntities {
  customerId: string
  providerId: string
  providerUserId: string
  adminUserId: string
  service1Id: string // Hovslagning Standard
  service2Id: string // Ridlektion
  horseId: string    // E2E Blansen
}

let _cached: BaseEntities | null = null

/**
 * Fetch read-only base entities created by global seed.
 * Cached per process (safe because the values never change during a run).
 */
export async function getBaseEntities(): Promise<BaseEntities> {
  if (_cached) return _cached

  const customer = await prisma.user.findUniqueOrThrow({
    where: { email: 'test@example.com' },
    select: { id: true },
  })

  const providerUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'provider@example.com' },
    select: { id: true },
  })

  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@example.com' },
    select: { id: true },
  })

  const provider = await prisma.provider.findFirstOrThrow({
    where: { userId: providerUser.id },
    select: { id: true },
  })

  const service1 = await prisma.service.findFirstOrThrow({
    where: { providerId: provider.id, name: 'Hovslagning Standard' },
    select: { id: true },
  })

  const service2 = await prisma.service.findFirstOrThrow({
    where: { providerId: provider.id, name: 'Ridlektion' },
    select: { id: true },
  })

  // Horse may have been renamed/deleted by horses.spec.ts -- re-create if missing
  let horse = await prisma.horse.findFirst({
    where: { ownerId: customer.id, name: 'E2E Blansen' },
    select: { id: true },
  })
  if (!horse) {
    horse = await prisma.horse.create({
      data: {
        ownerId: customer.id,
        name: 'E2E Blansen',
        breed: 'Svenskt varmblod',
        birthYear: 2018,
        color: 'Brun',
        gender: 'mare',
      },
      select: { id: true },
    })
  }

  _cached = {
    customerId: customer.id,
    providerId: provider.id,
    providerUserId: providerUser.id,
    adminUserId: adminUser.id,
    service1Id: service1.id,
    service2Id: service2.id,
    horseId: horse.id,
  }

  return _cached
}

// ─── Seed helpers ───────────────────────────────────────────────────

interface SeedBookingOpts {
  specTag: string
  status: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
  daysFromNow: number // positive = future, negative = past
  horseName?: string
  horseId?: string | null
  serviceId?: string // defaults to service1 (Hovslagning Standard)
  startTime?: string // defaults to '10:00'
  endTime?: string   // defaults to '11:00'
  routeOrderId?: string // optional: link booking to a route order (flexible/announcement)
  rescheduleCount?: number // defaults to 0
}

/**
 * Create a single booking tagged with `E2E-spec:<specTag>`.
 * Returns the created booking.
 */
export async function seedBooking(opts: SeedBookingOpts) {
  const base = await getBaseEntities()
  const bookingDate =
    opts.daysFromNow >= 0 ? futureWeekday(opts.daysFromNow) : pastDate(Math.abs(opts.daysFromNow))

  return prisma.booking.create({
    data: {
      customerId: base.customerId,
      providerId: base.providerId,
      serviceId: opts.serviceId ?? base.service1Id,
      bookingDate,
      startTime: opts.startTime ?? '10:00',
      endTime: opts.endTime ?? '11:00',
      horseName: opts.horseName ?? 'E2E Thunder',
      horseId: opts.horseId ?? null,
      customerNotes: `E2E-spec:${opts.specTag}`,
      status: opts.status,
      routeOrderId: opts.routeOrderId ?? null,
      rescheduleCount: opts.rescheduleCount ?? 0,
    },
  })
}

/**
 * Seed N customer-initiated route orders tagged with `E2E-spec:<specTag>`.
 */
export async function seedRouteOrders(specTag: string, count: number) {
  const base = await getBaseEntities()

  const locations = [
    { address: 'Ridvagen 1, Goteborg', municipality: 'Goteborg', lat: 57.7089, lng: 11.9746, service: 'Hovslagning', horses: 2 },
    { address: 'Stallvagen 5, Molndal', municipality: 'Molndal', lat: 57.6554, lng: 12.0134, service: 'Hovslagning', horses: 1 },
    { address: 'Hingstgatan 12, Kungalv', municipality: 'Kungalv', lat: 57.8710, lng: 11.9710, service: 'Ridlektion', horses: 3 },
    { address: 'Folvagen 8, Partille', municipality: 'Partille', lat: 57.7394, lng: 12.1064, service: 'Hovslagning', horses: 1 },
  ]

  const created = []
  for (let i = 0; i < count; i++) {
    const loc = locations[i % locations.length]
    const order = await prisma.routeOrder.create({
      data: {
        customerId: base.customerId,
        announcementType: 'customer_initiated',
        serviceType: loc.service,
        address: loc.address,
        municipality: loc.municipality,
        latitude: loc.lat,
        longitude: loc.lng,
        numberOfHorses: loc.horses,
        dateFrom: futureWeekday(3),
        dateTo: futureWeekday(14),
        priority: 'normal',
        specialInstructions: `E2E-spec:${specTag}`,
        contactPhone: '0701234567',
        status: 'pending',
      },
    })
    created.push(order)
  }
  return created
}

/**
 * Seed a provider-announced route order (announcement) tagged with `E2E-spec:<specTag>`.
 * Connects the provider's service1 and service2.
 */
export async function seedProviderAnnouncement(specTag: string) {
  const base = await getBaseEntities()

  return prisma.routeOrder.create({
    data: {
      providerId: base.providerId,
      announcementType: 'provider_announced',
      serviceType: 'Hovslagning',
      address: 'Goteborg-omradet',
      municipality: 'Goteborg',
      latitude: 57.7089,
      longitude: 11.9746,
      numberOfHorses: 0,
      dateFrom: futureWeekday(7),
      dateTo: futureWeekday(21),
      priority: 'normal',
      specialInstructions: `E2E-spec:${specTag}`,
      status: 'open', // Must be 'open' to appear in public announcements page
      services: {
        connect: [{ id: base.service1Id }, { id: base.service2Id }],
      },
    },
  })
}

/**
 * Seed a Route with RouteStops directly in DB (for tests that need an existing route).
 * Creates its own route orders tagged with `E2E-spec:<specTag>-route`.
 */
export async function seedRoute(specTag: string) {
  const base = await getBaseEntities()
  const routeTag = `${specTag}-route`
  const orders = await seedRouteOrders(routeTag, 2)

  const route = await prisma.route.create({
    data: {
      providerId: base.providerId,
      routeName: `E2E Testrutt ${specTag}`,
      routeDate: futureWeekday(5),
      startTime: '09:00',
      status: 'planned',
    },
  })

  for (let i = 0; i < orders.length; i++) {
    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        routeOrderId: orders[i].id,
        stopOrder: i + 1,
        address: orders[i].address,
        status: 'pending',
      },
    })
  }

  return route
}

// ─── Booking Series ─────────────────────────────────────────────────

interface SeedBookingSeriesOpts {
  specTag: string
  intervalWeeks?: number     // defaults to 2
  totalOccurrences?: number  // defaults to 3
  serviceId?: string         // defaults to service1
}

/**
 * Create a BookingSeries + N confirmed bookings linked to it.
 * Bookings are spread across the current/coming weeks and tagged with `E2E-spec:<specTag>`.
 */
export async function seedBookingSeries(opts: SeedBookingSeriesOpts) {
  const base = await getBaseEntities()
  const interval = opts.intervalWeeks ?? 2
  const count = opts.totalOccurrences ?? 3
  const serviceId = opts.serviceId ?? base.service1Id

  // Create the series
  const series = await prisma.bookingSeries.create({
    data: {
      customerId: base.customerId,
      providerId: base.providerId,
      serviceId,
      intervalWeeks: interval,
      totalOccurrences: count,
      createdCount: count,
      startTime: '10:00',
      status: 'active',
    },
  })

  // Create bookings linked to the series
  const bookingIds: string[] = []
  for (let i = 0; i < count; i++) {
    const booking = await prisma.booking.create({
      data: {
        customerId: base.customerId,
        providerId: base.providerId,
        serviceId,
        bookingDate: futureWeekday(7 + i * interval * 7),
        startTime: '10:00',
        endTime: '11:00',
        horseName: 'E2E Thunder',
        customerNotes: `E2E-spec:${opts.specTag}`,
        status: 'confirmed',
        bookingSeriesId: series.id,
        rescheduleCount: 0,
      },
    })
    bookingIds.push(booking.id)
  }

  return { seriesId: series.id, bookingIds }
}

// ─── Cleanup ────────────────────────────────────────────────────────

/**
 * Delete all data tagged with `E2E-spec:<specTag>` in FK-safe order.
 */
export async function cleanupSpecData(specTag: string): Promise<void> {
  const marker = `E2E-spec:${specTag}`

  // 1. Review (FK -> Booking) -- provider reviews of customers
  await prisma.review.deleteMany({
    where: { booking: { customerNotes: marker } },
  })

  // 2. CustomerReview (FK -> Booking)
  await prisma.customerReview.deleteMany({
    where: { booking: { customerNotes: marker } },
  })

  // 3. BookingSeries: collect series IDs BEFORE deleting bookings
  //    (onDelete: SetNull means deleting bookings sets bookingSeriesId=null)
  const taggedBookingsWithSeries = await prisma.booking.findMany({
    where: { customerNotes: marker, bookingSeriesId: { not: null } },
    select: { bookingSeriesId: true },
  })
  const seriesIds = [...new Set(
    taggedBookingsWithSeries
      .map(b => b.bookingSeriesId)
      .filter(Boolean)
  )] as string[]

  // 4. Bookings (may reference routeOrders via routeOrderId)
  await prisma.booking.deleteMany({
    where: { customerNotes: marker },
  })

  // 5. BookingSeries (now safe to delete since bookings are gone)
  if (seriesIds.length > 0) {
    await prisma.bookingSeries.deleteMany({
      where: { id: { in: seriesIds } },
    })
  }

  // 4. RouteStop (FK -> Route, RouteOrder)
  // First collect routeIds so we can delete the parent Routes after
  const taggedRouteStops = await prisma.routeStop.findMany({
    where: { routeOrder: { specialInstructions: marker } },
    select: { routeId: true },
  })
  await prisma.routeStop.deleteMany({
    where: { routeOrder: { specialInstructions: marker } },
  })

  // 5. Routes whose stops referenced our tagged route orders
  const routeIds = [...new Set(taggedRouteStops.map(s => s.routeId).filter(Boolean))] as string[]
  if (routeIds.length > 0) {
    await prisma.route.deleteMany({ where: { id: { in: routeIds } } })
  }

  // 6. Disconnect services from provider-announced route orders before deleting them
  const taggedOrders = await prisma.routeOrder.findMany({
    where: { specialInstructions: marker },
    select: { id: true },
  })
  for (const order of taggedOrders) {
    await prisma.routeOrder.update({
      where: { id: order.id },
      data: { services: { set: [] } },
    })
  }

  // 7. RouteOrders
  await prisma.routeOrder.deleteMany({
    where: { specialInstructions: marker },
  })
}
