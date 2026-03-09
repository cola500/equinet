import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableSpotService } from "@/domain/stable/StableSpotServiceFactory"
import { updateStableSpotSchema } from "@/lib/validations/stable"

type RouteParams = { params: Promise<{ spotId: string }> }

// PUT - Update a spot
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "For manga forfragningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("stable_profiles"))) {
      return NextResponse.json({ error: "Ej tillganglig" }, { status: 404 })
    }

    const stableService = createStableService()
    const stable = await stableService.getByUserId(session.user.id)
    if (!stable) {
      return NextResponse.json({ error: "Du har inget stall" }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateStableSpotSchema.parse(body)
    const { spotId } = await params

    const spotService = createStableSpotService()
    const result = await spotService.updateSpot(spotId, stable.id, {
      label: validated.label,
      status: validated.status,
      pricePerMonth: validated.pricePerMonth,
      availableFrom: validated.availableFrom ? new Date(validated.availableFrom) : undefined,
      notes: validated.notes,
    })

    if (result.isFailure) {
      return NextResponse.json({ error: "Stallplats hittades inte" }, { status: 404 })
    }

    return NextResponse.json(result.value)
  } catch (err: unknown) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Valideringsfel", details: err.issues }, { status: 400 })
    }
    logger.error("Error updating stable spot", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte uppdatera stallplats" }, { status: 500 })
  }
}

// DELETE - Delete a spot
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "For manga forfragningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("stable_profiles"))) {
      return NextResponse.json({ error: "Ej tillganglig" }, { status: 404 })
    }

    const stableService = createStableService()
    const stable = await stableService.getByUserId(session.user.id)
    if (!stable) {
      return NextResponse.json({ error: "Du har inget stall" }, { status: 403 })
    }

    const { spotId } = await params
    const spotService = createStableSpotService()
    const result = await spotService.deleteSpot(spotId, stable.id)

    if (result.isFailure) {
      return NextResponse.json({ error: "Stallplats hittades inte" }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    logger.error("Error deleting stable spot", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte ta bort stallplats" }, { status: 500 })
  }
}
