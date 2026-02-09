import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
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
    const { coordinates } = await request.json()

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: 'Ogiltiga koordinater' },
        { status: 400 }
      )
    }

    // Convert lat,lon to lon,lat for OSRM
    const coordString = coordinates
      .map(([lat, lon]: [number, number]) => `${lon},${lat}`)
      .join(';')

    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Equinet Route Planning App'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `OSRM API returned ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return NextResponse.json(
        { error: 'Ingen rutt hittades' },
        { status: 404 }
      )
    }

    const route = data.routes[0]

    // Convert back from lon,lat to lat,lon
    const routeCoordinates = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon]
    )

    return NextResponse.json({
      coordinates: routeCoordinates,
      distance: route.distance,
      duration: route.duration,
    })
  } catch (error: any) {
    logger.error("Routing proxy error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: error.message || 'Internt serverfel' },
      { status: 500 }
    )
  }
}
