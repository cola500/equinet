import { NextRequest, NextResponse } from 'next/server'

const MODAL_API_URL = 'https://johan-26538--route-optimizer-fastapi-app.modal.run'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Log request för debugging
    console.log('Optimize route request:', JSON.stringify(body, null, 2))

    const response = await fetch(`${MODAL_API_URL}/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Modal API error response:', errorText)
      return NextResponse.json(
        { error: `Optimization failed: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('Optimize route success:', data)
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Route optimization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
