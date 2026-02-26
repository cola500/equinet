import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { calculateDistance } from "@/lib/geo/distance"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"

// GET /api/route-orders/available - Get available route orders for providers
export async function GET(request: Request) {
  // Rate limiting: 100 requests per minute per IP
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    // Auth handled by middleware
    const session = await auth()

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    // Only providers can view available route orders
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Endast leverantörer kan se tillgängliga rutt-beställningar" },
        { status: 403 }
      )
    }

    // Get provider location (use their address)
    const provider = await prisma.provider.findUnique({
      where: { id: session.user.providerId }
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const serviceType = searchParams.get('serviceType')
    const priority = searchParams.get('priority')

    // 3. Fetch available route orders (status = open or pending)
    const whereClause: Prisma.RouteOrderWhereInput = {
      status: { in: ['open', 'pending'] }
    }

    if (serviceType) {
      whereClause.serviceType = serviceType
    }

    if (priority) {
      whereClause.priority = priority
    }

    const routeOrders = await prisma.routeOrder.findMany({
      where: whereClause,
      select: {
        id: true,
        serviceType: true,
        address: true,
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
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
        provider: {
          select: {
            businessName: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50,
    })

    // 4. Calculate distance from provider for each order
    // For MVP, we use Göteborg centrum as provider location
    const providerLat = 57.7089 // Göteborg centrum
    const providerLon = 11.9746

    const ordersWithDistance = routeOrders.map((order) => {
      // Only calculate distance if coordinates exist
      const distance = (order.latitude != null && order.longitude != null)
        ? calculateDistance(providerLat, providerLon, order.latitude, order.longitude)
        : Infinity // Orders without coordinates sorted last

      return {
        ...order,
        distanceKm: distance === Infinity ? null : Math.round(distance * 10) / 10
      }
    })

    // 5. Sort by distance (null distances sorted last)
    ordersWithDistance.sort((a, b) => {
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })

    return NextResponse.json(ordersWithDistance)

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching available route orders", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
