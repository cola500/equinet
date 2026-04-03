/**
 * Dual-auth helper for parallel auth migration.
 *
 * Resolves auth from three sources in fixed priority order:
 * 1. Bearer token (iOS mobile JWT)
 * 2. NextAuth session cookie
 * 3. Supabase Auth cookie
 *
 * ALWAYS performs DB lookup for providerId/stableId/isAdmin -- never trusts JWT claims.
 */
import { prisma } from "@/lib/prisma"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { auth } from "@/lib/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

export interface AuthUser {
  id: string
  email: string
  userType: string
  isAdmin: boolean
  providerId: string | null
  stableId: string | null
  authMethod: "bearer" | "nextauth" | "supabase"
}

/**
 * Resolve authenticated user from any of three auth sources.
 *
 * Priority: Bearer > NextAuth > Supabase (fixed, no feature flag).
 * Returns null if no valid auth found.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  // 1. Bearer token (iOS mobile JWT)
  try {
    const bearerResult = await authFromMobileToken(request)
    if (bearerResult) {
      return enrichFromDatabase(bearerResult.userId, "", "bearer")
    }
  } catch (err) {
    logger.warn("Bearer auth failed, trying NextAuth", { error: err })
  }

  // 2. NextAuth session cookie
  try {
    const session = await auth()
    if (session?.user?.id) {
      return enrichFromDatabase(
        session.user.id,
        session.user.email ?? "",
        "nextauth"
      )
    }
  } catch (err) {
    // auth() throws Response(401) when no session -- that's expected, not an error
    if (!(err instanceof Response)) {
      logger.warn("NextAuth failed, trying Supabase", { error: err })
    }
  }

  // 3. Supabase Auth cookie
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) {
      return enrichFromDatabase(user.id, user.email ?? "", "supabase")
    }
  } catch (err) {
    logger.warn("Supabase auth failed", { error: err })
  }

  return null
}

/**
 * Look up user in database and build AuthUser.
 *
 * ALWAYS queries DB for providerId, stableId, isAdmin -- never trusts JWT claims.
 * Returns null if user not found in DB.
 */
export async function enrichFromDatabase(
  userId: string,
  fallbackEmail: string,
  authMethod: AuthUser["authMethod"]
): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      userType: true,
      isAdmin: true,
      provider: { select: { id: true } },
      stable: { select: { id: true } },
    },
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email ?? fallbackEmail,
    userType: user.userType,
    isAdmin: user.isAdmin,
    providerId: user.provider?.id ?? null,
    stableId: user.stable?.id ?? null,
    authMethod,
  }
}
