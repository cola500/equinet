/**
 * GET /api/native/customers - Customer list for native iOS app
 * POST /api/native/customers - Add customer manually
 *
 * Auth: Bearer token (mobile token).
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { sanitizeString, sanitizePhone, sanitizeEmail, stripXss } from "@/lib/sanitize"
import { createGhostUser } from "@/lib/ghost-user"

const addCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().default(""),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
}).strict()

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (Bearer token)
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Parse query params
    const status = request.nextUrl.searchParams.get("status") || "all"
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase()

    // 5. DB aggregation: booking stats per customer
    const stats = await prisma.booking.groupBy({
      by: ["customerId"],
      where: {
        providerId: provider.id,
        status: { in: ["completed", "no_show"] },
      },
      _count: { id: true },
      _max: { bookingDate: true },
    })

    const noShows = await prisma.booking.groupBy({
      by: ["customerId"],
      where: {
        providerId: provider.id,
        status: "no_show",
      },
      _count: { id: true },
    })

    const customerIds = stats.map((s) => s.customerId)
    const noShowMap = new Map(noShows.map((n) => [n.customerId, n._count.id]))

    // 6. Fetch customer details
    const customerRows = customerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        })
      : []

    // 7. Fetch unique horses per customer
    const horseRows = customerIds.length > 0
      ? await prisma.booking.findMany({
          where: {
            providerId: provider.id,
            customerId: { in: customerIds },
            horseId: { not: null },
          },
          select: {
            customerId: true,
            horse: { select: { id: true, name: true } },
          },
          distinct: ["customerId", "horseId"],
        })
      : []

    // Build maps
    const horseMap = new Map<string, { id: string; name: string }[]>()
    for (const row of horseRows) {
      if (!row.horse) continue
      const list = horseMap.get(row.customerId) || []
      list.push({ id: row.horse.id, name: row.horse.name })
      horseMap.set(row.customerId, list)
    }

    const customerLookup = new Map(customerRows.map((c) => [c.id, c]))

    // 8. Assemble customer summaries
    interface CustomerSummary {
      id: string
      firstName: string
      lastName: string
      email: string
      phone: string | null
      bookingCount: number
      noShowCount: number
      lastBookingDate: string | null
      horses: { id: string; name: string }[]
      isManuallyAdded?: boolean
    }

    const customerMap = new Map<string, CustomerSummary>()
    for (const stat of stats) {
      const cust = customerLookup.get(stat.customerId)
      if (!cust) continue
      customerMap.set(stat.customerId, {
        id: cust.id,
        firstName: cust.firstName,
        lastName: cust.lastName,
        email: cust.email,
        phone: cust.phone,
        bookingCount: stat._count.id,
        noShowCount: noShowMap.get(stat.customerId) || 0,
        lastBookingDate: stat._max.bookingDate
          ? stat._max.bookingDate.toISOString()
          : null,
        horses: horseMap.get(stat.customerId) || [],
      })
    }

    // 9. Merge manually added customers
    const manualCustomers = await prisma.providerCustomer.findMany({
      where: { providerId: provider.id },
      select: {
        customerId: true,
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
    })

    for (const mc of manualCustomers) {
      if (!customerMap.has(mc.customerId)) {
        customerMap.set(mc.customerId, {
          id: mc.customer.id,
          firstName: mc.customer.firstName,
          lastName: mc.customer.lastName,
          email: mc.customer.email,
          phone: mc.customer.phone,
          bookingCount: 0,
          noShowCount: 0,
          lastBookingDate: null,
          horses: [],
          isManuallyAdded: true,
        })
      }
    }

    let customers = Array.from(customerMap.values())

    // 10. Filter by status
    if (status === "active" || status === "inactive") {
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

      customers = customers.filter((c) => {
        if (!c.lastBookingDate) return status === "inactive"
        const isActive = new Date(c.lastBookingDate) >= twelveMonthsAgo
        return status === "active" ? isActive : !isActive
      })
    }

    // 11. Filter by search query
    if (query) {
      customers = customers.filter((c) => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase()
        return (
          fullName.includes(query) ||
          c.email.toLowerCase().includes(query)
        )
      })
    }

    // 12. Sort by last booking date (most recent first, null last)
    customers.sort((a, b) => {
      if (!a.lastBookingDate && !b.lastBookingDate) return 0
      if (!a.lastBookingDate) return 1
      if (!b.lastBookingDate) return -1
      return new Date(b.lastBookingDate).getTime() - new Date(a.lastBookingDate).getTime()
    })

    logger.info("Native customers fetched", {
      userId: authResult.userId,
      providerId: provider.id,
      count: customers.length,
    })

    return NextResponse.json({ customers })
  } catch (error) {
    logger.error("Failed to fetch native customers", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta kundlistan" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Validate
    const parsed = addCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 5. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 6. Sanitize
    const firstName = sanitizeString(stripXss(parsed.data.firstName))
    const lastName = sanitizeString(stripXss(parsed.data.lastName || ""))
    const phone = parsed.data.phone ? sanitizePhone(parsed.data.phone) : undefined
    const email = parsed.data.email ? sanitizeEmail(parsed.data.email) : undefined

    // 7. Create ghost user
    const customerId = await createGhostUser({ firstName, lastName, phone, email })

    // 8. Check for duplicate
    const existing = await prisma.providerCustomer.findUnique({
      where: {
        providerId_customerId: {
          providerId: provider.id,
          customerId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Kunden finns redan i ditt kundregister" },
        { status: 409 }
      )
    }

    // 9. Create link
    await prisma.providerCustomer.create({
      data: {
        providerId: provider.id,
        customerId,
      },
    })

    logger.info("Native customer created", {
      userId: authResult.userId,
      providerId: provider.id,
      customerId,
    })

    return NextResponse.json(
      { customer: { id: customerId } },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Failed to create native customer", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte lägga till kund" },
      { status: 500 }
    )
  }
}
