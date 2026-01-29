import { NextRequest, NextResponse } from 'next/server'
import { logger } from "@/lib/logger"

const MODAL_API_URL = 'https://johan-26538--route-optimizer-fastapi-app.modal.run'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Log request for debugging
    logger.debug("Optimize route request", { body: JSON.stringify(body) })

    const response = await fetch(`${MODAL_API_URL}/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error("Modal API error response", new Error(errorText))
      return NextResponse.json(
        { error: `Optimization failed: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    logger.info("Optimize route success")
    return NextResponse.json(data)

  } catch (error: any) {
    logger.error("Route optimization error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
