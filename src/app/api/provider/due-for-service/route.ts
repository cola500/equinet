import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

type DueStatus = "overdue" | "upcoming" | "ok"

interface DueForServiceItem {
  horseId: string
  horseName: string
  ownerName: string
  serviceName: string
  serviceId: string
  lastServiceDate: string
  daysSinceService: number
  intervalWeeks: number
  dueDate: string
  daysUntilDue: number
  status: DueStatus
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

    // Fetch completed bookings with horses and services that have interval
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: "completed",
        horseId: { not: null },
        service: {
          recommendedIntervalWeeks: { not: null },
        },
      },
      select: {
        id: true,
        horseId: true,
        serviceId: true,
        customerId: true,
        bookingDate: true,
        updatedAt: true,
        horse: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, firstName: true, lastName: true },
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

    // Deduplicate: keep only the latest booking per (horseId, serviceId)
    const latestBookingMap = new Map<string, typeof bookings[0]>()
    for (const booking of bookings) {
      if (!booking.horseId || !booking.horse) continue
      const key = `${booking.horseId}:${booking.serviceId}`
      const existing = latestBookingMap.get(key)
      if (!existing || new Date(booking.bookingDate) > new Date(existing.bookingDate)) {
        latestBookingMap.set(key, booking)
      }
    }

    const now = new Date()
    const items: DueForServiceItem[] = []

    for (const booking of latestBookingMap.values()) {
      const serviceInterval = booking.service.recommendedIntervalWeeks!
      const intervalWeeks = overrideMap.get(booking.horseId!) ?? serviceInterval

      const lastServiceDate = new Date(booking.bookingDate)
      const dueDate = new Date(lastServiceDate)
      dueDate.setDate(dueDate.getDate() + intervalWeeks * 7)

      const daysSinceService = Math.floor(
        (now.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      let status: DueStatus
      if (daysUntilDue < 0) {
        status = "overdue"
      } else if (daysUntilDue <= 14) {
        status = "upcoming"
      } else {
        status = "ok"
      }

      items.push({
        horseId: booking.horse!.id,
        horseName: booking.horse!.name,
        ownerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        serviceName: booking.service.name,
        serviceId: booking.service.id,
        lastServiceDate: lastServiceDate.toISOString(),
        daysSinceService,
        intervalWeeks,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        status,
      })
    }

    // Filter
    let filteredItems = items
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
