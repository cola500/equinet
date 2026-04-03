// Auth middleware using NextAuth v5 (Edge-compatible) + Supabase Auth fallback
// IMPORTANT: Only import from auth.config.ts, NOT auth.ts (which has Prisma/bcrypt)
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"
import { handleAuthorization } from "@/lib/middleware-auth"
import { getSupabaseUserFromCookie } from "@/lib/auth-supabase-edge"

// Create Edge-compatible auth instance with minimal config
const { auth } = NextAuth(authConfig)

export default auth(async (req) => {
  const { auth: session, nextUrl } = req
  const path = nextUrl.pathname

  // 1. NextAuth session (primary -- existing users)
  if (session?.user) {
    const result = handleAuthorization(
      {
        userType: session.user.userType as string,
        isAdmin: session.user.isAdmin === true,
      },
      nextUrl
    )
    return result ?? NextResponse.next()
  }

  // 2. Supabase Auth session (fallback -- migrated users)
  const supabaseUser = await getSupabaseUserFromCookie(req)
  if (supabaseUser) {
    const result = handleAuthorization(supabaseUser, nextUrl)
    return result ?? NextResponse.next()
  }

  // 3. No auth -- block access
  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', nextUrl))
})

// Configure which routes require authentication
export const config = {
  matcher: [
    // API routes that require auth
    "/api/bookings/:path*",
    "/api/routes/:path*",
    "/api/route-orders/:path*",
    "/api/services/:path*",
    // NOTE: /api/profile/:path* is intentionally NOT here -- it's a public route (shared horse profile)
    "/api/provider/:path*",
    "/api/admin/:path*",

    // Frontend routes that require auth
    "/provider/:path*",
    "/customer/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
}
