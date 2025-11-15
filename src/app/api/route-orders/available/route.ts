import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { calculateDistance } from "@/lib/distance"

// GET /api/route-orders/available - Get available route orders for providers
export async function GET(request: Request) {
  try {
    // Auth handled by middleware
    const session = await auth()

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

    // 3. Fetch available route orders (status = pending)
    const whereClause: any = {
      status: 'pending'
    }

    if (serviceType) {
      whereClause.serviceType = serviceType
    }

    if (priority) {
      whereClause.priority = priority
    }

    const routeOrders = await prisma.routeOrder.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 4. Calculate distance from provider for each order
    // For MVP, we use Göteborg centrum as provider location
    const providerLat = 57.7089 // Göteborg centrum
    const providerLon = 11.9746

    const ordersWithDistance = routeOrders.map(order => {
      const distance = calculateDistance(
        providerLat,
        providerLon,
        order.latitude,
        order.longitude
      )

      return {
        ...order,
        distanceKm: Math.round(distance * 10) / 10 // Round to 1 decimal
      }
    })

    // 5. Sort by distance
    ordersWithDistance.sort((a, b) => a.distanceKm - b.distanceKm)

    return NextResponse.json(ordersWithDistance)

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error fetching available route orders:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
