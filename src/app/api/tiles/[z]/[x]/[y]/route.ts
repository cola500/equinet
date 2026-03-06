import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

function validateTileParams(
  z: string,
  x: string,
  y: string
): string | null {
  const zNum = Number(z)
  const xNum = Number(x)
  const yNum = Number(y)

  if (!Number.isInteger(zNum) || !Number.isInteger(xNum) || !Number.isInteger(yNum)) {
    return "Ogiltiga koordinater"
  }
  if (zNum < 0 || zNum > 19) {
    return "Ogiltig zoom-nivå (0-19)"
  }
  const max = Math.pow(2, zNum) - 1
  if (xNum < 0 || xNum > max || yNum < 0 || yNum > max) {
    return "Koordinater utanför giltigt intervall"
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    // 1. Auth
    const session = await auth()
    if (!session) {
      return new NextResponse("Ej inloggad", { status: 401 })
    }

    // 2. Rate limiting
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return new NextResponse("För många förfrågningar", { status: 429 })
    }

    // 3. Validate params
    const { z, x, y } = await params
    const validationError = validateTileParams(z, x, y)
    if (validationError) {
      return new NextResponse(validationError, { status: 400 })
    }

    // 4. Fetch tile from OpenStreetMap
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    const response = await fetch(tileUrl, {
      headers: { "User-Agent": "Equinet Route Planning App" },
    })

    if (!response.ok) {
      return new NextResponse("Tile not found", { status: 404 })
    }

    const imageBuffer = await response.arrayBuffer()

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    })
  } catch (error) {
    logger.error(
      "Tile proxy error",
      error instanceof Error ? error : new Error(String(error))
    )
    return new NextResponse("Internt serverfel", { status: 500 })
  }
}
