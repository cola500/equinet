/**
 * Extracted authorization logic for middleware.
 *
 * Used by Supabase Auth middleware for role-based authorization.
 * Returns NextResponse for blocked/redirected requests, null for allowed.
 */
import { NextResponse } from "next/server"
import type { NextURL } from "next/dist/server/web/next-url"

export interface MiddlewareUser {
  userType: string
  isAdmin: boolean
}

/**
 * Check role-based authorization.
 *
 * Returns null if authorized (caller should NextResponse.next()).
 * Returns NextResponse (redirect or 403) if blocked.
 */
export function handleAuthorization(
  user: MiddlewareUser,
  nextUrl: NextURL
): NextResponse | null {
  const path = nextUrl.pathname

  // Admin-only routes
  const adminPaths = ["/admin", "/api/admin"]
  if (adminPaths.some((p) => path.startsWith(p))) {
    if (!user.isAdmin) {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Åtkomst nekad" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL("/", nextUrl))
    }
    return null
  }

  // Provider-only routes
  const providerOnlyPaths = [
    "/api/routes",
    "/api/route-orders/available",
    "/provider",
  ]
  if (providerOnlyPaths.some((p) => path.startsWith(p))) {
    if (user.userType !== "provider") {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Endast leverantörer har åtkomst till denna resurs" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL("/customer", nextUrl))
    }
  }

  // Customer-only routes
  const customerOnlyPaths = ["/api/route-orders/my-orders", "/customer"]
  if (customerOnlyPaths.some((p) => path.startsWith(p))) {
    if (user.userType !== "customer") {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Endast kunder har åtkomst till denna resurs" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL("/provider", nextUrl))
    }
  }

  // All other matched routes: authenticated = allowed
  return null
}
