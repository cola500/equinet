import { NextRequest, NextResponse } from "next/server"
import { geocodeAddress } from "@/lib/geocoding"

/**
 * GET /api/geocode
 *
 * Geocode an address to coordinates using Google Maps API
 *
 * Query parameters:
 * - address: The address to geocode (required)
 * - city: Optional city name
 * - postalCode: Optional postal code
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")
    const city = searchParams.get("city") || undefined
    const postalCode = searchParams.get("postalCode") || undefined

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      )
    }

    const result = await geocodeAddress(address, city, postalCode)

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
