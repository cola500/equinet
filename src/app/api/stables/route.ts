import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { sanitizeSearchQuery } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import type { StableFilters, StableWithCounts } from "@/infrastructure/persistence/stable/IStableRepository"

// Public select: strip sensitive fields before returning.
// Contact details (email/phone) are intentionally NOT included in the search
// list — they belong on the single-stable profile (toPublicProfile in
// /api/stables/[stableId], gated by stable_profiles). This list is public and
// powers the horse→stable selector, so leaking every stable's contact PII here
// would over-expose it.
function toPublicStable(stable: StableWithCounts) {
  return {
    id: stable.id,
    name: stable.name,
    description: stable.description,
    city: stable.city,
    municipality: stable.municipality,
    latitude: stable.latitude,
    longitude: stable.longitude,
    profileImageUrl: stable.profileImageUrl,
    _count: stable._count,
  }
}

export async function GET(request: NextRequest) {
  // Public stable search. Powers the always-on horse→stable selector as well as
  // the stable-owner browse (gated separately at page level by stable_profiles).
  // No feature gate here — the search itself is public.
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const filters: StableFilters = {}

    const municipality = searchParams.get("municipality")
    if (municipality) filters.municipality = sanitizeSearchQuery(municipality)

    const city = searchParams.get("city")
    if (city) filters.city = sanitizeSearchQuery(city)

    const search = searchParams.get("search")
    if (search) filters.search = sanitizeSearchQuery(search)

    const hasAvailableSpots = searchParams.get("hasAvailableSpots")
    if (hasAvailableSpots === "true") filters.hasAvailableSpots = true

    const service = createStableService()
    const stables = await service.searchPublic(filters)

    return NextResponse.json({
      data: stables.map(toPublicStable),
    })
  } catch (error) {
    logger.error("Error searching stables", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta stall" },
      { status: 500 }
    )
  }
}
