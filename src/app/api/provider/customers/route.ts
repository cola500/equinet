import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sanitizeString, sanitizePhone, sanitizeEmail, stripXss } from "@/lib/sanitize"
import { createGhostUser } from "@/lib/ghost-user"

const addCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().default(''),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
}).strict()

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
  lastInviteSentAt?: string | null
  lastInviteExpiresAt?: string | null
}

// GET /api/provider/customers?status=all|active|inactive&q=searchterm
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user, request }) => {
    const { userId } = user

    // Get provider
    const provider = await prisma.provider.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    // Parse query params
    const status = request.nextUrl.searchParams.get("status") || "all"
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase()

    // DB-aggregation: booking stats per customer (replaces take:10000 + JS loop)
    const stats = await prisma.booking.groupBy({
      by: ['customerId'],
      where: {
        providerId: provider.id,
        status: { in: ['completed', 'no_show'] },
      },
      _count: { id: true },
      _max: { bookingDate: true },
    })

    const noShows = await prisma.booking.groupBy({
      by: ['customerId'],
      where: {
        providerId: provider.id,
        status: 'no_show',
      },
      _count: { id: true },
    })

    const customerIds = stats.map((s) => s.customerId)
    const noShowMap = new Map(noShows.map((n) => [n.customerId, n._count.id]))

    // Fetch customer details for aggregated IDs
    const customerRows = customerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        })
      : []

    // Fetch unique horses per customer
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
          distinct: ['customerId', 'horseId'],
        })
      : []

    // Build horse map: customerId -> unique horses
    const horseMap = new Map<string, { id: string; name: string }[]>()
    for (const row of horseRows) {
      if (!row.horse) continue
      const list = horseMap.get(row.customerId) || []
      list.push({ id: row.horse.id, name: row.horse.name })
      horseMap.set(row.customerId, list)
    }

    // Build customer lookup
    const customerLookup = new Map(customerRows.map((c) => [c.id, c]))

    // Assemble CustomerSummary map
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

    // Fetch manually added customers (ProviderCustomer junction table)
    const manualCustomers = await prisma.providerCustomer.findMany({
      where: { providerId: provider.id },
      select: {
        customerId: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    // Merge manual customers -- booking customers take priority (richer data)
    const manualCustomerIds: string[] = []
    for (const mc of manualCustomers) {
      if (!customerMap.has(mc.customerId)) {
        manualCustomerIds.push(mc.customerId)
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
          lastInviteSentAt: null,
          lastInviteExpiresAt: null,
        })
      }
    }

    // Attach latest active invite token to manual customers
    if (manualCustomerIds.length > 0) {
      const now = new Date()
      const tokens = await prisma.customerInviteToken.findMany({
        where: {
          invitedByProviderId: provider.id,
          userId: { in: manualCustomerIds },
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        select: { userId: true, createdAt: true, expiresAt: true },
      })
      const tokenMap = new Map<string, { createdAt: Date; expiresAt: Date }>()
      for (const t of tokens) {
        if (!tokenMap.has(t.userId)) tokenMap.set(t.userId, t)
      }
      for (const customerId of manualCustomerIds) {
        const summary = customerMap.get(customerId)
        const token = tokenMap.get(customerId)
        if (summary && token) {
          summary.lastInviteSentAt = token.createdAt.toISOString()
          summary.lastInviteExpiresAt = token.expiresAt.toISOString()
        }
      }
    }

    let customers = Array.from(customerMap.values())

    // Filter by status
    if (status === "active" || status === "inactive") {
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

      customers = customers.filter((c) => {
        if (!c.lastBookingDate) return status === "inactive"
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

    // Sort by last booking date (most recent first, null last)
    customers.sort((a, b) => {
      if (!a.lastBookingDate && !b.lastBookingDate) return 0
      if (!a.lastBookingDate) return 1
      if (!b.lastBookingDate) return -1
      return new Date(b.lastBookingDate).getTime() - new Date(a.lastBookingDate).getTime()
    })

    return NextResponse.json({ customers })
  },
)

// POST /api/provider/customers -- Add a customer manually
export const POST = withApiHandler(
  { auth: "provider", schema: addCustomerSchema },
  async ({ user, body }) => {
    const { userId } = user

    // Get provider
    const provider = await prisma.provider.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    // Sanitize
    const firstName = sanitizeString(stripXss(body.firstName))
    const lastName = sanitizeString(stripXss(body.lastName || ''))
    const phone = body.phone ? sanitizePhone(body.phone) : undefined
    const email = body.email ? sanitizeEmail(body.email) : undefined

    // Create ghost user (or reuse existing by email)
    const customerId = await createGhostUser({ firstName, lastName, phone, email })

    // Check for duplicate
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

    // Create link
    await prisma.providerCustomer.create({
      data: {
        providerId: provider.id,
        customerId,
      },
    })

    return NextResponse.json(
      { customer: { id: customerId } },
      { status: 201 }
    )
  },
)
