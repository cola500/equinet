import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

const intervalSchema = z.object({
  serviceId: z.string().uuid(),
  revisitIntervalWeeks: z.number().int().min(1).max(52),
  notes: z.string().max(500).optional().nullable(),
}).strict()

const deleteSchema = z.object({
  serviceId: z.string().uuid(),
}).strict()

type RouteContext = { params: Promise<{ horseId: string }> }

/**
 * Shared auth + access check for all methods
 */
async function authorizeProvider(request: NextRequest, context: RouteContext) {
  const session = await auth()

  if (session.user.userType !== "provider") {
    return { error: NextResponse.json({ error: "Bara leverantorer har tillgang" }, { status: 403 }) }
  }

  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return { error: NextResponse.json({ error: "For manga forfragningar" }, { status: 429 }) }
  }

  const provider = await prisma.provider.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!provider) {
    return { error: NextResponse.json({ error: "Leverantorsprofil hittades inte" }, { status: 404 }) }
  }

  const { horseId } = await context.params

  // Access check: provider must have at least one booking for this horse
  const bookingCount = await prisma.booking.count({
    where: {
      horseId,
      provider: { userId: session.user.id },
    },
  })

  if (bookingCount === 0) {
    return { error: NextResponse.json({ error: "Du har inga bokningar for denna hast" }, { status: 403 }) }
  }

  return { providerId: provider.id, horseId }
}

// GET /api/provider/horses/[horseId]/interval
// Returns: { intervals: [...], availableServices: [...] }
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authorizeProvider(request, context)
    if ("error" in authResult) return authResult.error

    const { providerId, horseId } = authResult

    const [intervals, availableServices] = await Promise.all([
      prisma.horseServiceInterval.findMany({
        where: { horseId, providerId },
        select: {
          id: true,
          serviceId: true,
          revisitIntervalWeeks: true,
          notes: true,
          service: {
            select: {
              id: true,
              name: true,
              recommendedIntervalWeeks: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.service.findMany({
        where: { providerId, isActive: true },
        select: {
          id: true,
          name: true,
          recommendedIntervalWeeks: true,
        },
        orderBy: { name: "asc" },
      }),
    ])

    return NextResponse.json({ intervals, availableServices })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Failed to fetch horse interval", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Kunde inte hamta intervall" }, { status: 500 })
  }
}

// PUT /api/provider/horses/[horseId]/interval
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authorizeProvider(request, context)
    if ("error" in authResult) return authResult.error

    const { providerId, horseId } = authResult

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = intervalSchema.parse(body)

    const interval = await prisma.horseServiceInterval.upsert({
      where: {
        horseId_providerId_serviceId: {
          horseId,
          providerId,
          serviceId: validated.serviceId,
        },
      },
      create: {
        horseId,
        providerId,
        serviceId: validated.serviceId,
        revisitIntervalWeeks: validated.revisitIntervalWeeks,
        notes: validated.notes ?? null,
      },
      update: {
        revisitIntervalWeeks: validated.revisitIntervalWeeks,
        notes: validated.notes ?? null,
      },
      select: {
        id: true,
        serviceId: true,
        revisitIntervalWeeks: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(interval)
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to update horse interval", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Kunde inte uppdatera intervall" }, { status: 500 })
  }
}

// DELETE /api/provider/horses/[horseId]/interval
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authorizeProvider(request, context)
    if ("error" in authResult) return authResult.error

    const { providerId, horseId } = authResult

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = deleteSchema.parse(body)

    await prisma.horseServiceInterval.delete({
      where: {
        horseId_providerId_serviceId: {
          horseId,
          providerId,
          serviceId: validated.serviceId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    // P2025: Record not found
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Inget intervall att ta bort" }, { status: 404 })
    }

    logger.error("Failed to delete horse interval", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Kunde inte ta bort intervall" }, { status: 500 })
  }
}
