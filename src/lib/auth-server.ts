// Server-side auth utilities
// Helper functions for getting session in API routes
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "./auth"

/**
 * Get authenticated session in API routes.
 *
 * This is a convenience wrapper around getServerSession.
 * Middleware ensures session exists for protected routes,
 * so this should never return null in API routes.
 *
 * @throws {Error} If session is not found (should never happen with middleware)
 * @returns {Promise<Session>} The authenticated session
 */
export async function auth() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    // Return 401 JSON response instead of throwing
    // This makes error handling easier in tests
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    throw response
  }

  return session
}

/**
 * Get session without throwing (for optional auth scenarios).
 *
 * Use this when auth is optional and you want to handle
 * both authenticated and unauthenticated cases.
 *
 * @returns {Promise<Session | null>} The session or null
 */
export async function getSession() {
  return await getServerSession(authOptions)
}
