import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

type RouteContext = { params: Promise<{ id: string }> }

const setStableSchema = z
  .object({
    stableId: z.string().min(1).nullable(),
  })
  .strict()

// PATCH - Set or remove stable link for a horse
export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  if (!(await isFeatureEnabled("stable_profiles"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

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
    const validated = setStableSchema.parse(body)

    const service = createHorseService()
    const result = await service.setStable(id, validated.stableId, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse stable updated", {
      horseId: id,
      stableId: validated.stableId,
      ownerId: session.user.id,
    })

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

    logger.error("Failed to update horse stable", error as Error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera stallkoppling" },
      { status: 500 }
    )
  }
}
