import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

// GET /api/route-orders/my-orders - Get customer's own route orders
export async function GET(request: Request) {
  try {
    // Auth handled by middleware
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    // Only customers can view their route orders
    if (session.user.userType !== "customer") {
      return NextResponse.json(
        { error: "Endast kunder kan se sina rutt-beställningar" },
        { status: 403 }
      )
    }

    // Fetch route orders
    const routeOrders = await prisma.routeOrder.findMany({
      where: {
        customerId: session.user.id,
      },
      select: {
        id: true,
        serviceType: true,
        address: true,
        municipality: true,
        dateFrom: true,
        dateTo: true,
        priority: true,
        status: true,
        specialInstructions: true,
        announcementType: true,
        createdAt: true,
        customerId: true,
        routeStops: {
          select: {
            id: true,
            stopOrder: true,
            locationName: true,
            address: true,
            latitude: true,
            longitude: true,
            estimatedArrival: true,
            status: true,
            route: {
              select: {
                id: true,
                routeName: true,
                routeDate: true,
                status: true,
                provider: {
                  select: {
                    businessName: true,
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(routeOrders)

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching route orders", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
