import { NextRequest, NextResponse } from "next/server"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableSpotService } from "@/domain/stable/StableSpotServiceFactory"
import { logger } from "@/lib/logger"
import type { StableWithCounts, StableSpot } from "@/infrastructure/persistence/stable/IStableRepository"

type RouteParams = { params: Promise<{ stableId: string }> }

function toPublicProfile(stable: StableWithCounts, availableSpots: StableSpot[]) {
  return {
    id: stable.id,
    name: stable.name,
    description: stable.description,
    city: stable.city,
    municipality: stable.municipality,
    latitude: stable.latitude,
    longitude: stable.longitude,
    contactEmail: stable.contactEmail,
    contactPhone: stable.contactPhone,
    profileImageUrl: stable.profileImageUrl,
    _count: stable._count,
    availableSpots: availableSpots.map((s) => ({
      id: s.id,
      label: s.label,
      pricePerMonth: s.pricePerMonth,
      availableFrom: s.availableFrom,
      notes: s.notes,
    })),
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!(await isFeatureEnabled("stable_profiles"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const { stableId } = await params

    const service = createStableService()
    const stable = await service.getPublicById(stableId)
    if (!stable) {
      return NextResponse.json({ error: "Stall hittades inte" }, { status: 404 })
    }

    // Fetch spots and filter to available only
    const spotService = createStableSpotService()
    const allSpots = await spotService.getSpots(stableId)
    const availableSpots = allSpots.filter((s) => s.status === "available")

    return NextResponse.json(toPublicProfile(stable, availableSpots))
  } catch (error) {
    logger.error("Error fetching stable profile", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta stallprofil" },
      { status: 500 }
    )
  }
}
