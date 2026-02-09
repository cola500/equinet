import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { rateLimiters } from "@/lib/rate-limit"
import { z } from "zod"
import { logger } from "@/lib/logger"

const serviceSchema = z.object({
  name: z.string().min(1, "Tjänstens namn krävs"),
  description: z.string().optional(),
  price: z.number().positive("Pris måste vara positivt"),
  durationMinutes: z.number().int().positive("Varaktighet måste vara positiv"),
  recommendedIntervalWeeks: z.number().int().min(1).max(52).nullable().optional(),
})

// GET all services for logged-in provider
export async function GET(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Use repository to find provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Use repository to get services
    const serviceRepo = new ServiceRepository()
    const services = await serviceRepo.findByProviderId(provider.id)

    return NextResponse.json(services)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching services", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta tjänster" },
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
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Rate limiting - 10 service creations per hour per provider
    const rateLimitKey = `service-create:${session.user.id}`
    const isAllowed = await rateLimiters.serviceCreate(rateLimitKey)
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: "För många tjänster skapade",
          details: "Du kan skapa max 10 tjänster per timme. Försök igen senare.",
        },
        { status: 429 }
      )
    }

    // Use repository to find provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
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

    const validatedData = serviceSchema.parse(body)

    // Use repository to create service
    const serviceRepo = new ServiceRepository()
    const service = await serviceRepo.save({
      id: crypto.randomUUID(), // Generate new ID for creation
      providerId: provider.id,
      name: validatedData.name,
      description: validatedData.description || null,
      price: validatedData.price,
      durationMinutes: validatedData.durationMinutes,
      isActive: true,
      recommendedIntervalWeeks: validatedData.recommendedIntervalWeeks ?? null,
      createdAt: new Date(),
    })

    return NextResponse.json(service, { status: 201 })
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

    logger.error("Error creating service", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte skapa tjänst" },
      { status: 500 }
    )
  }
}
