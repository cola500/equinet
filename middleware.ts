// Auth middleware using NextAuth v5 (Edge-compatible)
// IMPORTANT: Only import from auth.config.ts, NOT auth.ts (which has Prisma/bcrypt)
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"

// Create Edge-compatible auth instance with minimal config
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { auth: session, nextUrl } = req
  const path = nextUrl.pathname

  // If not authenticated, the auth callback in auth.config.ts handles redirect
  if (!session?.user) {
    // For API routes, return 401 JSON
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // For pages, redirect to login (handled by auth callback)
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  const userType = session.user.userType
  const isAdmin = session.user.isAdmin === true

  // Admin-only routes
  const adminPaths = ["/admin", "/api/admin"]
  if (adminPaths.some(p => path.startsWith(p))) {
    if (!isAdmin) {
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: "Åtkomst nekad" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    return NextResponse.next()
  }

  // Provider-only routes
  const providerOnlyPaths = [
    "/api/routes",
    "/api/route-orders/available",
    "/provider",
  ]

  if (providerOnlyPaths.some(p => path.startsWith(p))) {
    if (userType !== "provider") {
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: "Endast leverantörer har åtkomst till denna resurs" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/customer', nextUrl))
    }
  }

  // Customer-only routes
  const customerOnlyPaths = [
    "/api/route-orders/my-orders",
    "/customer",
  ]

  if (customerOnlyPaths.some(p => path.startsWith(p))) {
    if (userType !== "customer") {
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: "Endast kunder har åtkomst till denna resurs" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/provider', nextUrl))
    }
  }

  // All other matched routes just require authentication (any userType)
  return NextResponse.next()
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
