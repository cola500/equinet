// Auth middleware using NextAuth
// This centralizes all authentication and authorization logic
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Provider-only routes
    const providerOnlyPaths = [
      "/api/routes",
      "/api/route-orders/available",
      "/provider",
    ]

    if (providerOnlyPaths.some(p => path.startsWith(p))) {
      if (token?.userType !== "provider") {
        return NextResponse.json(
          { error: "Endast leverantörer har åtkomst till denna resurs" },
          { status: 403 }
        )
      }
    }

    // Customer-only routes
    const customerOnlyPaths = [
      "/api/route-orders/my-orders",
      "/customer",
    ]

    if (customerOnlyPaths.some(p => path.startsWith(p))) {
      if (token?.userType !== "customer") {
        return NextResponse.json(
          { error: "Endast kunder har åtkomst till denna resurs" },
          { status: 403 }
        )
      }
    }

    // All other matched routes just require authentication (any userType)
    return NextResponse.next()
  },
  {
    callbacks: {
      // This callback runs first - if it returns false, request is rejected with 401
      authorized: ({ token }) => !!token,
    },
  }
)

// Configure which routes require authentication
export const config = {
  matcher: [
    // API routes that require auth
    "/api/bookings/:path*",
    "/api/routes/:path*",
    "/api/route-orders/:path*",
    "/api/services/:path*",
    "/api/profile/:path*",
    "/api/provider/:path*",

    // Frontend routes that require auth
    "/provider/:path*",
    "/customer/:path*",
    "/dashboard/:path*",
  ],
}
