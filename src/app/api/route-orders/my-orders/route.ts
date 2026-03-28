import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

// GET /api/route-orders/my-orders - Get customer's own route orders
export const GET = withApiHandler(
  { auth: "customer", featureFlag: "route_planning" },
  async ({ user }) => {
    // Fetch route orders
    const routeOrders = await prisma.routeOrder.findMany({
      where: {
        customerId: user.userId,
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
  },
)
