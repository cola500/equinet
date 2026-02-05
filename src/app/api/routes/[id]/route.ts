import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// GET /api/routes/:id - Get specific route
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth handled by middleware
    const session = await auth()

    // Only providers can view routes
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Endast leverantörer kan se rutter" },
        { status: 403 }
      )
    }

    // 2. Fetch route
    const route = await prisma.route.findUnique({
      where: { id },
      select: {
        id: true,
        routeName: true,
        routeDate: true,
        startTime: true,
        status: true,
        totalDistanceKm: true,
        totalDurationMinutes: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
        provider: {
          select: {
            id: true,
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        stops: {
          select: {
            id: true,
            stopOrder: true,
            locationName: true,
            address: true,
            latitude: true,
            longitude: true,
            estimatedArrival: true,
            status: true,
            routeOrder: {
              select: {
                id: true,
                serviceType: true,
                address: true,
                numberOfHorses: true,
                specialInstructions: true,
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
      }
    })

    if (!route) {
      return NextResponse.json(
        { error: "Rutt hittades inte" },
        { status: 404 }
      )
    }

    // 3. Check ownership
    if (route.providerId !== session.user.providerId) {
      return NextResponse.json(
        { error: "Du har inte tillgång till denna rutt" },
        { status: 403 }
      )
    }

    return NextResponse.json(route)

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching route", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
