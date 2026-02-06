import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

interface CustomerSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  bookingCount: number
  lastBookingDate: string
  horses: { id: string; name: string }[]
}

// GET /api/provider/customers?status=all|active|inactive&q=searchterm
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Provider-only endpoint
    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantorer kan se kundlistan" },
        { status: 403 }
      )
    }

    // Rate limiting
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "For manga forfragningar. Forsok igen om en minut." },
        { status: 429 }
      )
    }

    // Get provider
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

    // Parse query params
    const status = request.nextUrl.searchParams.get("status") || "all"
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase()

    // Fetch all completed bookings for this provider (IDOR protection: providerId filter)
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: "completed",
      },
      select: {
        id: true,
        customerId: true,
        bookingDate: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        horse: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { bookingDate: "desc" },
    })

    // Aggregate: group by customer
    const customerMap = new Map<string, CustomerSummary>()

    for (const booking of bookings) {
      const existing = customerMap.get(booking.customerId)

      if (existing) {
        existing.bookingCount++
        // Update lastBookingDate if this is more recent
        if (booking.bookingDate.toISOString() > existing.lastBookingDate) {
          existing.lastBookingDate = booking.bookingDate.toISOString()
        }
        // Add horse if unique
        if (booking.horse && !existing.horses.some((h) => h.id === booking.horse!.id)) {
          existing.horses.push({ id: booking.horse.id, name: booking.horse.name })
        }
      } else {
        customerMap.set(booking.customerId, {
          id: booking.customer.id,
          firstName: booking.customer.firstName,
          lastName: booking.customer.lastName,
          email: booking.customer.email,
          phone: booking.customer.phone,
          bookingCount: 1,
          lastBookingDate: booking.bookingDate.toISOString(),
          horses: booking.horse
            ? [{ id: booking.horse.id, name: booking.horse.name }]
            : [],
        })
      }
    }

    let customers = Array.from(customerMap.values())

    // Filter by status
    if (status === "active" || status === "inactive") {
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

      customers = customers.filter((c) => {
        const isActive = new Date(c.lastBookingDate) >= twelveMonthsAgo
        return status === "active" ? isActive : !isActive
      })
    }

    // Filter by search query (name or email)
    if (query) {
      customers = customers.filter((c) => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase()
        return (
          fullName.includes(query) ||
          c.email.toLowerCase().includes(query)
        )
      })
    }

    // Sort by last booking date (most recent first)
    customers.sort(
      (a, b) =>
        new Date(b.lastBookingDate).getTime() -
        new Date(a.lastBookingDate).getTime()
    )

    return NextResponse.json({ customers })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error(
      "Failed to fetch provider customers",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte hamta kundlistan" },
      { status: 500 }
    )
  }
}
