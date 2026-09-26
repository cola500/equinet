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
  aal?: {
    currentLevel: string
    nextLevel: string
  }
  /**
   * True when the AAL lookup itself errored (network/Supabase issue), as opposed
   * to succeeding with "no MFA enrolled". Must fail closed for admin routes --
   * an error here is not evidence that MFA verification is unnecessary.
   */
  aalCheckFailed?: boolean
}

/**
 * True for the MFA verify flow's own paths -- and ONLY those. A bare
 * `startsWith("/admin/mfa")` also matches an unrelated path like
 * `/admin/mfaXYZ`, which would exempt it from MFA enforcement by accident.
 */
function isMfaVerifyPath(path: string): boolean {
  return (
    path === "/admin/mfa" ||
    path.startsWith("/admin/mfa/") ||
    path === "/api/admin/mfa" ||
    path.startsWith("/api/admin/mfa/")
  )
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

    // MFA enforcement: if admin has MFA enrolled (nextLevel=aal2)
    // but hasn't verified this session (currentLevel=aal1), block access.
    // Also blocks when the AAL lookup itself failed -- fail closed, never
    // silently treat an error as "MFA not required".
    // Exception: /admin/mfa/* and /api/admin/mfa/* are always accessible for the verify flow.
    const mfaVerificationRequired =
      user.aalCheckFailed ||
      (user.aal &&
        user.aal.nextLevel === "aal2" &&
        user.aal.currentLevel !== "aal2")

    if (mfaVerificationRequired && !isMfaVerifyPath(path)) {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "MFA-verifiering krävs" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL("/admin/mfa/verify", nextUrl))
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
  const customerOnlyPaths = ["/api/route-orders/my-orders", "/customer", "/hem"]
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
