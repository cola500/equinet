import { NextRequest, NextResponse } from "next/server"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { sanitizeSearchQuery } from "@/lib/sanitize"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

// GET all active providers with their services
export async function GET(request: NextRequest) {
  // Rate limiting: 100 requests per minute per IP
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
    const cityParam = searchParams.get("city")
    const searchParam = searchParams.get("search")
    const latitudeParam = searchParams.get('latitude')
    const longitudeParam = searchParams.get('longitude')
    const radiusKmParam = searchParams.get('radiusKm')

    // Sanitize search inputs to prevent SQL injection and XSS
    const city = cityParam ? sanitizeSearchQuery(cityParam) : null
    const search = searchParam ? sanitizeSearchQuery(searchParam) : null

    // Geo-filtering validation
    if (latitudeParam || longitudeParam || radiusKmParam) {
      if (!latitudeParam || !longitudeParam || !radiusKmParam) {
        return NextResponse.json(
          { error: 'Geo-filtering requires latitude, longitude, and radiusKm' },
          { status: 400 }
        )
      }

      const radiusKm = parseFloat(radiusKmParam)
      if (radiusKm <= 0) {
        return NextResponse.json(
          { error: 'radiusKm must be positive' },
          { status: 400 }
        )
      }
    }

    // Use repository instead of direct Prisma access
    const providerRepo = new ProviderRepository()
    const providers = await providerRepo.findAllWithDetails({
      isActive: true,
      city: city || undefined,
      search: search || undefined,
    })

    // Apply geo-filtering if coordinates provided
    if (latitudeParam && longitudeParam && radiusKmParam) {
      const latitude = parseFloat(latitudeParam)
      const longitude = parseFloat(longitudeParam)
      const radiusKm = parseFloat(radiusKmParam)

      const filteredProviders = providers.filter((provider) => {
        // Skip providers without coordinates
        if (!provider.latitude || !provider.longitude) {
          return false
        }

        // Calculate distance from search location to provider
        const distance = calculateDistance(
          latitude,
          longitude,
          provider.latitude,
          provider.longitude
        )

        // Include provider if within search radius
        return distance <= radiusKm
      })

      return NextResponse.json(filteredProviders)
    }

    return NextResponse.json(providers)
  } catch (error) {
    console.error("Error fetching providers:", error)
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    )
  }
}
