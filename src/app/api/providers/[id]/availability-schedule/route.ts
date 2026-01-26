import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Validation schema for availability schedule
const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  isClosed: z.boolean(),
})

const scheduleSchema = z.object({
  schedule: z.array(scheduleItemSchema),
})

/**
 * GET /api/providers/[id]/availability-schedule
 * Hämta öppettider för en leverantör
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Hämta availability från databas
    const availability = await prisma.availability.findMany({
      where: {
        providerId: id,
        isActive: true,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
    })

    return NextResponse.json(availability)
  } catch (error) {
    console.error("Error fetching availability schedule:", error)
    return new Response("Internal error", { status: 500 })
  }
}

/**
 * PUT /api/providers/[id]/availability-schedule
 * Uppdatera öppettider för en leverantör
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Provider check
    if (session.user.userType !== "provider") {
      return new Response("Only providers can update availability", { status: 403 })
    }

    const { id: providerId } = await params

    // Authorization check - verify the provider owns this profile
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    })

    if (!provider || provider.userId !== session.user.id) {
      return new Response("Forbidden - not your provider profile", { status: 403 })
    }

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error("Invalid JSON in request body:", jsonError)
      return NextResponse.json(
        { error: "Invalid request body", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Parse & validate
    const validated = scheduleSchema.parse(body)

    // Update availability schedule
    // Delete existing availability
    await prisma.availability.deleteMany({
      where: { providerId },
    })

    // Create new availability entries
    const createPromises = validated.schedule.map((item) =>
      prisma.availability.upsert({
        where: {
          providerId_dayOfWeek: {
            providerId,
            dayOfWeek: item.dayOfWeek,
          },
        },
        update: {
          startTime: item.startTime,
          endTime: item.endTime,
          isClosed: item.isClosed,
          isActive: true,
        },
        create: {
          providerId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          isClosed: item.isClosed,
          isActive: true,
        },
      })
    )

    await Promise.all(createPromises)

    // Fetch and return updated schedule
    const updatedAvailability = await prisma.availability.findMany({
      where: {
        providerId,
        isActive: true,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
    })

    return NextResponse.json(updatedAvailability)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.issues)
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error updating availability schedule:", error)
    // Return more detailed error for debugging
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
