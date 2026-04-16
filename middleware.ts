// Auth middleware using Supabase Auth (Edge-compatible)
// Replaces the previous NextAuth-based middleware.
// Reads Supabase cookies, refreshes tokens, and checks role-based access.
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { handleAuthorization } from "@/lib/middleware-auth"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Create response first -- Supabase needs it to set refreshed cookies
  const response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on both request (for downstream) and response (for browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: Use getUser() not getSession() -- getUser() validates the JWT
  // server-side and triggers token refresh when needed
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!error && user) {
    const appMetadata = user.app_metadata ?? {}
    const isAdmin = (appMetadata.isAdmin as boolean) ?? false

    // For admin users, check MFA assurance level
    let aal: { currentLevel: string; nextLevel: string } | undefined
    if (isAdmin) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData) {
        aal = {
          currentLevel: aalData.currentLevel ?? "aal1",
          nextLevel: aalData.nextLevel ?? "aal1",
        }
      }
    }

    const result = handleAuthorization(
      {
        userType: (appMetadata.userType as string) ?? "customer",
        isAdmin,
        aal,
      },
      req.nextUrl
    )
    return result ?? response
  }

  // No valid auth -- block access
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }
  return NextResponse.redirect(new URL("/login", req.nextUrl))
}

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
