import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"

// Validation schema for PATCH updates
const updateStatusSchema = z.object({
  status: z.enum(["cancelled"], { message: "Endast 'cancelled' status är tillåten" }),
})

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
    const { id } = await params

    const routeOrder = await prisma.routeOrder.findUnique({
      where: { id },
      include: {
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
