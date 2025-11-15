import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { z } from "zod"

const serviceSchema = z.object({
  name: z.string().min(1, "Tjänstens namn krävs"),
  description: z.string().optional(),
  price: z.number().positive("Pris måste vara positivt"),
  durationMinutes: z.number().int().positive("Varaktighet måste vara positiv"),
}).strict()

// GET all services for logged-in provider
export async function GET(request: NextRequest) {
  try {
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

    const services = await prisma.service.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(services)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error fetching services:", error)
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    )
  }
}

// POST - Create new service
export async function POST(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting - 10 service creations per hour per provider
    const rateLimitKey = `service-create:${session.user.id}`
    if (!rateLimiters.serviceCreate(rateLimitKey)) {
      return NextResponse.json(
        {
          error: "För många tjänster skapade",
          details: "Du kan skapa max 10 tjänster per timme. Försök igen senare.",
        },
        { status: 429 }
      )
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
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

    const validatedData = serviceSchema.parse(body)

    const service = await prisma.service.create({
      data: {
        ...validatedData,
        providerId: provider.id,
      },
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error creating service:", error)
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    )
  }
}
