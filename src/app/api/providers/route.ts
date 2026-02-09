import { NextRequest, NextResponse } from "next/server"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { sanitizeSearchQuery } from "@/lib/sanitize"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { calculateBoundingBox, getMaxRadiusKm } from "@/lib/geo/bounding-box"
import { getCachedProviders, setCachedProviders, CachedProvider } from "@/lib/cache/provider-cache"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { logger } from "@/lib/logger"

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

// Enrich providers with aggregated review data
async function enrichWithReviewStats<T extends { id: string }>(
  providers: T[]
): Promise<(T & { reviewStats: { averageRating: number | null; totalCount: number } })[]> {
  const providerIds = providers.map((p) => p.id)
  const defaultStats = { averageRating: null as number | null, totalCount: 0 }

  if (providerIds.length === 0) {
    return providers.map((p) => ({ ...p, reviewStats: { ...defaultStats } }))
  }

  // Fetch all reviews for these providers (only rating + providerId)
  const reviews = await prisma.review.findMany({
    where: { providerId: { in: providerIds } },
    select: { providerId: true, rating: true },
  })

  // Aggregate manually (avoids complex groupBy TS overloads)
  const statsMap = new Map<string, { sum: number; count: number }>()
  for (const review of reviews) {
    const existing = statsMap.get(review.providerId)
    if (existing) {
      existing.sum += review.rating
      existing.count += 1
    } else {
      statsMap.set(review.providerId, { sum: review.rating, count: 1 })
    }
  }

  return providers.map((provider) => {
    const stats = statsMap.get(provider.id)
    return {
      ...provider,
      reviewStats: stats
        ? { averageRating: stats.sum / stats.count, totalCount: stats.count }
        : { ...defaultStats },
    }
  })
}

// Enrich providers with their next planned visit
async function enrichWithNextVisit<T extends { id: string }>(
  providers: T[]
): Promise<(T & { nextVisit: { date: string; location: string } | null })[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Batch fetch all next visits in one query using raw SQL for efficiency
  const providerIds = providers.map((p) => p.id)

  if (providerIds.length === 0) {
    return providers.map((p) => ({ ...p, nextVisit: null }))
  }

  // Use Prisma's grouped query to get the next visit for each provider
  const nextVisits = await prisma.availabilityException.findMany({
    where: {
      providerId: { in: providerIds },
      date: { gte: today },
      location: { not: null },
      isClosed: false,
    },
    orderBy: { date: "asc" },
    select: {
      providerId: true,
      date: true,
      location: true,
    },
  })

  // Group by provider and keep only the first (earliest) visit
  const visitsByProvider = new Map<string, { date: Date; location: string }>()
  for (const visit of nextVisits) {
    if (!visitsByProvider.has(visit.providerId) && visit.location) {
      visitsByProvider.set(visit.providerId, {
        date: visit.date,
        location: visit.location,
      })
    }
  }

  return providers.map((provider) => {
    const visit = visitsByProvider.get(provider.id)
    return {
      ...provider,
      nextVisit: visit
        ? {
            date: format(visit.date, "yyyy-MM-dd"),
            location: visit.location,
          }
        : null,
    }
  })
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
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // Pagination: validate and apply defaults (max 100 results for DoS protection)
    const MAX_LIMIT = 100
    const limit = Math.min(
      Math.max(1, parseInt(limitParam || '100', 10) || 100),
      MAX_LIMIT
    )
    const offset = Math.max(0, parseInt(offsetParam || '0', 10) || 0)

    // Sanitize search inputs to prevent SQL injection and XSS
    const city = cityParam ? sanitizeSearchQuery(cityParam) : null
    const search = searchParam ? sanitizeSearchQuery(searchParam) : null

    // Geo-filtering validation
    let geoFilter: { latitude: number; longitude: number; radiusKm: number } | null = null

    if (latitudeParam || longitudeParam || radiusKmParam) {
      if (!latitudeParam || !longitudeParam || !radiusKmParam) {
        return NextResponse.json(
          { error: 'Platsfiltrering kräver latitud, longitud och radie' },
          { status: 400 }
        )
      }

      const latitude = parseFloat(latitudeParam)
      const longitude = parseFloat(longitudeParam)
      const radiusKm = parseFloat(radiusKmParam)

      // Validate coordinates
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { error: 'Ogiltig latitud (måste vara mellan -90 och 90)' },
          { status: 400 }
        )
      }

      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { error: 'Ogiltig longitud (måste vara mellan -180 och 180)' },
          { status: 400 }
        )
      }

      // Validate and clamp radius
      const maxRadius = getMaxRadiusKm()
      if (isNaN(radiusKm) || radiusKm <= 0) {
        return NextResponse.json(
          { error: 'Radien måste vara ett positivt tal' },
          { status: 400 }
        )
      }

      if (radiusKm > maxRadius) {
        return NextResponse.json(
          { error: `Radien kan inte överstiga ${maxRadius} km` },
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

      // Apply pagination
      const total = filteredProviders.length
      const paginatedProviders = filteredProviders.slice(offset, offset + limit)

      // Enrich with next visit info and review stats (parallel for performance)
      const [withVisits, withReviews] = await Promise.all([
        enrichWithNextVisit(paginatedProviders),
        enrichWithReviewStats(paginatedProviders),
      ])
      const enrichedProviders = withVisits.map((p, i) => ({
        ...p,
        reviewStats: withReviews[i].reviewStats,
      }))

      return NextResponse.json({
        data: enrichedProviders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      })
    }

    // Apply pagination
    const total = providers.length
    const paginatedProviders = providers.slice(offset, offset + limit)

    // Enrich with next visit info and review stats (parallel for performance)
    const [withVisits, withReviews] = await Promise.all([
      enrichWithNextVisit(paginatedProviders),
      enrichWithReviewStats(paginatedProviders),
    ])
    const enrichedProviders = withVisits.map((p, i) => ({
      ...p,
      reviewStats: withReviews[i].reviewStats,
    }))

    return NextResponse.json({
      data: enrichedProviders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    logger.error("Error fetching providers", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta leverantörer" },
      { status: 500 }
    )
  }
}
