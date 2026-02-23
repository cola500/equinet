/**
 * Batch adapter for looking up overdue horses for multiple customers.
 * Used by RouteAnnouncementNotifier to personalize notifications.
 *
 * Uses 3 queries (not 3N) regardless of customer count.
 * Reuses resolveInterval + calculateDueStatus from DueForServiceCalculator.
 */
import { prisma } from "@/lib/prisma"
import { calculateDueStatus, resolveInterval } from "./DueForServiceCalculator"

export interface OverdueHorseInfo {
  horseName: string
  serviceName: string
  daysOverdue: number
}

export interface DueForServiceLookup {
  getOverdueHorsesForCustomers(
    customerIds: string[]
  ): Promise<Map<string, OverdueHorseInfo[]>>
}

export class PrismaDueForServiceLookup implements DueForServiceLookup {
  private now: Date

  constructor(now?: Date) {
    this.now = now ?? new Date()
  }

  async getOverdueHorsesForCustomers(
    customerIds: string[]
  ): Promise<Map<string, OverdueHorseInfo[]>> {
    if (customerIds.length === 0) return new Map()

    // 1. All completed bookings with horses for these customers
    const bookings = await prisma.booking.findMany({
      where: {
        customerId: { in: customerIds },
        status: "completed",
        horseId: { not: null },
      },
      select: {
        customerId: true,
        horseId: true,
        serviceId: true,
        bookingDate: true,
        horse: { select: { id: true, name: true } },
        service: {
          select: { id: true, name: true, recommendedIntervalWeeks: true },
        },
      },
      orderBy: { bookingDate: "desc" },
    })

    const horseIds = [
      ...new Set(bookings.map((b) => b.horseId).filter(Boolean)),
    ] as string[]

    if (horseIds.length === 0) return new Map()

    // 2. Provider overrides (batch, per service)
    const overrides = await prisma.horseServiceInterval.findMany({
      where: { horseId: { in: horseIds } },
      select: { horseId: true, serviceId: true, revisitIntervalWeeks: true },
    })
    const overrideMap = new Map(
      overrides.map((o) => [`${o.horseId}:${o.serviceId}`, o.revisitIntervalWeeks])
    )

    // 3. Customer intervals (batch)
    const customerIntervals =
      await prisma.customerHorseServiceInterval.findMany({
        where: { horseId: { in: horseIds } },
        select: { horseId: true, serviceId: true, intervalWeeks: true },
      })
    const customerIntervalMap = new Map(
      customerIntervals.map((ci) => [
        `${ci.horseId}:${ci.serviceId}`,
        ci.intervalWeeks,
      ])
    )

    // Dedup: latest booking per (customerId, horseId, serviceId)
    const latestBookingMap = new Map<string, (typeof bookings)[0]>()
    for (const booking of bookings) {
      if (!booking.horseId || !booking.horse) continue
      const key = `${booking.customerId}:${booking.horseId}:${booking.serviceId}`
      const existing = latestBookingMap.get(key)
      if (
        !existing ||
        new Date(booking.bookingDate) > new Date(existing.bookingDate)
      ) {
        latestBookingMap.set(key, booking)
      }
    }

    // Calculate status per customer
    const result = new Map<string, OverdueHorseInfo[]>()

    for (const booking of latestBookingMap.values()) {
      const intervalWeeks = resolveInterval(
        booking.service.recommendedIntervalWeeks,
        overrideMap.get(`${booking.horseId!}:${booking.serviceId}`) ?? null,
        customerIntervalMap.get(
          `${booking.horseId!}:${booking.serviceId}`
        ) ?? null
      )

      if (intervalWeeks === null) continue

      const dueResult = calculateDueStatus(
        {
          horseId: booking.horse!.id,
          horseName: booking.horse!.name,
          serviceId: booking.service.id,
          serviceName: booking.service.name,
          lastServiceDate: new Date(booking.bookingDate),
          intervalWeeks,
        },
        this.now
      )

      if (dueResult.status !== "overdue") continue

      const customerId = booking.customerId
      if (!result.has(customerId)) {
        result.set(customerId, [])
      }
      result.get(customerId)!.push({
        horseName: dueResult.horseName,
        serviceName: dueResult.serviceName,
        daysOverdue: Math.abs(dueResult.daysUntilDue),
      })
    }

    // Sort each customer's list: most overdue first
    for (const items of result.values()) {
      items.sort((a, b) => b.daysOverdue - a.daysOverdue)
    }

    return result
  }
}
