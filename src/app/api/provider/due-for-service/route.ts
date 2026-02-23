import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import {
  calculateDueStatus,
  resolveInterval,
  type DueForServiceResult,
} from "@/domain/due-for-service/DueForServiceCalculator"

interface ProviderDueForServiceItem extends DueForServiceResult {
  ownerName: string
}

// GET /api/provider/due-for-service?filter=all|overdue|upcoming
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantorer har tillgang" },
        { status: 403 }
      )
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "For manga forfragningar" },
        { status: 429 }
      )
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
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

    // Fetch all horse-specific overrides for this provider
    const overrides = await prisma.horseServiceInterval.findMany({
      where: { providerId: provider.id },
      select: {
        horseId: true,
        revisitIntervalWeeks: true,
      },
    })

    const overrideMap = new Map(
      overrides.map((o) => [o.horseId, o.revisitIntervalWeeks])
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
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to fetch due-for-service",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte hamta besoksplanering" },
      { status: 500 }
    )
  }
}
