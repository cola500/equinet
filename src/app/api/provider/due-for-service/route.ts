import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import {
  calculateDueStatus,
  resolveInterval,
  type DueForServiceResult,
} from "@/domain/due-for-service/DueForServiceCalculator"

interface ProviderDueForServiceItem extends DueForServiceResult {
  ownerName: string
}

// GET /api/provider/due-for-service?filter=all|overdue|upcoming
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user, request }) => {
    const provider = await prisma.provider.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantorsprofil hittades inte" },
        { status: 404 }
      )
    }

    const filter = request.nextUrl.searchParams.get("filter") || "all"

    // Fetch completed bookings with horses and services
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: "completed",
        horseId: { not: null },
      },
      select: {
        horseId: true,
        serviceId: true,
        bookingDate: true,
        horse: {
          select: { id: true, name: true },
        },
        customer: {
          select: { firstName: true, lastName: true },
        },
        service: {
          select: {
            id: true,
            name: true,
            recommendedIntervalWeeks: true,
          },
        },
      },
      orderBy: { bookingDate: "desc" },
    })

    // Fetch all horse-specific overrides for this provider (per service)
    const overrides = await prisma.horseServiceInterval.findMany({
      where: { providerId: provider.id },
      select: {
        horseId: true,
        serviceId: true,
        revisitIntervalWeeks: true,
      },
    })

    const overrideMap = new Map(
      overrides.map((o) => [`${o.horseId}:${o.serviceId}`, o.revisitIntervalWeeks])
    )

    // Fetch customer-set intervals per horse+service
    const horseIds = [...new Set(bookings.map((b) => b.horseId).filter(Boolean))] as string[]
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

    // Deduplicate: keep only the latest booking per (horseId, serviceId)
    const latestBookingMap = new Map<string, (typeof bookings)[0]>()
    for (const booking of bookings) {
      if (!booking.horseId || !booking.horse) continue
      const key = `${booking.horseId}:${booking.serviceId}`
      const existing = latestBookingMap.get(key)
      if (!existing || new Date(booking.bookingDate) > new Date(existing.bookingDate)) {
        latestBookingMap.set(key, booking)
      }
    }

    const now = new Date()
    const items: ProviderDueForServiceItem[] = []

    for (const booking of latestBookingMap.values()) {
      const intervalWeeks = resolveInterval(
        booking.service.recommendedIntervalWeeks,
        overrideMap.get(`${booking.horseId!}:${booking.serviceId}`) ?? null,
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
        now
      )

      items.push({
        ...result,
        ownerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      })
    }

    // Filter
    let filteredItems: ProviderDueForServiceItem[] = items
    if (filter === "overdue") {
      filteredItems = items.filter((i) => i.status === "overdue")
    } else if (filter === "upcoming") {
      filteredItems = items.filter((i) => i.status === "upcoming")
    }

    // Sort: overdue first (most overdue at top), then upcoming, then ok
    filteredItems.sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    return NextResponse.json({ items: filteredItems })
  },
)
