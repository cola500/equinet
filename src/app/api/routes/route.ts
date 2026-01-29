import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { calculateDistance } from "@/lib/distance"
import { logger } from "@/lib/logger"

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
    // Auth handled by middleware - get session
    const session = await auth()

    // Parse and validate
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

      // Add travel time if not first stop (only if both have coordinates)
      if (i > 0) {
        const prevOrder = orders[i - 1]
        if (prevOrder.latitude != null && prevOrder.longitude != null &&
            order.latitude != null && order.longitude != null) {
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
    }

    // 5. Create route with transaction
    // @ts-expect-error - Prisma transaction callback type inference issue
    const route: any = await prisma.$transaction(async (tx) => {
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
            address: order.address,
            latitude: order.latitude,
            longitude: order.longitude,
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
          if (order.latitude != null && order.longitude != null &&
              nextOrder.latitude != null && nextOrder.longitude != null) {
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
      }

      return newRoute
    })

    // 6. Fetch complete route with stops (using select for efficiency)
    const completeRoute = await prisma.route.findUnique({
      where: { id: route.id },
      select: {
        id: true,
        routeName: true,
        routeDate: true,
        startTime: true,
        status: true,
        totalDistanceKm: true,
        totalDurationMinutes: true,
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
            estimatedArrival: true,
            estimatedDurationMin: true,
            actualArrival: true,
            actualDeparture: true,
            status: true,
            problemNote: true,
            routeOrder: {
              select: {
                id: true,
                serviceType: true,
                address: true,
                numberOfHorses: true,
                priority: true,
                specialInstructions: true,
                contactPhone: true,
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
    logger.error("Error creating route", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
