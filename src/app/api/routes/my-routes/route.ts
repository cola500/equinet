import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

// GET /api/routes/my-routes - Get provider's routes
export async function GET(request: Request) {
  try {
    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    // Auth handled by middleware
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
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
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching routes", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
