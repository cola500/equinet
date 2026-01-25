import { NextRequest, NextResponse } from "next/server"
import { geocodeAddress } from "@/lib/geocoding"

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
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")
    const city = searchParams.get("city")
    const postalCode = searchParams.get("postalCode")

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      )
    }

    // Build full address string
    const fullAddress = [address, city, postalCode].filter(Boolean).join(', ')
    const result = await geocodeAddress(fullAddress)

    if (!result) {
      return NextResponse.json(
        { error: "Could not geocode address" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in geocode endpoint:", error)
    return NextResponse.json(
      { error: "Failed to geocode address" },
      { status: 500 }
    )
  }
}
