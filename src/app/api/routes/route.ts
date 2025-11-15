import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { calculateDistance } from "@/lib/distance"

// Validation schema for creating route
const createRouteSchema = z.object({
  routeName: z.string().min(1, "Ruttnamn krävs"),
  routeDate: z.string().datetime(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Starttid måste vara i format HH:MM"),
  orderIds: z.array(z.string()).min(1, "Minst en beställning krävs"),
})

// POST /api/routes - Create new route
export async function POST(request: Request) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Only providers can create routes
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Endast leverantörer kan skapa rutter" },
        { status: 403 }
      )
    }

    // 2. Parse and validate
    const body = await request.json()
    const validated = createRouteSchema.parse(body)

    // 3. Validate that all orders exist and are available
    const orders = await prisma.routeOrder.findMany({
      where: {
        id: { in: validated.orderIds },
        status: 'pending'
      }
    })

    if (orders.length !== validated.orderIds.length) {
      return NextResponse.json(
        { error: "Alla beställningar måste vara tillgängliga" },
        { status: 400 }
      )
    }

    // 4. Calculate total distance and duration
    let totalDistance = 0
    let totalDuration = 0

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]

      // Add estimated duration for this stop (1 hour per horse by default)
      totalDuration += order.numberOfHorses * 60

      // Add travel time if not first stop
      if (i > 0) {
        const prevOrder = orders[i - 1]
        const distance = calculateDistance(
          prevOrder.latitude,
          prevOrder.longitude,
          order.latitude,
          order.longitude
        )
        totalDistance += distance
        // Assume 50 km/h average speed, add travel time
        totalDuration += (distance / 50) * 60
      }
    }

    // 5. Create route with transaction
    const route = await prisma.$transaction(async (tx) => {
      // Create the route
      const newRoute = await tx.route.create({
        data: {
          providerId: session.user!.providerId!,
          routeName: validated.routeName,
          routeDate: new Date(validated.routeDate),
          startTime: validated.startTime,
          status: 'planned',
          totalDistanceKm: Math.round(totalDistance * 10) / 10,
          totalDurationMinutes: Math.round(totalDuration),
        }
      })

      // Create route stops
      const [hours, minutes] = validated.startTime.split(':').map(Number)
      const routeDate = new Date(validated.routeDate)
      let currentTime = new Date(routeDate)
      currentTime.setHours(hours, minutes, 0, 0)

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i]
        const estimatedDuration = order.numberOfHorses * 60

        await tx.routeStop.create({
          data: {
            routeId: newRoute.id,
            routeOrderId: order.id,
            stopOrder: i + 1,
            estimatedArrival: new Date(currentTime),
            estimatedDurationMin: estimatedDuration,
            status: 'pending'
          }
        })

        // Update order status to in_route
        await tx.routeOrder.update({
          where: { id: order.id },
          data: { status: 'in_route' }
        })

        // Add duration and travel time to next stop
        currentTime = new Date(currentTime.getTime() + estimatedDuration * 60000)

        if (i < orders.length - 1) {
          const nextOrder = orders[i + 1]
          const distance = calculateDistance(
            order.latitude,
            order.longitude,
            nextOrder.latitude,
            nextOrder.longitude
          )
          const travelTimeMinutes = (distance / 50) * 60
          currentTime = new Date(currentTime.getTime() + travelTimeMinutes * 60000)
        }
      }

      return newRoute
    })

    // 6. Fetch complete route with stops
    const completeRoute = await prisma.route.findUnique({
      where: { id: route.id },
      include: {
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
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
      }
    })

    return NextResponse.json(completeRoute, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating route:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
