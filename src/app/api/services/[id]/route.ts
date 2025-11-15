import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const serviceSchema = z.object({
  name: z.string().min(1, "Tjänstens namn krävs"),
  description: z.string().optional(),
  price: z.number().positive("Pris måste vara positivt"),
  durationMinutes: z.number().int().positive("Varaktighet måste vara positiv"),
  isActive: z.boolean().optional(),
}).strict()

// PUT - Update service
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Verify service belongs to provider
    const existingService = await prisma.service.findUnique({
      where: { id },
    })

    if (!existingService || existingService.providerId !== provider.id) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
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

    console.log("Received update request for service:", id)
    console.log("Request body:", body)

    const validatedData = serviceSchema.parse(body)

    const service = await prisma.service.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(service)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues)
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error updating service:", error)
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 }
    )
  }
}

// DELETE - Delete service
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Verify service belongs to provider
    const existingService = await prisma.service.findUnique({
      where: { id },
    })

    if (!existingService || existingService.providerId !== provider.id) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    await prisma.service.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Service deleted" })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error deleting service:", error)
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    )
  }
}
