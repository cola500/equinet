import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"
import { horseUpdateSchema } from "@/lib/schemas/horse"

type RouteContext = { params: Promise<{ id: string }> }

// GET - Get horse details with booking history
export async function GET(request: NextRequest, context: RouteContext) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()
    const { id } = await context.params
    const service = createHorseService()

    const result = await service.getHorse(id, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch horse", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta häst" },
      { status: 500 }
    )
  }
}

// PUT - Update horse
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id } = await context.params

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    // Validate input
    const validated = horseUpdateSchema.parse(body)

    const service = createHorseService()
    const result = await service.updateHorse(id, validated, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse updated", { horseId: id, ownerId: session.user.id })

    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to update horse", error as Error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera häst" },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete horse (set isActive=false)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id } = await context.params

    const service = createHorseService()
    const result = await service.softDeleteHorse(id, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse soft-deleted", { horseId: id, ownerId: session.user.id })

    return NextResponse.json({ message: "Hästen har tagits bort" })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to delete horse", error as Error)
    return NextResponse.json(
      { error: "Kunde inte ta bort häst" },
      { status: 500 }
    )
  }
}
