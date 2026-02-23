import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createFollowService } from "@/domain/follow/FollowServiceFactory"

const followSchema = z.object({
  providerId: z.string().uuid("Ogiltigt leverantörs-ID"),
}).strict()

// POST /api/follows - Follow a provider
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "customer") {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    if (!(await isFeatureEnabled("follow_provider"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    const validated = followSchema.parse(body)

    const service = createFollowService()
    const result = await service.follow(session.user.id, validated.providerId)

    if (!result.ok) {
      if (result.error === "PROVIDER_NOT_FOUND") {
        return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
      }
      if (result.error === "PROVIDER_INACTIVE") {
        return NextResponse.json({ error: "Leverantören är inte aktiv" }, { status: 400 })
      }
    }

    if (result.ok) {
      return NextResponse.json(result.value, { status: 201 })
    }

    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error creating follow", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

// GET /api/follows - List followed providers
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "customer") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("follow_provider"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const service = createFollowService()
    const follows = await service.getFollowedProviders(session.user.id)

    return NextResponse.json(follows)
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error fetching follows", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
