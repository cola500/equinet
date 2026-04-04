// Server-side auth utilities -- Supabase Auth
// Drop-in replacement for the previous NextAuth-based auth().
// Returns the same session shape so 135+ routes don't need changes.
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

interface SessionUser {
  id: string
  email: string
  name: string
  userType: string
  isAdmin: boolean
  providerId: string | null
  stableId: string | null
}

interface Session {
  user: SessionUser
}

/**
 * Get authenticated session in API routes.
 *
 * Reads Supabase Auth cookie, then enriches from DB (providerId, stableId, etc).
 * Returns the same session shape as the previous NextAuth-based auth().
 *
 * @throws {Response} 401 response if no valid session or user not found in DB
 */
export async function auth(): Promise<Session> {
  const session = await getSession()

  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
export async function getSession(): Promise<Session | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Always enrich from DB -- never trust JWT claims for providerId/stableId
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        isAdmin: true,
        provider: { select: { id: true } },
        stable: { select: { id: true } },
      },
    })

    if (!dbUser) {
      logger.warn("Supabase user not found in DB", { supabaseId: user.id })
      return null
    }

    const name = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ")

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email ?? user.email ?? "",
        name,
        userType: dbUser.userType,
        isAdmin: dbUser.isAdmin,
        providerId: dbUser.provider?.id ?? null,
        stableId: dbUser.stable?.id ?? null,
      },
    }
  } catch (err) {
    logger.error("Auth error in getSession", { error: err })
    return null
  }
}
