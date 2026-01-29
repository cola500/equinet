import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
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

/**
 * GET /api/route-orders/announcements
 *
 * Search for provider-announced route orders (announcements)
 *
 * Query parameters:
 * - providerId: Filter by specific provider
 * - latitude: Customer's latitude (for geo-filtering)
 * - longitude: Customer's longitude (for geo-filtering)
 * - radiusKm: Search radius in kilometers (for geo-filtering)
 * - serviceType: Filter by service type
 * - dateFrom: Filter announcements available from this date
 * - dateTo: Filter announcements available until this date
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const providerIdParam = searchParams.get('providerId')
    const latitudeParam = searchParams.get('latitude')
    const longitudeParam = searchParams.get('longitude')
    const radiusKmParam = searchParams.get('radiusKm')
    const serviceType = searchParams.get('serviceType')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    // Build Prisma where clause
    const where: Prisma.RouteOrderWhereInput = {
      announcementType: 'provider_announced',
      status: 'open',
    }

    // Provider filter
    if (providerIdParam) {
      where.providerId = providerIdParam
    }

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

    // Service type filter
    if (serviceType) {
      where.serviceType = serviceType
    }

    // Date range filter
    if (dateFromParam) {
      where.dateFrom = {
        lte: new Date(dateFromParam),
      }
    }

    if (dateToParam) {
      where.dateTo = {
        gte: new Date(dateToParam),
      }
    }

    // Fetch all announcements matching non-geo filters
    // Using select (not include) to prevent data leakage
    const announcements = await prisma.routeOrder.findMany({
      where,
      select: {
        id: true,
        providerId: true,
        serviceType: true,
        address: true,
        latitude: true,
        longitude: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        announcementType: true,
        specialInstructions: true,
        provider: {
          select: {
            id: true,
            businessName: true,
            description: true,
            profileImageUrl: true,
          },
        },
        routeStops: {
          select: {
            id: true,
            locationName: true,
            address: true,
            latitude: true,
            longitude: true,
            stopOrder: true,
          },
          orderBy: {
            stopOrder: 'asc',
          },
        },
      },
      orderBy: {
        dateFrom: 'asc',
      },
    })

    // Apply geo-filtering if coordinates provided
    if (latitudeParam && longitudeParam && radiusKmParam) {
      const latitude = parseFloat(latitudeParam)
      const longitude = parseFloat(longitudeParam)
      const radiusKm = parseFloat(radiusKmParam)

      const filteredAnnouncements = announcements.filter((announcement: typeof announcements[number]) => {
        // Calculate distance to primary location
        if (announcement.latitude && announcement.longitude) {
          const distance = calculateDistance(
            latitude,
            longitude,
            announcement.latitude,
            announcement.longitude
          )

          if (distance <= radiusKm) {
            return true
          }
        }

        // Also check route stops
        if (announcement.routeStops && announcement.routeStops.length > 0) {
          return announcement.routeStops.some((stop: typeof announcement.routeStops[number]) => {
            if (stop.latitude && stop.longitude) {
              const distance = calculateDistance(
                latitude,
                longitude,
                stop.latitude,
                stop.longitude
              )
              return distance <= radiusKm
            }
            return false
          })
        }

        return false
      })

      return NextResponse.json(filteredAnnouncements)
    }

    return NextResponse.json(announcements)

  } catch (error) {
    logger.error("Error fetching announcements", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
      { status: 500 }
    )
  }
}
