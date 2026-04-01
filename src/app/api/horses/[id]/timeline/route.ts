import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

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
  return withApiHandler(
    { auth: "any" },
    async ({ request: req, user }) => {
      const { id: horseId } = await context.params

      // Optional category filter
      const { searchParams } = new URL(req.url)
      const categoryFilter = searchParams.get("category")
      const validCategory = categoryFilter && (NOTE_CATEGORIES as readonly string[]).includes(categoryFilter)
        ? categoryFilter
        : undefined

      const service = createHorseService()
      const result = await service.getTimeline(horseId, user.userId, validCategory)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      return NextResponse.json(result.value)
    },
  )(request)
}
