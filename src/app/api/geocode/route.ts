import { NextRequest, NextResponse } from "next/server"
import { geocodeAddress } from "@/lib/geocoding"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

/**
 * GET /api/geocode
 *
 * Geocode an address to coordinates using Nominatim (OpenStreetMap)
 *
 * Query parameters:
 * - address: The address to geocode (required)
 * - city: Optional city name (will be appended to address)
 * - postalCode: Optional postal code (will be appended to address)
 */
export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per minute per IP (expensive operation)
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.geocode(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många geocoding-förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")
    const city = searchParams.get("city")
    const postalCode = searchParams.get("postalCode")

    if (!address) {
      return NextResponse.json(
        { error: "Adressparameter krävs" },
        { status: 400 }
      )
    }

    // Build full address string
    const fullAddress = [address, city, postalCode].filter(Boolean).join(', ')
    const result = await geocodeAddress(fullAddress)

    if (!result) {
      return NextResponse.json(
        { error: "Kunde inte geokoda adressen" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error("Error in geocode endpoint", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte geokoda adressen" },
      { status: 500 }
    )
  }
}
