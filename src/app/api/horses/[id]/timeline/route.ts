import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

const NOTE_CATEGORIES = [
  "veterinary",
  "farrier",
  "general",
  "injury",
  "medication",
] as const

type RouteContext = { params: Promise<{ id: string }> }

// GET - Combined timeline (bookings + notes)
// Access: Owner sees all, provider with booking sees limited categories
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    const { id: horseId } = await context.params

    // Optional category filter
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get("category")
    const validCategory = categoryFilter && (NOTE_CATEGORIES as readonly string[]).includes(categoryFilter)
      ? categoryFilter
      : undefined

    const service = createHorseService()
    const result = await service.getTimeline(horseId, session.user.id, validCategory)

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

    logger.error("Failed to fetch horse timeline", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta tidslinje" },
      { status: 500 }
    )
  }
}
