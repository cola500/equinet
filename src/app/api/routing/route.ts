import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { coordinates } = await request.json()

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
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
        { error: 'No route found' },
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
    console.error('Routing proxy error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
