import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createMunicipalityWatchService } from "@/domain/municipality-watch/MunicipalityWatchServiceFactory"

const watchSchema = z.object({
  municipality: z.string().min(1, "Kommun krävs"),
  serviceTypeName: z.string().min(1, "Tjänstetyp krävs").max(100),
}).strict()

// POST /api/municipality-watches - Create a new municipality watch
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

    if (!(await isFeatureEnabled("municipality_watch"))) {
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

    const validated = watchSchema.parse(body)

    const service = createMunicipalityWatchService()
    const result = await service.addWatch(
      session.user.id,
      validated.municipality,
      validated.serviceTypeName
    )

    if (!result.ok) {
      const errorMessages: Record<string, string> = {
        INVALID_MUNICIPALITY: "Ogiltig kommun",
        INVALID_SERVICE_TYPE: "Ogiltig tjänstetyp",
        MAX_WATCHES_REACHED: "Max antal bevakningar uppnått (10)",
      }
      return NextResponse.json(
        { error: errorMessages[result.error] || "Valideringsfel" },
        { status: 400 }
      )
    }

    return NextResponse.json(result.value, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error creating municipality watch", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

// GET /api/municipality-watches - List customer's watches
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

    if (!(await isFeatureEnabled("municipality_watch"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const service = createMunicipalityWatchService()
    const watches = await service.getWatches(session.user.id)

    return NextResponse.json(watches)
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error fetching municipality watches", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
