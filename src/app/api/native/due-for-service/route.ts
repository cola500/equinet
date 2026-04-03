import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  calculateDueStatus,
  resolveInterval,
  type DueForServiceResult,
} from "@/domain/due-for-service/DueForServiceCalculator"

interface NativeDueForServiceItem extends DueForServiceResult {
  ownerName: string
}

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (Dual-auth: Bearer > NextAuth > Supabase)
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    const clientIP = getClientIP(request)
    try {
      await rateLimiters.api(clientIP)
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    // 3. Feature flag
    if (!(await isFeatureEnabled("due_for_service"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    // 4. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    const filter = request.nextUrl.searchParams.get("filter") || "all"

    // 5. Fetch completed bookings with horses and services
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
        horse: { select: { id: true, name: true } },
        customer: { select: { firstName: true, lastName: true } },
        service: {
          select: { id: true, name: true, recommendedIntervalWeeks: true },
        },
      },
      orderBy: { bookingDate: "desc" },
    })

    // 6. Fetch interval overrides
    const overrides = await prisma.horseServiceInterval.findMany({
      where: { providerId: provider.id },
      select: { horseId: true, serviceId: true, revisitIntervalWeeks: true },
    })

    const overrideMap = new Map(
      overrides.map((o) => [`${o.horseId}:${o.serviceId}`, o.revisitIntervalWeeks])
    )

    // 7. Fetch customer-set intervals
    const horseIds = [
      ...new Set(bookings.map((b) => b.horseId).filter(Boolean)),
    ] as string[]
    const customerIntervals =
      horseIds.length > 0
        ? await prisma.customerHorseServiceInterval.findMany({
            where: { horseId: { in: horseIds } },
            select: { horseId: true, serviceId: true, intervalWeeks: true },
          })
        : []

    const customerIntervalMap = new Map(
      customerIntervals.map((ci) => [
        `${ci.horseId}:${ci.serviceId}`,
        ci.intervalWeeks,
      ])
    )

    // 8. Deduplicate: keep only latest booking per (horseId, serviceId)
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

    // 9. Calculate status
    const now = new Date()
    const items: NativeDueForServiceItem[] = []

    for (const booking of latestBookingMap.values()) {
      const intervalWeeks = resolveInterval(
        booking.service.recommendedIntervalWeeks,
        overrideMap.get(`${booking.horseId!}:${booking.serviceId}`) ?? null,
        customerIntervalMap.get(`${booking.horseId!}:${booking.serviceId}`) ?? null
      )

      if (intervalWeeks === null) continue

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

    // 10. Filter
    let filteredItems: NativeDueForServiceItem[] = items
    if (filter === "overdue") {
      filteredItems = items.filter((i) => i.status === "overdue")
    } else if (filter === "upcoming") {
      filteredItems = items.filter((i) => i.status === "upcoming")
    }

    // 11. Sort by urgency (lowest daysUntilDue first = most overdue first)
    filteredItems.sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    return NextResponse.json({ items: filteredItems })
  } catch (error) {
    logger.error("Native due-for-service error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
