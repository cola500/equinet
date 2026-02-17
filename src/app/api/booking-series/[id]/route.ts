import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }

  // 2. Rate limit
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  const { id } = await params

  try {
    // 3. Fetch series with bookings
    const series = await prisma.bookingSeries.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        serviceId: true,
        horseId: true,
        intervalWeeks: true,
        totalOccurrences: true,
        createdCount: true,
        startTime: true,
        status: true,
        cancelledAt: true,
        createdAt: true,
        service: {
          select: {
            name: true,
            price: true,
            durationMinutes: true,
          },
        },
        bookings: {
          select: {
            id: true,
            bookingDate: true,
            startTime: true,
            endTime: true,
            status: true,
          },
          orderBy: { bookingDate: "asc" },
        },
      },
    })

    if (!series) {
      return NextResponse.json({ error: "Bokningsserien hittades inte" }, { status: 404 })
    }

    // 4. Ownership check
    const user = session.user as any
    const isCustomer = series.customerId === user.id
    const isProvider = user.providerId && series.providerId === user.providerId
    if (!isCustomer && !isProvider) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    return NextResponse.json(series)
  } catch (error) {
    logger.error("Error fetching booking series", { error, seriesId: id })
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
