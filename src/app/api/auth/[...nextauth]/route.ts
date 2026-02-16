import { handlers } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

export const { GET } = handlers

export async function POST(request: NextRequest) {
  // IP-based rate limiting for login attempts (password spraying protection)
  if (request.nextUrl.pathname.includes("/callback/credentials")) {
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.loginIp(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många inloggningsförsök. Försök igen om 15 minuter." },
        { status: 429 }
      )
    }
  }

  return handlers.POST(request)
}
