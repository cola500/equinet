import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableSchema, updateStableSchema } from "@/lib/validations/stable"

// GET - Fetch current user's stable profile
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("stable_profiles"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const service = createStableService()
    const stable = await service.getByUserId(session.user.id)

    if (!stable) {
      return NextResponse.json({ error: "Stallprofil hittades inte" }, { status: 404 })
    }

    return NextResponse.json(stable)
  } catch (err: unknown) {
    if (err instanceof Response) return err
    logger.error("Error fetching stable profile", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte hämta stallprofil" }, { status: 500 })
  }
}

// POST - Create a new stable profile
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("stable_profiles"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = createStableSchema.parse(body)

    const service = createStableService()
    const result = await service.createStable(session.user.id, validated)

    if (result.isFailure) {
      if (result.error === "ALREADY_EXISTS") {
        return NextResponse.json({ error: "Du har redan ett stall" }, { status: 409 })
      }
    }

    const stable = result.value
    return NextResponse.json({ ...stable, stableId: stable.id }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Valideringsfel", details: err.issues }, { status: 400 })
    }
    logger.error("Error creating stable", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte skapa stallprofil" }, { status: 500 })
  }
}

// PUT - Update current user's stable profile
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("stable_profiles"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateStableSchema.parse(body)

    const service = createStableService()
    const result = await service.updateStable(session.user.id, validated)

    if (result.isFailure) {
      if (result.error === "NOT_FOUND") {
        return NextResponse.json({ error: "Stallprofil hittades inte" }, { status: 404 })
      }
    }

    return NextResponse.json(result.value)
  } catch (err: unknown) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Valideringsfel", details: err.issues }, { status: 400 })
    }
    logger.error("Error updating stable", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: "Kunde inte uppdatera stallprofil" }, { status: 500 })
  }
}
