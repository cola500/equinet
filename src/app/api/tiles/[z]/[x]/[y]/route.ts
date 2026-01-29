import { NextRequest, NextResponse } from 'next/server'
import { logger } from "@/lib/logger"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params

  try {
    // Fetch tile from OpenStreetMap
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`

    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'Equinet Route Planning App'
      }
    })

    if (!response.ok) {
      return new NextResponse('Tile not found', { status: 404 })
    }

    const imageBuffer = await response.arrayBuffer()

    // Return the tile with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    })
  } catch (error) {
    logger.error("Tile proxy error", error instanceof Error ? error : new Error(String(error)))
    return new NextResponse('Error fetching tile', { status: 500 })
  }
}
