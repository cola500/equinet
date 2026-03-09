import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableSpotService } from "@/domain/stable/StableSpotServiceFactory"
import { createStableSpotSchema } from "@/lib/validations/stable"

// GET - List spots for current user's stable
export async function GET(request: NextRequest) {
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

    const spotService = createStableSpotService()
    const [spots, counts] = await Promise.all([
      spotService.getSpots(stable.id),
      spotService.getCounts(stable.id),
    ])

    return NextResponse.json({ spots, _count: counts })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    logger.error("Error fetching stable spots", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte hamta stallplatser" }, { status: 500 })
  }
}

// POST - Create a new spot
export async function POST(request: NextRequest) {
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

    const validated = createStableSpotSchema.parse(body)

    const spotService = createStableSpotService()
    const result = await spotService.createSpot(stable.id, {
      label: validated.label,
      status: validated.status,
      pricePerMonth: validated.pricePerMonth,
      availableFrom: validated.availableFrom ? new Date(validated.availableFrom) : undefined,
      notes: validated.notes,
    })

    return NextResponse.json(result.value, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Valideringsfel", details: err.issues }, { status: 400 })
    }
    logger.error("Error creating stable spot", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte skapa stallplats" }, { status: 500 })
  }
}
