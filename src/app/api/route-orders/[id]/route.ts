import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
        { error: "Route order not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(routeOrder)
  } catch (error) {
    console.error("Error fetching route order:", error)
    return NextResponse.json(
      { error: "Failed to fetch route order" },
      { status: 500 }
    )
  }
}
