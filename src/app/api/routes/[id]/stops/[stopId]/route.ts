import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"

// Validation schema for updating stop
const updateStopSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "problem"]),
  problemNote: z.string().optional(),
})

// PATCH /api/routes/:id/stops/:stopId - Update route stop status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  try {
    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { id: routeId, stopId } = await params

    // Auth handled by middleware
    const session = await auth()

    // Only providers can update stops
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Endast leverantörer kan uppdatera stopp" },
        { status: 403 }
      )
    }

    // 2. Validate route ownership
    const route = await prisma.route.findUnique({
      where: { id: routeId }
    })

    if (!route) {
      return NextResponse.json(
        { error: "Rutt hittades inte" },
        { status: 404 }
      )
    }

    if (route.providerId !== session.user.providerId) {
      return NextResponse.json(
        { error: "Du har inte tillgång till denna rutt" },
        { status: 403 }
      )
    }

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      logger.warn("Invalid JSON in request body", { error: String(jsonError) })
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    // Parse and validate
    const validated = updateStopSchema.parse(body)

    // 4. Update stop
    const now = new Date()
    const updateData: {
      status: string
      problemNote?: string
      actualArrival?: Date
      actualDeparture?: Date
    } = {
      status: validated.status,
      problemNote: validated.problemNote,
    }

    if (validated.status === "in_progress" && !updateData.actualArrival) {
      updateData.actualArrival = now
    }

    if (validated.status === "completed" && !updateData.actualDeparture) {
      updateData.actualDeparture = now
    }

    const updatedStop = await prisma.$transaction(async (tx) => {
      // Update the stop
      const stop = await tx.routeStop.update({
        where: { id: stopId },
        data: updateData,
        include: {
          routeOrder: true
        }
      })

      // If completed, update route order status
      if (validated.status === "completed") {
        await tx.routeOrder.update({
          where: { id: stop.routeOrderId },
          data: { status: "completed" }
        })
      }

      // Check if all stops are completed, update route status
      const allStops = await tx.routeStop.findMany({
        where: { routeId }
      })

      const allCompleted = allStops.every((s: { status: string }) => s.status === "completed")
      if (allCompleted) {
        await tx.route.update({
          where: { id: routeId },
          data: { status: "completed" }
        })
      }

      return stop
    })

    return NextResponse.json(updatedStop)

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Error updating stop", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
