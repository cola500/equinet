import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

// Validation schema for PATCH updates
const updateStatusSchema = z.object({
  status: z.enum(["cancelled"], { message: "Endast 'cancelled' status är tillåten" }),
})

// Validation schema for PUT updates
const updateRouteSchema = z
  .object({
    municipality: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    specialInstructions: z.string().optional(),
  })
  .strict()

/**
 * GET /api/route-orders/[id]
 *
 * Get a specific route order by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { id } = await params

    const routeOrder = await prisma.routeOrder.findUnique({
      where: { id },
      select: {
        id: true,
        serviceType: true,
        address: true,
        municipality: true,
        latitude: true,
        longitude: true,
        numberOfHorses: true,
        dateFrom: true,
        dateTo: true,
        priority: true,
        status: true,
        specialInstructions: true,
        contactPhone: true,
        announcementType: true,
        createdAt: true,
        provider: {
          select: {
            id: true,
            businessName: true,
            description: true,
            profileImageUrl: true,
            services: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                price: true,
                durationMinutes: true,
              },
            },
          },
        },
        routeStops: {
          orderBy: {
            stopOrder: "asc",
          },
          select: {
            id: true,
            stopOrder: true,
            locationName: true,
            address: true,
            latitude: true,
            longitude: true,
            estimatedArrival: true,
            estimatedDurationMin: true,
            status: true,
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
        },
      },
    })

    if (!routeOrder) {
      return NextResponse.json(
        { error: "Ruttorder hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(routeOrder)
  } catch (error) {
    logger.error("Error fetching route order", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta ruttorder" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/route-orders/[id]
 *
 * Update a route order (e.g., cancel it)
 * - Providers can cancel their own announcements (announcementType: provider_announced)
 * - Customers can cancel their own orders (customerId matches)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { id } = await params

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    // Validate input
    const validated = updateStatusSchema.parse(body)

    const isProvider = session.user.userType === "provider"

    if (isProvider) {
      // Provider cancellation flow
      const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })

      if (!provider) {
        return NextResponse.json(
          { error: "Leverantörsprofil hittades inte" },
          { status: 404 }
        )
      }

      // Update with ownership check in WHERE clause (IDOR protection)
      const updated = await prisma.routeOrder.updateMany({
        where: {
          id,
          providerId: provider.id,
          announcementType: "provider_announced",
          status: { not: "cancelled" },
        },
        data: {
          status: validated.status,
        },
      })

      if (updated.count === 0) {
        const order = await prisma.routeOrder.findUnique({
          where: { id },
          select: { providerId: true, status: true },
        })

        if (!order) {
          return NextResponse.json(
            { error: "Rutt-annons hittades inte" },
            { status: 404 }
          )
        }

        if (order.providerId !== provider.id) {
          return NextResponse.json(
            { error: "Du har inte behörighet att ändra denna rutt-annons" },
            { status: 403 }
          )
        }

        if (order.status === "cancelled") {
          return NextResponse.json(
            { error: "Rutt-annonsen är redan avbruten" },
            { status: 400 }
          )
        }

        return NextResponse.json(
          { error: "Kunde inte uppdatera rutt-annons" },
          { status: 400 }
        )
      }
    } else {
      // Customer cancellation flow
      const updated = await prisma.routeOrder.updateMany({
        where: {
          id,
          customerId: session.user.id,
          status: { notIn: ["cancelled", "completed"] },
        },
        data: {
          status: validated.status,
        },
      })

      if (updated.count === 0) {
        const order = await prisma.routeOrder.findUnique({
          where: { id },
          select: { customerId: true, status: true },
        })

        if (!order) {
          return NextResponse.json(
            { error: "Beställningen hittades inte" },
            { status: 404 }
          )
        }

        if (order.customerId !== session.user.id) {
          return NextResponse.json(
            { error: "Du har inte behörighet att ändra denna beställning" },
            { status: 403 }
          )
        }

        if (order.status === "cancelled") {
          return NextResponse.json(
            { error: "Beställningen är redan avbokad" },
            { status: 400 }
          )
        }

        return NextResponse.json(
          { error: "Kunde inte avboka beställningen" },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true, status: validated.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error updating route order", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/route-orders/[id]
 *
 * Update route details (municipality, dates, special instructions).
 * Sends fire-and-forget notifications to affected customers when
 * municipality or dates change.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { id } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateRouteSchema.parse(body)

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Leverantörsprofil hittades inte" }, { status: 404 })
    }

    const existing = await prisma.routeOrder.findUnique({
      where: { id },
      select: { id: true, providerId: true, municipality: true, dateFrom: true, dateTo: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Rutt-annons hittades inte" }, { status: 404 })
    }

    if (existing.providerId !== provider.id) {
      return NextResponse.json(
        { error: "Du har inte behörighet att ändra denna rutt-annons" },
        { status: 403 }
      )
    }

    const municipalityChanged =
      validated.municipality !== undefined && validated.municipality !== existing.municipality

    const dateFromChanged =
      validated.dateFrom !== undefined &&
      new Date(validated.dateFrom).toISOString().slice(0, 10) !==
        existing.dateFrom.toISOString().slice(0, 10)

    const dateToChanged =
      validated.dateTo !== undefined &&
      new Date(validated.dateTo).toISOString().slice(0, 10) !==
        existing.dateTo.toISOString().slice(0, 10)

    const relevantChanged = municipalityChanged || dateFromChanged || dateToChanged

    const updateData: Record<string, unknown> = {}
    if (validated.municipality !== undefined) updateData.municipality = validated.municipality
    if (validated.dateFrom !== undefined) updateData.dateFrom = new Date(validated.dateFrom)
    if (validated.dateTo !== undefined) updateData.dateTo = new Date(validated.dateTo)
    if (validated.specialInstructions !== undefined)
      updateData.specialInstructions = validated.specialInstructions

    const updated = await prisma.routeOrder.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        municipality: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        serviceType: true,
        specialInstructions: true,
      },
    })

    if (relevantChanged) {
      prisma.booking
        .findMany({
          where: { routeOrderId: id, status: "confirmed" },
          select: { id: true, customerId: true },
        })
        .then(async (bookings) => {
          const uniqueCustomerIds = [...new Set(bookings.map((b) => b.customerId))]
          for (const customerId of uniqueCustomerIds) {
            await prisma.notification.create({
              data: {
                userId: customerId,
                type: "route_announcement_updated",
                message:
                  "En ruttannons du har bokat på har uppdaterats. Kontrollera att din bokning fortfarande stämmer.",
              },
            })
          }
        })
        .catch((err) => {
          logger.error(
            "Failed to send route update notifications",
            err instanceof Error ? err : new Error(String(err))
          )
        })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error(
      "Error updating route order",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
