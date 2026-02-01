import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/horses/[id]/passport - Create a shareable passport link
export async function POST(request: NextRequest, context: RouteContext) {
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
    const { id: horseId } = await context.params

    const service = createHorseService()
    const result = await service.createPassportToken(horseId, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    // Build the public URL
    const baseUrl = request.headers.get("x-forwarded-host")
      ? `https://${request.headers.get("x-forwarded-host")}`
      : new URL(request.url).origin
    const url = `${baseUrl}/passport/${result.value.token}`

    logger.info("Passport token created", {
      horseId,
      userId: session.user.id,
      expiresAt: result.value.expiresAt.toISOString(),
    })

    return NextResponse.json(
      {
        token: result.value.token,
        url,
        expiresAt: result.value.expiresAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to create passport token", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa hästpass-länk" },
      { status: 500 }
    )
  }
}
