import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

const MODAL_API_URL =
  "https://johan-26538--route-optimizer-fastapi-app.modal.run"

const optimizeRouteSchema = z
  .object({
    stops: z
      .array(
        z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          id: z.string(),
        }).strict()
      )
      .min(2, "Minst 2 stopp krävs"),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const user = session.user as { role?: string }
    if (user.role !== "provider") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    // 2. Rate limiting
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    // 3. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Zod validation
    const validated = optimizeRouteSchema.parse(body)

    // 5. Proxy to Modal API
    logger.debug("Optimize route request", {
      stopCount: validated.stops.length,
    })

    const response = await fetch(`${MODAL_API_URL}/optimize-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error("Modal API error response", new Error(errorText))
      return NextResponse.json(
        { error: "Optimering misslyckades" },
        { status: response.status }
      )
    }

    const data = await response.json()
    logger.info("Optimize route success")
    return NextResponse.json(data)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error(
      "Route optimization error",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
