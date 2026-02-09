import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { logger } from "@/lib/logger"

const serviceSchema = z.object({
  name: z.string().min(1, "Tjänstens namn krävs"),
  description: z.string().optional(),
  price: z.number().positive("Pris måste vara positivt"),
  durationMinutes: z.number().int().positive("Varaktighet måste vara positiv"),
  isActive: z.boolean().optional(),
  recommendedIntervalWeeks: z.number().int().min(1).max(52).nullable().optional(),
})

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
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Use repositories instead of direct Prisma access
    const serviceRepo = new ServiceRepository()
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

    // Update with authorization check (atomic WHERE clause in repository)
    const service = await serviceRepo.updateWithAuth(id, validatedData, provider.id)

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      logger.warn("Validation error", { issues: JSON.stringify(error.issues) })
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error updating service", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera tjänst" },
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
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Use repositories instead of direct Prisma access
    const serviceRepo = new ServiceRepository()
    const providerRepo = new ProviderRepository()

    const provider = await providerRepo.findByUserId(session.user.id)

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Delete with authorization check (atomic WHERE clause in repository)
    const deleted = await serviceRepo.deleteWithAuth(id, provider.id)

    if (!deleted) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Service deleted" })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error deleting service", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte ta bort tjänst" },
      { status: 500 }
    )
  }
}
