import { prisma } from "@/lib/prisma"
import {
  calculateDueStatus,
  resolveInterval,
  type DueForServiceResult,
} from "./DueForServiceCalculator"

/**
 * Read-only query service for calculating due-for-service status.
 * Uses Prisma directly (not a core domain -- this is a cross-cutting read query).
 */
export class DueForServiceService {
  private now: Date

  constructor(now?: Date) {
    this.now = now ?? new Date()
  }

  /**
   * Get due-for-service status for all horses owned by a customer.
   * Returns only overdue and upcoming items, sorted by urgency.
   */
  async getForCustomer(customerId: string): Promise<DueForServiceResult[]> {
    return this.calculateDueItems({ customerId })
  }

  /**
   * Get due-for-service status for a specific horse.
   * Returns null if the horse does not belong to the customer (ownership check).
   */
  async getForHorse(
    horseId: string,
    customerId: string
  ): Promise<DueForServiceResult[] | null> {
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, ownerId: customerId },
      select: { id: true },
    })

    if (!horse) return null

    return this.calculateDueItems({ customerId, horseId })
  }

  private async calculateDueItems(filter: {
    customerId: string
    horseId?: string
  }): Promise<DueForServiceResult[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        customerId: filter.customerId,
        status: "completed",
        horseId: filter.horseId ?? { not: null },
      },
      select: {
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

    // Fetch horse-specific interval overrides
    const horseIds = [...new Set(bookings.map((b) => b.horseId).filter(Boolean))] as string[]
    const overrides =
      horseIds.length > 0
        ? await prisma.horseServiceInterval.findMany({
            where: { horseId: { in: horseIds } },
            select: { horseId: true, revisitIntervalWeeks: true },
          })
        : []

    const overrideMap = new Map(
      overrides.map((o) => [o.horseId, o.revisitIntervalWeeks])
    )

    // Fetch customer-set intervals per horse+service
    const customerIntervals =
      horseIds.length > 0
        ? await prisma.customerHorseServiceInterval.findMany({
            where: { horseId: { in: horseIds } },
            select: { horseId: true, serviceId: true, intervalWeeks: true },
          })
        : []

    const customerIntervalMap = new Map(
      customerIntervals.map((ci) => [`${ci.horseId}:${ci.serviceId}`, ci.intervalWeeks])
    )

    // Deduplicate: keep latest booking per (horseId, serviceId)
    const latestBookingMap = new Map<string, (typeof bookings)[0]>()
    for (const booking of bookings) {
      if (!booking.horseId || !booking.horse) continue
      const key = `${booking.horseId}:${booking.serviceId}`
      const existing = latestBookingMap.get(key)
      if (
        !existing ||
        new Date(booking.bookingDate) > new Date(existing.bookingDate)
      ) {
        latestBookingMap.set(key, booking)
      }
    }

    // Calculate status for each
    const items: DueForServiceResult[] = []
    for (const booking of latestBookingMap.values()) {
      const intervalWeeks = resolveInterval(
        booking.service.recommendedIntervalWeeks,
        overrideMap.get(booking.horseId!) ?? null,
        customerIntervalMap.get(`${booking.horseId!}:${booking.serviceId}`) ?? null
      )

      if (intervalWeeks === null) continue // no interval from any source

      const result = calculateDueStatus(
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

      items.push(result)
    }

    // Filter: only overdue and upcoming (customers don't need "ok")
    const filtered = items.filter(
      (item) => item.status === "overdue" || item.status === "upcoming"
    )

    // Sort: most urgent first
    filtered.sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    return filtered
  }
}
