import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/route-orders/my-orders - Get customer's own route orders
export async function GET() {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Only customers can view their route orders
    if (session.user.userType !== "customer") {
      return NextResponse.json(
        { error: "Endast kunder kan se sina rutt-beställningar" },
        { status: 403 }
      )
    }

    // 2. Fetch route orders
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
    console.error("Error fetching route orders:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
