import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

// GET /api/route-orders/my-orders - Get customer's own route orders
export async function GET() {
  try {
    // Auth handled by middleware
    const session = await auth()

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
      include: {
        routeStops: {
          include: {
            route: {
              include: {
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

    console.error("Error fetching route orders:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
