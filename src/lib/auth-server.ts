// Server-side auth utilities
// Re-export auth from the main auth module for backward compatibility
import { auth as nextAuth } from "./auth"
import { NextResponse } from "next/server"

/**
 * Get authenticated session in API routes.
 *
 * This is a convenience wrapper around NextAuth's auth().
 * Middleware ensures session exists for protected routes,
 * so this should never return null in API routes.
 *
 * @throws {NextResponse} 401 response if session is not found
 * @returns {Promise<Session>} The authenticated session
 */
export async function auth() {
  const session = await nextAuth()

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
  return await nextAuth()
}
