import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"

/**
 * GET /api/group-bookings/available
 * Returns open group booking requests visible to the authenticated provider.
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantörer kan se tillgängliga grupprequests" },
        { status: 403 }
      )
    }

    const service = createGroupBookingService()
    const result = await service.listAvailableForProvider(session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value.requests)
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to fetch available group bookings", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to fetch available group bookings" },
      { status: 500 }
    )
  }
}
