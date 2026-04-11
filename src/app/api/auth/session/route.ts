// Lightweight session endpoint for client-side auth state.
// NOT behind middleware auth (so clients can check their auth state).
import { getSession } from "@/lib/auth-server"
import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  // Rate limiting (before auth -- this endpoint is public by design)
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar" },
      { status: 429 }
    )
  }

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json(session)
}
