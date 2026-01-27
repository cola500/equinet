import { NextRequest, NextResponse } from "next/server"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { sanitizeSearchQuery } from "@/lib/sanitize"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { calculateBoundingBox, getMaxRadiusKm } from "@/lib/geo/bounding-box"
import { getCachedProviders, setCachedProviders, CachedProvider } from "@/lib/cache/provider-cache"

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
    let geoFilter: { latitude: number; longitude: number; radiusKm: number } | null = null

    if (latitudeParam || longitudeParam || radiusKmParam) {
      if (!latitudeParam || !longitudeParam || !radiusKmParam) {
        return NextResponse.json(
          { error: 'Geo-filtering requires latitude, longitude, and radiusKm' },
          { status: 400 }
        )
      }

      const latitude = parseFloat(latitudeParam)
      const longitude = parseFloat(longitudeParam)
      const radiusKm = parseFloat(radiusKmParam)

      // Validate coordinates
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { error: 'Invalid latitude (must be between -90 and 90)' },
          { status: 400 }
        )
      }

      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { error: 'Invalid longitude (must be between -180 and 180)' },
          { status: 400 }
        )
      }

      // Validate and clamp radius (security: max 100km)
      const maxRadius = getMaxRadiusKm()
      if (isNaN(radiusKm) || radiusKm <= 0) {
        return NextResponse.json(
          { error: 'radiusKm must be positive' },
          { status: 400 }
        )
      }

      if (radiusKm > maxRadius) {
        return NextResponse.json(
          { error: `radiusKm cannot exceed ${maxRadius}km` },
          { status: 400 }
        )
      }

      geoFilter = { latitude, longitude, radiusKm }
    }

    // Build repository filters
    const providerRepo = new ProviderRepository()
    const filters: Parameters<typeof providerRepo.findAllWithDetails>[0] = {
      isActive: true,
      city: city || undefined,
      search: search || undefined,
    }

    // Add bounding box to pre-filter in database (reduces dataset before JS filtering)
    if (geoFilter) {
      filters.boundingBox = calculateBoundingBox(
        geoFilter.latitude,
        geoFilter.longitude,
        geoFilter.radiusKm
      )
    }

    // Generate cache key from filter parameters
    const cacheKey = JSON.stringify({
      city: city || null,
      search: search || null,
      boundingBox: filters.boundingBox || null,
    })

    // Check cache first
    const cachedProviders = await getCachedProviders(cacheKey)
    let providers: CachedProvider[]

    if (cachedProviders) {
      providers = cachedProviders
    } else {
      // Fetch from database
      providers = await providerRepo.findAllWithDetails(filters)

      // Cache the result (fail-open - errors are handled in cache module)
      await setCachedProviders(cacheKey, providers)
    }

    // Apply exact distance filtering (on reduced dataset from bounding box)
    if (geoFilter) {
      const { latitude, longitude, radiusKm } = geoFilter

      const filteredProviders = providers.filter((provider) => {
        // Skip providers without coordinates
        if (!provider.latitude || !provider.longitude) {
          return false
        }

        // Calculate exact distance from search location to provider
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
