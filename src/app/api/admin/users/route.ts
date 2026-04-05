import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const type = searchParams.get("type") || ""
    const verified = searchParams.get("verified")
    const active = searchParams.get("active")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))

    const isProviderFilter = type === "provider"

    const where: Record<string, unknown> = {}

    if (search) {
      const searchConditions: Record<string, unknown>[] = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ]
      if (isProviderFilter) {
        searchConditions.push({
          provider: { businessName: { contains: search, mode: "insensitive" } },
        })
      }
      where.OR = searchConditions
    }

    if (type === "customer" || type === "provider") {
      where.userType = type
    }

    // Provider-specifika filter
    if (isProviderFilter) {
      const providerFilter: Record<string, unknown> = {}
      if (verified === "true") providerFilter.isVerified = true
      if (verified === "false") providerFilter.isVerified = false
      if (active === "true") providerFilter.isActive = true
      if (active === "false") providerFilter.isActive = false
      if (Object.keys(providerFilter).length > 0) {
        where.provider = providerFilter
      }
    }

    // Utökad provider-select vid provider-filter
    const providerSelect = isProviderFilter
      ? {
          select: {
            id: true,
            businessName: true,
            isVerified: true,
            isActive: true,
            city: true,
            _count: { select: { bookings: true, services: true } },
            fortnoxConnection: { select: { id: true } },
          },
        }
      : {
          select: {
            businessName: true,
            isVerified: true,
            isActive: true,
          },
        }

    const [usersRaw, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          userType: true,
          isAdmin: true,
          isBlocked: true,
          createdAt: true,
          emailVerified: true,
          provider: providerSelect,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    // Aggregera review-statistik via groupBy (istället för att hämta alla reviews)
    let reviewStatsMap = new Map<string, { avg: number | null; count: number }>()
    if (isProviderFilter) {
      const providerIds = usersRaw
        .filter((u) => u.provider)
        .map((u) => (u.provider as { id: string }).id)

      if (providerIds.length > 0) {
        const reviewStats = await prisma.review.groupBy({
          by: ["providerId"],
          where: { providerId: { in: providerIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
        reviewStatsMap = new Map(
          reviewStats.map((s) => [s.providerId, { avg: s._avg.rating, count: s._count._all }])
        )
      }
    }

    // Mappa utökad provider-data
    type UserRow = (typeof usersRaw)[number]
    const users = usersRaw.map((user: UserRow) => {
      if (!isProviderFilter || !user.provider) return user

      // Cast to the extended provider shape (only present when isProviderFilter)
      const p = user.provider as {
        id: string
        businessName: string
        isVerified: boolean
        isActive: boolean
        city?: string | null
        _count: { bookings: number; services: number }
        fortnoxConnection: { id: string } | null
      }
      const stats = reviewStatsMap.get(p.id)

      return {
        ...user,
        provider: {
          businessName: p.businessName,
          isVerified: p.isVerified,
          isActive: p.isActive,
          city: p.city,
          bookingCount: p._count.bookings,
          serviceCount: p._count.services,
          averageRating: stats?.avg ?? null,
          hasFortnox: !!p.fortnoxConnection,
        },
      }
    })

    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  },
)

// ============================================================
// PATCH -- Admin actions (block/unblock, toggle admin)
// ============================================================

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["toggleBlocked", "toggleAdmin"]),
}).strict()

export const PATCH = withApiHandler(
  { auth: "admin", schema: patchSchema },
  async ({ user, body }) => {
    const { userId, action } = body

    // Self-block protection
    if (action === "toggleBlocked" && userId === user.userId) {
      return NextResponse.json(
        { error: "Du kan inte blockera dig själv" },
        { status: 400 }
      )
    }

    // Look up target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBlocked: true, isAdmin: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "Användaren hittades inte" },
        { status: 404 }
      )
    }

    // Self-admin removal protection
    if (action === "toggleAdmin" && userId === user.userId && targetUser.isAdmin) {
      return NextResponse.json(
        { error: "Du kan inte ta bort din egen admin-behörighet" },
        { status: 400 }
      )
    }

    if (action === "toggleBlocked") {
      const newValue = !targetUser.isBlocked
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isBlocked: newValue },
        select: { id: true, isBlocked: true },
      })

      // Create notification when blocking
      if (newValue) {
        await prisma.notification.create({
          data: {
            userId,
            type: "account_blocked",
            message: "Ditt konto har blockerats av en administratör",
          },
        })
      }

      logger.security(`Admin ${action}: user ${userId} isBlocked=${newValue}`, "high", {
        adminId: user.userId,
        targetUserId: userId,
      })

      return NextResponse.json(updated)
    }

    if (action === "toggleAdmin") {
      const newValue = !targetUser.isAdmin
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isAdmin: newValue },
        select: { id: true, isAdmin: true },
      })

      logger.security(`Admin ${action}: user ${userId} isAdmin=${newValue}`, "high", {
        adminId: user.userId,
        targetUserId: userId,
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "Ogiltig åtgärd" }, { status: 400 })
  },
)
