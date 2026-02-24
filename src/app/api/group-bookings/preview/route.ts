import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"
import { isFeatureEnabled } from "@/lib/feature-flags"

export async function GET(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled("group_bookings"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const session = await auth()

    // Rate limiting
    const rateLimitKey = `api:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.api(rateLimitKey)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar. Försök igen senare." },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      logger.error("Rate limiter error", rateLimitError instanceof Error ? rateLimitError : new Error(String(rateLimitError)))
    }

    // Validate query param
    const code = request.nextUrl.searchParams.get("code")
    if (!code || code.length < 1 || code.length > 20) {
      return NextResponse.json(
        { error: "Ogiltig eller saknad inbjudningskod" },
        { status: 400 }
      )
    }

    const service = createGroupBookingService()
    const result = await service.getPreviewByCode(code)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to get group booking preview", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Kunde inte hämta förhandsgranskning" },
      { status: 500 }
    )
  }
}
