/**
 * Unified auth helper.
 *
 * Resolves auth from Supabase Auth cookie.
 * Previously supported Bearer (mobile token) and NextAuth -- now Supabase only.
 *
 * ALWAYS performs DB lookup for providerId/stableId/isAdmin -- never trusts JWT claims.
 */
import { prisma } from "@/lib/prisma"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

export interface AuthUser {
  id: string
  email: string
  userType: string
  isAdmin: boolean
  providerId: string | null
  stableId: string | null
  authMethod: "supabase"
}

/**
 * Resolve authenticated user from Supabase Auth cookie.
 *
 * Returns null if no valid auth found.
 */
export async function getAuthUser(_request: Request): Promise<AuthUser | null> {
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
