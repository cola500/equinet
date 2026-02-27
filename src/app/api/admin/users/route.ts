import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    await requireAdmin(session)

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
            businessName: true,
            isVerified: true,
            isActive: true,
            city: true,
            _count: { select: { bookings: true, services: true } },
            reviews: { select: { rating: true } },
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

    // Mappa utökad provider-data
    type UserRow = (typeof usersRaw)[number]
    const users = usersRaw.map((user: UserRow) => {
      if (!isProviderFilter || !user.provider) return user

      // Cast to the extended provider shape (only present when isProviderFilter)
      const p = user.provider as {
        businessName: string
        isVerified: boolean
        isActive: boolean
        city?: string | null
        _count: { bookings: number; services: number }
        reviews: { rating: number }[]
        fortnoxConnection: { id: string } | null
      }
      const avgRating =
        p.reviews?.length > 0
          ? p.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / p.reviews.length
          : null

      return {
        ...user,
        provider: {
          businessName: p.businessName,
          isVerified: p.isVerified,
          isActive: p.isActive,
          city: p.city,
          bookingCount: p._count.bookings,
          serviceCount: p._count.services,
          averageRating: avgRating,
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
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    logger.error("Failed to fetch admin users", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH -- Admin actions (block/unblock, toggle admin)
// ============================================================

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["toggleBlocked", "toggleAdmin"]),
}).strict()

export async function PATCH(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    const admin = await requireAdmin(session)

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = patchSchema.parse(body)
    const { userId, action } = parsed

    // Self-block protection
    if (action === "toggleBlocked" && userId === admin.id) {
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
    if (action === "toggleAdmin" && userId === admin.id && targetUser.isAdmin) {
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
        adminId: admin.id,
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
        adminId: admin.id,
        targetUserId: userId,
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "Ogiltig åtgärd" }, { status: 400 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to perform admin user action", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
