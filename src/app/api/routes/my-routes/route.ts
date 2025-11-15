import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/routes/my-routes - Get provider's routes
export async function GET() {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Only providers can view their routes
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Endast leverantörer kan se sina rutter" },
        { status: 403 }
      )
    }

    // 2. Fetch routes
    const routes = await prisma.route.findMany({
      where: {
        providerId: session.user.providerId,
      },
      include: {
        stops: {
          include: {
            routeOrder: {
              include: {
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                  }
                }
              }
            }
          },
          orderBy: {
            stopOrder: 'asc'
          }
        }
      },
      orderBy: {
        routeDate: 'desc'
      }
    })

    return NextResponse.json(routes)

  } catch (error) {
    console.error("Error fetching routes:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
