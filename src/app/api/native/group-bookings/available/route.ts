/**
 * GET /api/native/group-bookings/available
 * Open group booking requests for provider (native iOS).
 *
 * Auth: Bearer > Supabase
 * Feature flag: group_bookings
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIP = getClientIP(request)
    try {
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    if (!(await isFeatureEnabled("group_bookings"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    if (!authUser.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan se grupprequests" },
        { status: 403 }
      )
    }

    const service = createGroupBookingService()
    const result = await service.listAvailableForProvider(authUser.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json({ requests: result.value.requests })
  } catch (error) {
    logger.error("Failed to fetch native available group bookings", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta gruppbokningar" },
      { status: 500 }
    )
  }
}
