import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"
import { z } from "zod"

const putSchema = z
  .object({
    serviceId: z.string().uuid(),
    intervalWeeks: z.number().int().min(1).max(104),
  })
  .strict()

const deleteSchema = z
  .object({
    serviceId: z.string().uuid(),
  })
  .strict()

type RouteContext = { params: Promise<{ horseId: string }> }

/**
 * Shared auth + feature flag + ownership check for all methods.
 */
async function authorizeCustomer(request: NextRequest, context: RouteContext) {
  const session = await auth()

  if (session.user.userType !== "customer") {
    return {
      error: NextResponse.json(
        { error: "Bara kunder har tillgång" },
        { status: 403 }
      ),
    }
  }

  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return {
      error: NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      ),
    }
  }

  const enabled = await isFeatureEnabled("due_for_service")
  if (!enabled) {
    return { featureDisabled: true, customerId: session.user.id, horseId: "" }
  }

  const { horseId } = await context.params

  // Ownership check: horse must belong to customer
  const horse = await prisma.horse.findFirst({
    where: { id: horseId, ownerId: session.user.id },
    select: { id: true },
  })

  if (!horse) {
    return {
      error: NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      ),
    }
  }

  return { customerId: session.user.id, horseId }
}

// GET /api/customer/horses/[horseId]/intervals
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authorizeCustomer(request, context)
    if ("error" in authResult) return authResult.error
    if ("featureDisabled" in authResult) {
      return NextResponse.json({ intervals: [] })
    }

    const { horseId } = authResult

    const [intervals, bookings] = await Promise.all([
      prisma.customerHorseServiceInterval.findMany({
        where: { horseId },
        select: {
          id: true,
          serviceId: true,
          intervalWeeks: true,
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
      prisma.booking.findMany({
        where: { horseId, status: { in: ["completed", "confirmed"] } },
        select: {
          service: {
            select: {
              id: true,
              name: true,
              recommendedIntervalWeeks: true,
            },
          },
        },
        orderBy: { bookingDate: "desc" },
      }),
    ])

    // Deduplicate services from booking history
    const serviceMap = new Map<string, { id: string; name: string; recommendedIntervalWeeks: number | null }>()
    for (const booking of bookings) {
      if (!serviceMap.has(booking.service.id)) {
        serviceMap.set(booking.service.id, booking.service)
      }
    }
    const availableServices = Array.from(serviceMap.values())

    return NextResponse.json({ intervals, availableServices })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to fetch customer horse intervals",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte hämta intervall" },
      { status: 500 }
    )
  }
}

// PUT /api/customer/horses/[horseId]/intervals
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authorizeCustomer(request, context)
    if ("error" in authResult) return authResult.error
    if ("featureDisabled" in authResult) {
      return NextResponse.json({ intervals: [] })
    }

    const { horseId } = authResult

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = putSchema.parse(body)

    const interval = await prisma.customerHorseServiceInterval.upsert({
      where: {
        horseId_serviceId: {
          horseId,
          serviceId: validated.serviceId,
        },
      },
      create: {
        horseId,
        serviceId: validated.serviceId,
        intervalWeeks: validated.intervalWeeks,
      },
      update: {
        intervalWeeks: validated.intervalWeeks,
      },
      select: {
        id: true,
        horseId: true,
        serviceId: true,
        intervalWeeks: true,
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

    logger.error(
      "Failed to update customer horse interval",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte uppdatera intervall" },
      { status: 500 }
    )
  }
}

// DELETE /api/customer/horses/[horseId]/intervals
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authorizeCustomer(request, context)
    if ("error" in authResult) return authResult.error
    if ("featureDisabled" in authResult) {
      return NextResponse.json({ intervals: [] })
    }

    const { horseId } = authResult

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = deleteSchema.parse(body)

    await prisma.customerHorseServiceInterval.delete({
      where: {
        horseId_serviceId: {
          horseId,
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
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Inget intervall att ta bort" },
        { status: 404 }
      )
    }

    logger.error(
      "Failed to delete customer horse interval",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte ta bort intervall" },
      { status: 500 }
    )
  }
}
